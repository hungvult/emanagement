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
    So sánh query_vec với danh sách ứng viên (candidates),
    trả về (top1_candidate, top1_score, top2_candidate, top2_score).
    """
    if not candidates:
        return None, 0.0, None, 0.0

    scores: List[Tuple[Dict[str, Any], float]] = []

    for cand in candidates:
        cand_vec = cand.get("embedding", [])
        if not cand_vec:
            continue
        score = cosine_similarity(query_vec, cand_vec)
        scores.append((cand, score))

    if not scores:
        return None, 0.0, None, 0.0

    # Sắp xếp giảm dần theo điểm tương đồng (score)
    scores.sort(key=lambda x: x[1], reverse=True)

    top1_cand, top1_score = scores[0]

    top2_cand = None
    top2_score = 0.0
    if len(scores) > 1:
        top2_cand, top2_score = scores[1]

    return top1_cand, top1_score, top2_cand, top2_score
