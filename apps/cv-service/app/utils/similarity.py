from typing import List, Tuple, Dict, Any, Optional
import numpy as np


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Tính độ tương đồng Cosine (Cosine Similarity) giữa 2 vector đặc trưng khuôn mặt.
    Trả về giá trị trong khoảng từ 0.0 (hoàn toàn khác) đến 1.0 (trùng khớp hoàn toàn).
    """
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    sim = float(np.dot(a, b) / (norm_a * norm_b))
    # Chuẩn hóa về dải [0.0, 1.0]
    return max(0.0, min(1.0, float((sim + 1.0) / 2.0))) if sim < 0 else float(min(1.0, sim))


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
