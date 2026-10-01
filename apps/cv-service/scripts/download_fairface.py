"""Tải bộ dữ liệu FairFace (Validation Set + CSV nhãn) về thư mục data/fairface/.

Cách dùng:
    python scripts/download_fairface.py
"""

import os
import sys
import time
import zipfile
import urllib.request
from pathlib import Path

DEST_DIR = Path(__file__).resolve().parents[1] / "data" / "fairface"
IMAGES_ZIP_URL = "https://huggingface.co/datasets/nlphuji/fairface_val_padding_025/resolve/main/fairface_val_images.zip"
LABEL_CSV_URL = "https://drive.usercontent.google.com/download?id=1wOdja-ezstMEp81tX1a-EYkFebev4h7D&export=download"

def download_file(url: str, dest_path: Path, desc: str):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if dest_path.is_file() and dest_path.stat().st_size > 1024:
        print(f"[{desc}] File đã tồn tại ({dest_path.stat().st_size / 1024 / 1024:.2f} MB): {dest_path}")
        return

    print(f"[{desc}] Đang tải từ {url} ...")
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    start_time = time.time()
    last_print = start_time
    downloaded = 0

    with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path.with_suffix(dest_path.suffix + ".tmp"), "wb") as f:
        total = int(resp.headers.get("Content-Length", 0))
        while True:
            chunk = resp.read(1024 * 128)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            now = time.time()
            if now - last_print >= 2.0:
                percent = (downloaded / total * 100) if total else 0
                speed_kb = (downloaded / (now - start_time)) / 1024
                print(f"[{desc}] {downloaded / 1024 / 1024:.1f} MB / {total / 1024 / 1024:.1f} MB ({percent:.1f}%) @ {speed_kb:.1f} KB/s")
                last_print = now

    tmp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
    tmp_path.rename(dest_path)
    total_time = time.time() - start_time
    print(f"[{desc}] Tải hoàn tất trong {total_time:.1f}s ({dest_path.stat().st_size / 1024 / 1024:.1f} MB).")

def extract_zip(zip_path: Path, extract_to: Path):
    target_img_dir = extract_to / "fairface_val_images"
    if target_img_dir.is_dir() and len(os.listdir(target_img_dir)) > 100:
        print(f"[Extract] Thư mục ảnh đã giải nén sẵn: {target_img_dir}")
        return

    print(f"[Extract] Đang giải nén {zip_path} ...")
    t0 = time.time()
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(extract_to)
    print(f"[Extract] Giải nén thành công trong {time.time() - t0:.1f}s.")

if __name__ == "__main__":
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    zip_dest = DEST_DIR / "fairface_val_images.zip"
    csv_dest = DEST_DIR / "fairface_label_val.csv"

    download_file(LABEL_CSV_URL, csv_dest, "FairFace CSV Labels")
    download_file(IMAGES_ZIP_URL, zip_dest, "FairFace Validation Images")
    extract_zip(zip_dest, DEST_DIR)
    print(f"\n[Ready] Dữ liệu FairFace đã sẵn sàng tại: {DEST_DIR}")
