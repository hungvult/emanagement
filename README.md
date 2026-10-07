# Emanagement: chạy Docker và Cloudflare Tunnel

Tài liệu này mô tả cách chạy frontend, backend, CV service, các dịch vụ phụ trợ và monitoring bằng Docker Compose; đồng thời ghi lại cấu hình tunnel đã kiểm tra.

## Yêu cầu

- Docker Engine và Docker Compose plugin.
- File `.env` ở thư mục gốc. Nếu chưa có, sao chép `.env.example` rồi thay các giá trị mẫu bằng thông tin riêng:

  ```bash
  cp .env.example .env
  ```

  Tối thiểu cần đặt `DB_USER`, `DB_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `JWT_SECRET`, `GRAFANA_ADMIN_USER` và `GRAFANA_ADMIN_PASSWORD`.

## Chạy toàn bộ ứng dụng và monitoring

Từ thư mục gốc của repo, chạy một lệnh kết hợp cả ba file Compose:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.resources.yml \
  -f docker-compose.monitoring.yml \
  up -d --build
```

Lệnh này build và khởi chạy ứng dụng (PostgreSQL, MinIO, CV service, backend, frontend, Nginx) cùng giới hạn tài nguyên, đồng thời khởi chạy hệ thống giám sát (Prometheus, Grafana) trên cùng một Docker network.

Kiểm tra trạng thái:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.resources.yml \
  -f docker-compose.monitoring.yml \
  ps
```

Các địa chỉ cục bộ:

- Frontend qua Nginx: <http://localhost/>
- Grafana: <http://localhost/grafana/>
- Prometheus: <http://localhost/prometheus/>

Backend, CV service, PostgreSQL và MinIO chỉ expose cổng nội bộ trong Docker network. Nginx là cổng vào web trên host.

## Chạy Cloudflare Quick Tunnel

Đảm bảo ứng dụng đã chạy và Nginx phản hồi tại `http://127.0.0.1:80`. Dự án đã chuẩn bị sẵn cấu hình DNS resolver ép qua TCP tại `docker/cloudflared/resolv.conf` để đảm bảo tunnel phân giải được DNS trên mọi môi trường mạng.

Khởi chạy tunnel:

```bash
docker run --rm \
  --name emanagement-cloudflared \
  --network host \
  -v $(pwd)/docker/cloudflared/resolv.conf:/etc/resolv.conf:ro \
  cloudflare/cloudflared:latest \
  tunnel --url http://127.0.0.1:80
```

`cloudflared` sẽ in URL `https://<tên-ngẫu-nhiên>.trycloudflare.com` trong log. Mở URL đó để truy cập qua Nginx. Giữ terminal và container chạy để URL còn hoạt động; nhấn `Ctrl+C` sẽ dừng tunnel. Quick Tunnel là URL tạm, thay đổi khi tạo tunnel mới.

Backend kiểm tra origin qua biến `CORS_ALLOWED_ORIGINS`. Sau khi có URL tunnel, thêm origin chính xác (không có dấu `/` ở cuối) vào `.env`, giữ các origin local nếu vẫn cần dùng local:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:[*],http://127.0.0.1:[*],https://<ten-tunnel>.trycloudflare.com
```

Sau khi sửa `.env`, tạo lại riêng backend để nạp cấu hình mới:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.resources.yml \
  -f docker-compose.monitoring.yml \
  up -d --no-deps backend
```

Khi Quick Tunnel đổi URL, cập nhật lại origin này và chạy lại lệnh trên. Không dùng wildcard cho toàn bộ `trycloudflare.com`.

Firewall cần cho phép **outbound UDP/7844** từ máy chạy Docker tới các endpoint Cloudflare; DNS cũng cần phân giải được. Tunnel đi từ máy này ra Cloudflare nên không cần mở cổng inbound 7844. Cấu hình tham khảo: [Cloudflare Tunnel firewall requirements](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/).

## Dừng dịch vụ

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.resources.yml \
  -f docker-compose.monitoring.yml \
  down
```

Lệnh `down` ở trên không xóa named volumes. Không thêm `-v` trừ khi chủ động muốn xóa dữ liệu PostgreSQL, MinIO, Prometheus và Grafana.
