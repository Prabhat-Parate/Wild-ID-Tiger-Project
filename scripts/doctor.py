#!/usr/bin/env python3
"""Operator checks: cwd, packages, UTF-8, models, port, health/ready."""
from __future__ import annotations
import hashlib, json, os, socket, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check(name, ok, fix=""):
    print(("OK  " if ok else "FAIL") + f" {name}" + ("" if ok else f" — {fix}"))
    return ok


def main():
    os.chdir(ROOT)
    ok = True
    ok &= check("working directory is project root", (ROOT / "backend" / "main.py").is_file(), "cd to the Wild-ID repository")
    ok &= check("Python >= 3.10", sys.version_info >= (3, 10), "Install Python 3.10+")
    try:
        import fastapi, onnxruntime, numpy, PIL, uvicorn  # noqa: F401
        ok &= check("Python packages import", True)
    except Exception as e:
        ok &= check("Python packages import", False, f"pip install -r requirements.txt ({type(e).__name__})")
    sample = ROOT / "data" / "tadoba-species.json"
    try:
        sample.read_text(encoding="utf-8")
        ok &= check("UTF-8 registry read", True)
    except Exception:
        ok &= check("UTF-8 registry read", False, "Save JSON as UTF-8")
    manifest = ROOT / "models" / "tiger-open-vocabulary" / "manifest.json"
    model = ROOT / "models" / "tiger-open-vocabulary" / "model.onnx"
    if manifest.is_file() and model.is_file():
        info = json.loads(manifest.read_text(encoding="utf-8"))
        digest = hashlib.sha256(model.read_bytes()).hexdigest()
        ok &= check("model hash", digest == info.get("sha256", {}).get("model.onnx"), "Run python scripts/setup_detector.py")
    else:
        ok &= check("detector files", False, "Run python scripts/setup_detector.py")
    port = int(os.getenv("PORT", "8000"))
    sock = socket.socket()
    sock.settimeout(0.5)
    holding = sock.connect_ex(("127.0.0.1", port)) == 0
    sock.close()
    print(("INFO" if holding else "OK  ") + f" port {port} {'in use' if holding else 'free'}")
    if holding:
        try:
            import urllib.request
            for path in ("/api/health", "/api/ready"):
                with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as r:
                    ok &= check(path, r.status == 200, "Start backend with scripts/start-backend.ps1")
        except Exception:
            ok &= check("live health", False, f"Port {port} is used by another process. Set PORT to a free port.")
    else:
        print("INFO start the backend then re-run doctor for live /api/health")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
