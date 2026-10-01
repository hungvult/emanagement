import os
import sys
import time
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import cv2
import numpy as np

# Ensure app is in python path
cv_service_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(cv_service_dir))

from app.core.config import settings
from app.core.models import model_registry
from app.services.face_detector import face_detector, DetectedFace
from app.services.embedding_service import embedding_service
from app.utils.similarity import cosine_similarity

def load_lfw_pairs(pairs_path: str, max_pairs: Optional[int] = None) -> List[Tuple[str, str, int]]:
    """
    Parse standard LFW pairs.txt.
    pairs.txt format:
    10 300
    [300 positive pairs: name idx1 idx2]
    [300 negative pairs: name1 idx1 name2 idx2]
    repeated for 10 folds.
    """
    with open(pairs_path, "r") as f:
        first_line = f.readline().strip().split()
        num_folds = int(first_line[0])
        pairs_per_fold = int(first_line[1])
        raw_lines = [l.strip() for l in f if l.strip()]

    pos_pairs = []
    neg_pairs = []

    idx = 0
    total_lines = len(raw_lines)
    for _ in range(num_folds):
        # Read positive pairs for this fold
        for _ in range(pairs_per_fold):
            if idx >= total_lines:
                break
            parts = raw_lines[idx].split()
            idx += 1
            if len(parts) == 3:
                name, i1, i2 = parts[0], int(parts[1]), int(parts[2])
                pos_pairs.append((f"{name}/{name}_{i1:04d}.jpg", f"{name}/{name}_{i2:04d}.jpg", 1))

        # Read negative pairs for this fold
        for _ in range(pairs_per_fold):
            if idx >= total_lines:
                break
            parts = raw_lines[idx].split()
            idx += 1
            if len(parts) == 4:
                n1, i1, n2, i2 = parts[0], int(parts[1]), parts[2], int(parts[3])
                neg_pairs.append((f"{n1}/{n1}_{i1:04d}.jpg", f"{n2}/{n2}_{i2:04d}.jpg", 0))

    if max_pairs:
        half = max_pairs // 2
        selected = pos_pairs[:half] + neg_pairs[:half]
    else:
        selected = pos_pairs + neg_pairs

    return selected

def get_or_extract_embedding(img_path: str, cache: Dict[str, Optional[List[float]]], metrics: Dict[str, float]) -> Optional[List[float]]:
    if img_path in cache:
        return cache[img_path]

    if not os.path.isfile(img_path):
        cache[img_path] = None
        return None

    img = cv2.imread(img_path)
    if img is None:
        cache[img_path] = None
        return None

    t0 = time.perf_counter()
    status, faces = face_detector.detect_faces(img)
    t_det = time.perf_counter() - t0
    metrics["detect_time"] += t_det
    metrics["detect_count"] += 1

    if not faces:
        cache[img_path] = None
        return None

    t1 = time.perf_counter()
    emb = embedding_service.extract_embedding(img, faces[0])
    t_emb = time.perf_counter() - t1
    metrics["embed_time"] += t_emb
    metrics["embed_count"] += 1

    cache[img_path] = emb
    return emb

def run_benchmark(data_dir: str, pairs_path: str, max_pairs: int = 1000, threshold: float = 0.70):
    print("=" * 70)
    print("      eManagement Computer Vision Service - LFW Benchmark Suite")
    print("=" * 70)
    print(f"[Init] Loading ONNX models into registry...")
    model_registry.load()
    if not model_registry.is_ready:
        print("[Error] Models could not be loaded!")
        sys.exit(1)
    print(f"[Init] Models loaded: Detector (YuNet) = READY, Recognizer (SFace) = READY")

    img_root = os.path.join(data_dir, "lfw_funneled")
    if not os.path.isdir(img_root):
        img_root = data_dir

    print(f"[Data] Dataset root directory: {img_root}")
    pairs = load_lfw_pairs(pairs_path, max_pairs=max_pairs)
    pos_count = sum(1 for p in pairs if p[2] == 1)
    neg_count = sum(1 for p in pairs if p[2] == 0)
    print(f"[Data] Selected {len(pairs)} pairs ({pos_count} Same Person, {neg_count} Different People).")

    cache: Dict[str, Optional[List[float]]] = {}
    metrics = {"detect_time": 0.0, "detect_count": 0, "embed_time": 0.0, "embed_count": 0}

    y_true = []
    y_scores = []
    skipped = 0

    start_bench = time.time()
    for i, (rel1, rel2, label) in enumerate(pairs):
        path1 = os.path.join(img_root, rel1)
        path2 = os.path.join(img_root, rel2)

        emb1 = get_or_extract_embedding(path1, cache, metrics)
        emb2 = get_or_extract_embedding(path2, cache, metrics)

        if emb1 is None or emb2 is None:
            skipped += 1
            continue

        sim = cosine_similarity(emb1, emb2)
        y_true.append(label)
        y_scores.append(sim)

        if (i + 1) % 200 == 0 or (i + 1) == len(pairs):
            elapsed = time.time() - start_bench
            print(f"  Processed {i+1}/{len(pairs)} pairs... ({elapsed:.1f}s)")

    total_valid = len(y_true)
    y_true_np = np.array(y_true)
    y_scores_np = np.array(y_scores)

    pos_scores = y_scores_np[y_true_np == 1]
    neg_scores = y_scores_np[y_true_np == 0]

    # Metrics at current threshold
    preds = (y_scores_np >= threshold).astype(int)
    tp = np.sum((preds == 1) & (y_true_np == 1))
    fp = np.sum((preds == 1) & (y_true_np == 0))
    tn = np.sum((preds == 0) & (y_true_np == 0))
    fn = np.sum((preds == 0) & (y_true_np == 1))

    accuracy = (tp + tn) / total_valid if total_valid else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    far = fp / (fp + tn) if (fp + tn) else 0.0  # False Accept Rate
    frr = fn / (tp + fn) if (tp + fn) else 0.0  # False Reject Rate

    # Find optimal threshold & EER
    best_acc = 0.0
    best_thresh = threshold
    eer = 1.0
    eer_thresh = threshold

    thresholds = np.linspace(0.10, 0.90, 161)
    for t in thresholds:
        cur_preds = (y_scores_np >= t).astype(int)
        cur_tp = np.sum((cur_preds == 1) & (y_true_np == 1))
        cur_fp = np.sum((cur_preds == 1) & (y_true_np == 0))
        cur_tn = np.sum((cur_preds == 0) & (y_true_np == 0))
        cur_fn = np.sum((cur_preds == 0) & (y_true_np == 1))
        cur_acc = (cur_tp + cur_tn) / total_valid
        if cur_acc > best_acc:
            best_acc = cur_acc
            best_thresh = t

        cur_far = cur_fp / (cur_fp + cur_tn) if (cur_fp + cur_tn) else 0.0
        cur_frr = cur_fn / (cur_tp + cur_fn) if (cur_tp + cur_fn) else 0.0
        if abs(cur_far - cur_frr) < abs(eer):
            eer = (cur_far + cur_frr) / 2.0
            eer_thresh = t

    from sklearn.metrics import roc_auc_score
    try:
        auc_score = float(roc_auc_score(y_true_np, y_scores_np))
    except Exception:
        auc_score = 0.0

    avg_det_ms = (metrics["detect_time"] / metrics["detect_count"] * 1000) if metrics["detect_count"] else 0.0
    avg_emb_ms = (metrics["embed_time"] / metrics["embed_count"] * 1000) if metrics["embed_count"] else 0.0

    report = {
        "dataset": "LFW (Labeled Faces in the Wild - 13,233 images)",
        "total_pairs_tested": total_valid,
        "positive_pairs": int(np.sum(y_true_np == 1)),
        "negative_pairs": int(np.sum(y_true_np == 0)),
        "current_threshold": threshold,
        "metrics_at_current_threshold": {
            "accuracy": round(float(accuracy), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(float(f1), 4),
            "far_false_acceptance_rate": round(float(far), 4),
            "frr_false_rejection_rate": round(float(frr), 4),
            "confusion_matrix": {"TP": int(tp), "FP": int(fp), "TN": int(tn), "FN": int(fn)}
        },
        "score_distribution": {
            "positive_mean": round(float(np.mean(pos_scores)), 4) if len(pos_scores) else 0.0,
            "positive_std": round(float(np.std(pos_scores)), 4) if len(pos_scores) else 0.0,
            "positive_min": round(float(np.min(pos_scores)), 4) if len(pos_scores) else 0.0,
            "positive_max": round(float(np.max(pos_scores)), 4) if len(pos_scores) else 0.0,
            "negative_mean": round(float(np.mean(neg_scores)), 4) if len(neg_scores) else 0.0,
            "negative_std": round(float(np.std(neg_scores)), 4) if len(neg_scores) else 0.0,
            "negative_min": round(float(np.min(neg_scores)), 4) if len(neg_scores) else 0.0,
            "negative_max": round(float(np.max(neg_scores)), 4) if len(neg_scores) else 0.0,
        },
        "optimization": {
            "best_threshold_for_accuracy": round(float(best_thresh), 4),
            "best_accuracy": round(float(best_acc), 4),
            "eer_threshold": round(float(eer_thresh), 4),
            "eer_equal_error_rate": round(float(eer), 4),
            "roc_auc_score": round(float(auc_score), 4)
        },
        "performance_latency": {
            "avg_detection_latency_ms": round(float(avg_det_ms), 2),
            "avg_embedding_latency_ms": round(float(avg_emb_ms), 2),
            "total_latency_per_frame_ms": round(float(avg_det_ms + avg_emb_ms), 2)
        }
    }

    report_path = os.path.join(data_dir, "benchmark_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 70)
    print("                    BENCHMARK RESULTS REPORT")
    print("=" * 70)
    print(f" Evaluated Pairs   : {total_valid} ({report['positive_pairs']} Same, {report['negative_pairs']} Different)")
    print(f" ROC AUC Score     : {report['optimization']['roc_auc_score'] * 100:.2f}% (Khả năng phân tách danh tính)")
    print("-" * 70)
    print(f" [Current Threshold = {threshold}]")
    print(f"  • Accuracy       : {report['metrics_at_current_threshold']['accuracy'] * 100:.2f}%")
    print(f"  • Precision      : {report['metrics_at_current_threshold']['precision'] * 100:.2f}%")
    print(f"  • Recall         : {report['metrics_at_current_threshold']['recall'] * 100:.2f}%")
    print(f"  • F1-Score       : {report['metrics_at_current_threshold']['f1_score'] * 100:.2f}%")
    print(f"  • FAR (Nhận nhầm người lạ): {report['metrics_at_current_threshold']['far_false_acceptance_rate'] * 100:.2f}%")
    print(f"  • FRR (Từ chối nhân viên): {report['metrics_at_current_threshold']['frr_false_rejection_rate'] * 100:.2f}%")
    print("-" * 70)
    print(f" [Cosine Similarity Distribution]")
    print(f"  • Same Person    : Mean = {report['score_distribution']['positive_mean']} ± {report['score_distribution']['positive_std']} (Range: {report['score_distribution']['positive_min']} -> {report['score_distribution']['positive_max']})")
    print(f"  • Different Face : Mean = {report['score_distribution']['negative_mean']} ± {report['score_distribution']['negative_std']} (Range: {report['score_distribution']['negative_min']} -> {report['score_distribution']['negative_max']})")
    print("-" * 70)
    print(f" [Analysis & Recommendation]")
    print(f"  • Best Threshold : {report['optimization']['best_threshold_for_accuracy']} (Max Accuracy: {report['optimization']['best_accuracy'] * 100:.2f}%)")
    print(f"  • EER (Equal Error Rate): {report['optimization']['eer_equal_error_rate'] * 100:.2f}% @ Threshold {report['optimization']['eer_threshold']}")
    print("-" * 70)
    print(f" [Inference Speed]")
    print(f"  • Detection (YuNet)  : {avg_det_ms:.1f} ms / face")
    print(f"  • Embedding (SFace)  : {avg_emb_ms:.1f} ms / face")
    print(f"  • Total Pipeline     : {avg_det_ms + avg_emb_ms:.1f} ms / frame (~{1000 / (avg_det_ms + avg_emb_ms):.1f} FPS)")
    print("=" * 70)
    print(f"[Done] Full JSON report saved to: {report_path}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="apps/cv-service/data/lfw")
    parser.add_argument("--pairs-file", default="apps/cv-service/data/lfw/pairs.txt")
    parser.add_argument("--max-pairs", type=int, default=1000)
    parser.add_argument("--threshold", type=float, default=0.70)
    args = parser.parse_args()

    run_benchmark(args.data_dir, args.pairs_file, args.max_pairs, args.threshold)
