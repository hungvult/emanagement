#!/usr/bin/env python3
"""
Utility script to package FairFace dataset into bulk import ZIP packages
for testing eManagement bulk employee import pipeline.

Supports:
- Subsets (e.g. 100, 1,000, 10,000)
- Both FairFace CSV format and Standard Business CSV format
- Security testing mode (Zip Slip traversal, CSV formula injection, Magic Bytes tampering)
"""

import argparse
import csv
import os
import sys
import zipfile
from pathlib import Path


def generate_package(
    dataset_dir: str,
    output_zip: str,
    count: int = 100,
    csv_format: str = "fairface",
    test_security: str = None,
):
    dataset_path = Path(dataset_dir)
    val_csv_path = dataset_path / "fairface_label_val.csv"
    val_img_dir = dataset_path / "val"

    if not val_csv_path.exists():
        print(f"Error: CSV file not found at {val_csv_path}", file=sys.stderr)
        sys.exit(1)
    if not val_img_dir.exists():
        print(f"Error: Image directory not found at {val_img_dir}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(output_zip)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Packaging {count} samples from {dataset_dir} into {output_zip}...")

    # Read rows from FairFace CSV
    rows = []
    with open(val_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if count > 0 and i >= count:
                break
            rows.append(row)

    print(f"Collected {len(rows)} records from label CSV.")

    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Prepare CSV content
        if csv_format == "standard":
            csv_filename = "employees.csv"
            header = ["employee_code", "full_name", "email", "phone", "image_path"]
            csv_lines = [",".join(header)]
            for idx, r in enumerate(rows, 1):
                raw_file = r["file"]  # e.g., 'val/1.jpg'
                file_name = Path(raw_file).name
                code = f"EMP_STD_{idx:05d}"
                name = f"Nhân Viên {idx}"
                email = f"emp_{idx:05d}@emanagement.com"
                phone = f"09{idx:08d}"
                if test_security == "csv_injection" and idx == 1:
                    code = "=cmd|'/c calc'!A1"
                    name = "@SUM(1+1)"
                csv_lines.append(f"{code},{name},{email},{phone},{file_name}")
            zf.writestr(csv_filename, "\n".join(csv_lines))
        else:
            # FairFace format: file,age,gender,race,service_test
            csv_filename = "fairface_label_val.csv"
            header = ["file", "age", "gender", "race", "service_test"]
            csv_lines = [",".join(header)]
            for idx, r in enumerate(rows, 1):
                raw_file = r["file"]
                file_name = Path(raw_file).name
                if test_security == "csv_injection" and idx == 1:
                    csv_lines.append(f"{file_name},=20+5,Male,East Asian,False")
                else:
                    csv_lines.append(
                        f"{file_name},{r.get('age', '')},{r.get('gender', '')},{r.get('race', '')},{r.get('service_test', '')}"
                    )
            zf.writestr(csv_filename, "\n".join(csv_lines))

        # Add image files
        added_files = set()
        for idx, r in enumerate(rows, 1):
            raw_file = r["file"]
            file_name = Path(raw_file).name
            src_img = val_img_dir / file_name
            if not src_img.exists():
                src_img = dataset_path / raw_file

            if src_img.exists() and file_name not in added_files:
                img_data = src_img.read_bytes()

                # Test magic bytes tampering: corrupt the first file
                if test_security == "fake_magic" and idx == 1:
                    img_data = b"MZ\x90\x00\x03\x00\x00\x00fake_executable_not_an_image"

                zf.writestr(file_name, img_data)
                added_files.add(file_name)

        # Test Zip Slip attack by injecting ../../etc/malicious.txt
        if test_security == "zip_slip":
            zf.writestr("../../etc/malicious_test.txt", "MALICIOUS PATH TRAVERSAL CONTENT")

    file_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(
        f"Successfully created {output_zip} ({file_size_mb:.2f} MB, {len(added_files)} images, {len(rows)} records)."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Package FairFace dataset for bulk import")
    parser.add_argument(
        "--src-dir",
        default="/home/ubuntu/03_Project/emanagement-cv-toolkit/data/fairface",
        help="Source directory of FairFace dataset",
    )
    parser.add_argument(
        "--output",
        default="/tmp/fairface_test.zip",
        help="Destination path of generated ZIP file",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=100,
        help="Number of records to package (0 for all)",
    )
    parser.add_argument(
        "--format",
        choices=["fairface", "standard"],
        default="fairface",
        help="CSV schema format",
    )
    parser.add_argument(
        "--test-security",
        choices=["zip_slip", "fake_magic", "csv_injection"],
        default=None,
        help="Inject specific security test vector",
    )

    args = parser.parse_args()
    generate_package(
        args.src_dir,
        args.output,
        count=args.count,
        csv_format=args.format,
        test_security=args.test_security,
    )
