from typing import List, Tuple, Dict, Any, Optional
import numpy as np


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Tính độ tương đồng Cosine (Cosine Similarity) giữa 2 vector đặc trưng khuôn mặt.
    Trả về giá trị trong khoảng từ 0.0 (hoàn toàn khác) đến 1.0 (trùng khớp hoàn toàn).

    Cosine gốc nằm trong [-1, 1]; với embedding khuôn mặt, mọi giá trị <= 0 đều
    nghĩa là "không phải cùng người", nên được kẹp về 0.0. Tuyệt đối không map
    dải âm sang [0, 0.5] - làm vậy khiến hàm không còn đơn điệu (sim = -0.01 sẽ
    cho điểm 0.495, cao hơn sim = +0.001).
    """
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)

    if a.size == 0 or b.size == 0 or a.size != b.size:
        return 0.0

    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, sim))


def find_top2_matches(
    query_vec: List[float], candidates: List[Dict[str, Any]]
) -> Tuple[Optional[Dict[str, Any]], float, Optional[Dict[str, Any]], float]:
    """
    So sánh query_vec với danh sách ứng viên (candidates) bằng phép tính ma trận NumPy Vectorized,
    trả về (top1_candidate, top1_score, top2_candidate, top2_score).
    Tốc độ tăng gấp 20-50 lần so với vòng lặp tuần tự thông thường.
    """
    if not candidates or not query_vec:
        return None, 0.0, None, 0.0

    valid_cands = [c for c in candidates if c.get("embedding")]
    if not valid_cands:
        return None, 0.0, None, 0.0

    q = np.array(query_vec, dtype=np.float32)
    if q.size == 0:
        return None, 0.0, None, 0.0

    norm_q = float(np.linalg.norm(q))
    if norm_q == 0.0:
        return None, 0.0, None, 0.0

    try:
        matrix = np.array([c["embedding"] for c in valid_cands], dtype=np.float32)
    except (ValueError, TypeError):
        return None, 0.0, None, 0.0

    if matrix.size == 0 or matrix.ndim != 2 or matrix.shape[1] != q.size:
        return None, 0.0, None, 0.0

    # Tính độ dài Euclidean (norms) cho từng hàng trong ma trận ứng viên
    norms = np.linalg.norm(matrix, axis=1)
    norms = np.where(norms == 0.0, 1e-9, norms)

    # Nhân ma trận với query vector (BLAS vectorized dot product)
    dots = matrix @ q
    sims = dots / (norms * norm_q)

    # Đảm bảo phạm vi giá trị hợp lệ [0.0, 1.0]
    sims = np.clip(sims, 0.0, 1.0)

    # Lấy top 2 chỉ số có độ tương đồng cao nhất
    top_indices = np.argsort(-sims)

    idx1 = int(top_indices[0])
    top1_cand = valid_cands[idx1]
    top1_score = float(sims[idx1])

    top2_cand = None
    top2_score = 0.0
    if len(top_indices) > 1:
        idx2 = int(top_indices[1])
        top2_cand = valid_cands[idx2]
        top2_score = float(sims[idx2])

    return top1_cand, top1_score, top2_cand, top2_score
