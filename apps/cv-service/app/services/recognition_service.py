from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from app.core.config import settings
from app.core.constants import CvStatus
from app.services.embedding_service import embedding_service
from app.utils.similarity import find_top2_matches


class RecognitionService:
    def recognize_face(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int], candidates: List[Dict[str, Any]]
    ) -> Tuple[CvStatus, bool, Optional[int], float, List[float]]:
        """
        Trích xuất embedding từ khung hình và thực hiện matching với danh sách ứng viên từ Backend.
        Trả về (status, matched, matched_user_id, similarity_score, query_embedding).
        """
        # Trích xuất Vector đặc trưng khuôn mặt
        query_vec = embedding_service.extract_embedding(img, bbox)

        if not candidates:
            return CvStatus.UNKNOWN_FACE, False, None, 0.0, query_vec

        # Tìm Top 1 và Top 2 ứng viên giống nhất
        top1_cand, top1_score, top2_cand, top2_score = find_top2_matches(query_vec, candidates)

        if top1_cand is None or top1_score < settings.FACE_MATCH_THRESHOLD:
            return CvStatus.UNKNOWN_FACE, False, None, round(top1_score, 4), query_vec

        # Kiểm tra điều kiện tranh chấp AMBIGUOUS_MATCH (Khoảng cách giữa Top 1 và Top 2 quá gần)
        if top2_cand is not None:
            margin = top1_score - top2_score
            if margin < settings.FACE_AMBIGUITY_MARGIN:
                top1_user_id = top1_cand.get("userId")
                return CvStatus.AMBIGUOUS_MATCH, False, top1_user_id, round(top1_score, 4), query_vec

        top1_user_id = top1_cand.get("userId")
        return CvStatus.MATCHED, True, top1_user_id, round(top1_score, 4), query_vec


recognition_service = RecognitionService()
