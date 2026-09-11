"""Kiểm tra hàm cosine_similarity - đặc biệt là tính đơn điệu."""

import pytest

from app.utils.similarity import cosine_similarity, find_top2_matches


def test_identical_vectors_score_one():
    vec = [0.1, 0.2, 0.3, 0.4]
    assert cosine_similarity(vec, vec) == pytest.approx(1.0, abs=1e-6)


def test_orthogonal_vectors_score_zero():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0, abs=1e-6)


def test_opposite_vectors_clamped_to_zero():
    """Cosine âm phải về 0.0, không được map sang 0.5 - nếu không hàm mất đơn điệu."""
    assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == 0.0


def test_monotonic_around_zero():
    """Điểm của cặp vector gần vuông góc phía âm không được cao hơn phía dương."""
    slightly_negative = cosine_similarity([1.0, 0.0], [-0.01, 1.0])
    slightly_positive = cosine_similarity([1.0, 0.0], [0.01, 1.0])
    assert slightly_negative <= slightly_positive


def test_zero_and_mismatched_vectors_are_safe():
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0
    assert cosine_similarity([], [1.0]) == 0.0
    assert cosine_similarity([1.0, 0.0, 0.0], [1.0, 0.0]) == 0.0


def test_find_top2_orders_by_score():
    query = [1.0, 0.0]
    candidates = [
        {"userId": 1, "embedding": [0.0, 1.0]},
        {"userId": 2, "embedding": [1.0, 0.0]},
        {"userId": 3, "embedding": [0.7, 0.7]},
    ]
    top1, top1_score, top2, top2_score = find_top2_matches(query, candidates)
    assert top1["userId"] == 2
    assert top2["userId"] == 3
    assert top1_score >= top2_score


def test_find_top2_with_empty_candidates():
    assert find_top2_matches([1.0, 0.0], []) == (None, 0.0, None, 0.0)
