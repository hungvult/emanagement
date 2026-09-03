"""So khớp khuôn mặt trong khung hình với danh sách ứng viên do backend gửi lên."""

from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus
from app.services.embedding_service import embedding_service
from app.services.face_detector import DetectedFace
from app.utils.similarity import find_top2_matches


class RecognitionService:
    def recognize_face(
        self, img: np.ndarray, face: DetectedFace, candidates: List[Dict[str, Any]]
    ) -> Tuple[CvStatus, bool, Optional[int], float, List[float]]:
        """Trích xuất embedding rồi so khớp với candidates.

        Trả về (status, matched, matched_user_id, similarity_score, query_embedding).
        Ứng viên có vector sai số chiều bị loại ngay tại đây: đó là dữ liệu đăng ký
        từ phiên bản model cũ, so sánh sẽ cho điểm vô nghĩa.
        """
        query_vec = embedding_service.extract_embedding(img, face)

        usable = [
            cand
            for cand in candidates
            if len(cand.get("embedding") or []) == len(query_vec)
        ]

        if not usable:
            return CvStatus.UNKNOWN_FACE, False, None, 0.0, query_vec

        top1_cand, top1_score, top2_cand, top2_score = find_top2_matches(query_vec, usable)

        if top1_cand is None or top1_score < settings.FACE_MATCH_THRESHOLD:
            return CvStatus.UNKNOWN_FACE, False, None, round(top1_score, 4), query_vec

        # Top1 và Top2 quá gần nhau -> không đủ cơ sở kết luận, tránh chấm công sai người.
        if top2_cand is not None and (top1_score - top2_score) < settings.FACE_AMBIGUITY_MARGIN:
            return (
                CvStatus.AMBIGUOUS_MATCH,
                False,
                top1_cand.get("userId"),
                round(top1_score, 4),
                query_vec,
            )

        return CvStatus.MATCHED, True, top1_cand.get("userId"), round(top1_score, 4), query_vec


recognition_service = RecognitionService()
