import os
import sys
import time
import tarfile
import urllib.request

DEST_DIR = os.path.abspath("apps/cv-service/data/lfw")
ARCHIVE_PATH = os.path.join(DEST_DIR, "lfw-funneled.tgz")
PAIRS_PATH = os.path.join(DEST_DIR, "pairs.txt")
EXTRACT_DIR = os.path.join(DEST_DIR, "lfw_funneled")

URL_PAIRS = "https://ndownloader.figshare.com/files/5976006"
URL_DATASET = "https://ndownloader.figshare.com/files/5976015"

def download_file(url: str, dest_path: str, desc: str):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if os.path.exists(dest_path):
        size_mb = os.path.getsize(dest_path) / (1024 * 1024)
        print(f"[{desc}] File already exists ({size_mb:.2f} MB): {dest_path}")
        return

    print(f"[{desc}] Downloading from {url}...")
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    start_time = time.time()
    last_print = start_time
    downloaded = 0

    with urllib.request.urlopen(req, timeout=30) as resp, open(dest_path + ".tmp", "wb") as f:
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

    os.rename(dest_path + ".tmp", dest_path)
    total_time = time.time() - start_time
    print(f"[{desc}] Download complete in {total_time:.1f}s ({os.path.getsize(dest_path) / 1024 / 1024:.1f} MB).")

def extract_archive(archive_path: str, extract_dir: str):
    if os.path.exists(extract_dir) and os.listdir(extract_dir):
        print(f"[Extract] Target directory already contains files: {extract_dir}")
        return

    print(f"[Extract] Extracting {archive_path} to {DEST_DIR}...")
    start_time = time.time()
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(path=DEST_DIR)
    print(f"[Extract] Extraction complete in {time.time() - start_time:.1f}s.")

if __name__ == "__main__":
    download_file(URL_PAIRS, PAIRS_PATH, "Pairs Metadata")
    download_file(URL_DATASET, ARCHIVE_PATH, "LFW Dataset Archive")
    extract_archive(ARCHIVE_PATH, EXTRACT_DIR)
    print(f"[Ready] Dataset is ready at: {EXTRACT_DIR}")
