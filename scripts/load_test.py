#!/usr/bin/env python3
"""Concurrent camera clients plus malformed burst. Reports measured numbers only."""
from __future__ import annotations
import argparse, asyncio, io, json, os, statistics, time, resource
from pathlib import Path

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def jpeg_bytes(size=(320, 240)):
    b = io.BytesIO()
    Image.new("RGB", size, "gray").save(b, format="JPEG")
    return b.getvalue()


async def ping(client, path):
    t0 = time.perf_counter()
    r = await client.get(path)
    return r.status_code, (time.perf_counter() - t0) * 1000, r.headers.get("retry-after")


async def post_file(client, name, raw, mime):
    t0 = time.perf_counter()
    r = await client.post("/api/detect", files={"file": (name, raw, mime)})
    return r.status_code, (time.perf_counter() - t0) * 1000, r.headers.get("retry-after")


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default=os.getenv("WILDID_BASE", "http://127.0.0.1:8000"))
    p.add_argument("--clients", type=int, default=8)
    p.add_argument("--seconds", type=float, default=8)
    args = p.parse_args()
    frame = jpeg_bytes()
    health_ms = []
    codes = {}
    start = time.perf_counter()
    async with httpx.AsyncClient(base_url=args.base, timeout=20.0) as client:
        h0 = await ping(client, "/api/health")
        codes[h0[0]] = codes.get(h0[0], 0) + 1

        async def camera():
            end = time.perf_counter() + args.seconds
            while time.perf_counter() < end:
                try:
                    status, ms, _ = await post_file(client, "camera-frame.jpg", frame, "image/jpeg")
                except Exception:
                    status, ms = 0, 0
                codes[status] = codes.get(status, 0) + 1
                hs, hms, _ = await ping(client, "/api/health")
                health_ms.append(hms)
                codes[hs] = codes.get(hs, 0) + 1
                await asyncio.sleep(0.05)

        await asyncio.gather(*(camera() for _ in range(args.clients)))
        burst = [
            post_file(client, "x.jpg", b"x" * (8 * 1024 * 1024 + 10), "image/jpeg"),
            post_file(client, "x.svg", b"<svg/>", "image/svg+xml"),
            post_file(client, "x.jpg", b"not-image", "image/jpeg"),
            post_file(client, "x.jpg", b"\xff\xd8\xffbad", "image/jpeg"),
        ]
        for coro in burst:
            try:
                status, ms, _ = await coro
            except Exception:
                status = 0
            codes[status] = codes.get(status, 0) + 1
        after = []
        for _ in range(5):
            hs, hms, _ = await ping(client, "/api/health")
            after.append(hms)
            codes[hs] = codes.get(hs, 0) + 1
        ready = (await client.get("/api/ready")).json()
    elapsed = time.perf_counter() - start
    report = {
        "elapsed_s": round(elapsed, 2),
        "clients": args.clients,
        "status_counts": codes,
        "health_ms_median": round(statistics.median(health_ms), 2) if health_ms else None,
        "health_ms_p95": round(sorted(health_ms)[int(0.95 * (len(health_ms) - 1))], 2) if health_ms else None,
        "health_after_burst_ms": [round(x, 2) for x in after],
        "ready": ready,
        "pass_health_fast": bool(health_ms) and statistics.median(health_ms) < 500,
        "rss_kb_end": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "allowed_error_codes_only": all(
            c in {0, 200, 413, 415, 422, 429, 503, 504} for c in codes
        ),
    }
    out = ROOT / "docs" / "load-test-results.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["pass_health_fast"] or not report["allowed_error_codes_only"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
