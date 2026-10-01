import os
import sys
import csv
import time
import json
import random
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple

import cv2
import numpy as np

# Ensure cv-service app is in python path
cv_service_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(cv_service_dir))

from app.core.config import settings
from app.core.models import model_registry
from app.services.face_detector import face_detector
from app.services.embedding_service import embedding_service
from app.services.liveness_service import liveness_detector
from app.utils.similarity import cosine_similarity

def run_fairface_test(samples_per_race: int = 150, threshold: float = 0.40):
    print("=" * 75)
    print("       eManagement CV Service - FairFace Demographic & Bias Benchmark")
    print("=" * 75)
    
    # 1. Load ONNX models
    print("[1/4] Loading ONNX Models (YuNet, SFace, MiniFASNetV2)...")
    model_registry.load()
    if not model_registry.is_ready:
        print("[Error] Could not load all models!")
        sys.exit(1)
    print("[1/4] All 3 models loaded successfully: Ready!")

    # 2. Parse FairFace annotations
    csv_path = "apps/cv-service/data/fairface/fairface_label_val.csv"
    img_dir = "apps/cv-service/data/fairface/fairface_val_images"
    
    records_by_race = defaultdict(list)
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # File format in csv is e.g. 'val/1.jpg' -> extract filename '1.jpg'
            fname = os.path.basename(row["file"])
            fpath = os.path.join(img_dir, fname)
            if os.path.isfile(fpath):
                records_by_race[row["race"]].append({
                    "filename": fname,
                    "filepath": fpath,
                    "age": row["age"],
                    "gender": row["gender"],
                    "race": row["race"]
                })

    print(f"[2/4] Loaded annotations for {sum(len(v) for v in records_by_race.values())} images across {len(records_by_race)} races.")

    # Target key races: East Asian, Southeast Asian, Black, White, Indian, Latino_Hispanic
    target_races = ["East Asian", "Southeast Asian", "Black", "White", "Indian", "Latino_Hispanic"]
    
    stats = {}
    embeddings_by_race = defaultdict(list)

    print(f"\n[3/4] Running Detection, Brightness, and Anti-Spoofing on {samples_per_race} samples per race...")
    random.seed(42)

    for race in target_races:
        items = records_by_race[race]
        if not items:
            continue
        selected = random.sample(items, min(samples_per_race, len(items)))

        det_success = 0
        liveness_success = 0
        brightness_list = []
        contrast_list = []
        det_times = []
        emb_times = []
        liv_times = []
        extracted_embs = []

        for item in selected:
            img = cv2.imread(item["filepath"])
            if img is None:
                continue

            # Detection
            t0 = time.perf_counter()
            status, faces = face_detector.detect_faces(img)
            det_times.append(time.perf_counter() - t0)

            if status != status.VALID or not faces:
                continue

            det_success += 1
            face = faces[0]
            x, y, w, h = face.bbox
            x1, y1 = max(0, x), max(0, y)
            x2, y2 = min(img.shape[1], x + w), min(img.shape[0], y + h)
            face_crop = img[y1:y2, x1:x2]

            # Brightness & contrast
            if face_crop.size > 0:
                gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                brightness_list.append(float(np.mean(gray)))
                contrast_list.append(float(np.std(gray)))

            # Liveness / Anti-Spoofing
            t1 = time.perf_counter()
            liv_status, is_real, liv_score, _ = liveness_detector.check_liveness(img, face.bbox)
            liv_times.append(time.perf_counter() - t1)
            if is_real:
                liveness_success += 1

            # Feature Embedding
            t2 = time.perf_counter()
            emb = embedding_service.extract_embedding(img, face)
            emb_times.append(time.perf_counter() - t2)
            extracted_embs.append(emb)

        embeddings_by_race[race] = extracted_embs

        stats[race] = {
            "total_tested": len(selected),
            "detection_rate": round(det_success / len(selected) * 100, 2),
            "liveness_pass_rate": round(liveness_success / det_success * 100, 2) if det_success else 0.0,
            "mean_brightness": round(float(np.mean(brightness_list)), 2) if brightness_list else 0.0,
            "mean_contrast": round(float(np.mean(contrast_list)), 2) if contrast_list else 0.0,
            "avg_detection_latency_ms": round(float(np.mean(det_times) * 1000), 2) if det_times else 0.0,
            "avg_embedding_latency_ms": round(float(np.mean(emb_times) * 1000), 2) if emb_times else 0.0,
            "avg_liveness_latency_ms": round(float(np.mean(liv_times) * 1000), 2) if liv_times else 0.0,
        }

    # 4. Measure Inter-Identity Cosine Similarity (False Positive Test)
    print("\n[4/4] Evaluating Inter-Person Cosine Similarity (Testing for False Positives)...")
    fp_results = {}
    
    # Within-race different persons
    for race, embs in embeddings_by_race.items():
        if len(embs) < 2:
            continue
        sims = []
        n_pairs = min(500, len(embs) * (len(embs) - 1) // 2)
        pairs_indices = random.sample(
            [(i, j) for i in range(len(embs)) for j in range(i + 1, len(embs))],
            n_pairs
        )
        for i, j in pairs_indices:
            sim = cosine_similarity(embs[i], embs[j])
            sims.append(sim)

        sims_np = np.array(sims)
        fp_count = np.sum(sims_np >= threshold)
        fp_rate = fp_count / len(sims) * 100 if len(sims) else 0.0

        fp_results[race] = {
            "pairs_evaluated": len(sims),
            "mean_similarity": round(float(np.mean(sims_np)), 4),
            "max_similarity": round(float(np.max(sims_np)), 4),
            "false_positives_at_040": int(fp_count),
            "false_positive_rate": round(float(fp_rate), 2)
        }

    # Cross-race: Black vs East Asian
    if embeddings_by_race["Black"] and embeddings_by_race["East Asian"]:
        cross_sims = []
        cross_pairs = [(b, ea) for b in embeddings_by_race["Black"][:50] for ea in embeddings_by_race["East Asian"][:50]]
        for e1, e2 in cross_pairs:
            cross_sims.append(cosine_similarity(e1, e2))
        cross_np = np.array(cross_sims)
        fp_results["Cross: Black vs East Asian"] = {
            "pairs_evaluated": len(cross_sims),
            "mean_similarity": round(float(np.mean(cross_np)), 4),
            "max_similarity": round(float(np.max(cross_np)), 4),
            "false_positives_at_040": int(np.sum(cross_np >= threshold)),
            "false_positive_rate": round(float(np.sum(cross_np >= threshold) / len(cross_sims) * 100), 2)
        }

    # Print summary table
    print("\n" + "=" * 80)
    print("                     FAIRFACE BENCHMARK REPORT TABLE")
    print("=" * 80)
    header = f"{'Nhóm Chủng Tộc':<18} | {'Phát hiện %':<11} | {'Liveness %':<10} | {'Độ sáng (0-255)':<15} | {'Cosine Khác Người':<18}"
    print(header)
    print("-" * 80)
    for race in target_races:
        s = stats.get(race, {})
        fp = fp_results.get(race, {})
        mean_sim = fp.get("mean_similarity", 0.0)
        max_sim = fp.get("max_similarity", 0.0)
        sim_str = f"{mean_sim:.3f} (Max: {max_sim:.3f})"
        print(f"{race:<18} | {s.get('detection_rate', 0.0):>9.2f}% | {s.get('liveness_pass_rate', 0.0):>8.2f}% | {s.get('mean_brightness', 0.0):>6.1f} ± {s.get('mean_contrast', 0.0):<4.1f} | {sim_str:<18}")

    print("=" * 80)
    print(f"\n[Chi tiết Tỷ Lệ Nhận Nhầm (False Positives at threshold = {threshold})]:")
    for k, v in fp_results.items():
        print(f"  • {k:<25}: FAR = {v['false_positive_rate']}% (Số ca nhận nhầm: {v['false_positives_at_040']}/{v['pairs_evaluated']}, Max Cosine: {v['max_similarity']})")

    out_json = "apps/cv-service/data/fairface/fairface_benchmark_results.json"
    with open(out_json, "w") as f:
        json.dump({"demographics": stats, "false_positives": fp_results}, f, indent=2)
    print(f"\n[Done] Kết quả đã được lưu tại: {out_json}")

if __name__ == "__main__":
    run_fairface_test(samples_per_race=150, threshold=0.40)
