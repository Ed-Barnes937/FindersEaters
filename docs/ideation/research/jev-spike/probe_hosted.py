#!/usr/bin/env python3
"""Hosted Clef probes on Workers AI: model listing, latency breakdown, serving location.

Dev data only: the one full-size request is built from a dev golden line. Reads
CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN from env. Neither value, the request
URL, nor any auth header is ever printed or written; only whitelisted response headers
are shown.

    python3 probe_hosted.py models
    python3 probe_hosted.py latency --model @cf/cloudflare/clef [--n 20]
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import http.client
import json
import os
import socket
import ssl
import statistics
import sys
import time

import run_spike as R

HOST = "api.cloudflare.com"
SHOW_HEADERS = {"cf-ray", "server-timing", "cf-ai-model", "cf-ai-latency", "x-envoy-upstream-service-time"}


def env() -> tuple[str, str]:
    acct, tok = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip(), os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not acct or not tok:
        sys.exit("credentials not in env; nothing called")
    return acct, tok


ACCT, TOK = env()
SECRETS = [ACCT, TOK]


def scrub(s: str) -> str:
    for v in SECRETS:
        s = s.replace(v, "<redacted>")
    return s


def request(conn: http.client.HTTPSConnection, method: str, path: str, body: dict | None = None):
    hdrs = {"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"}
    t0 = time.perf_counter()
    conn.request(method, path, body=json.dumps(body).encode() if body is not None else None, headers=hdrs)
    resp = conn.getresponse()
    t_head = time.perf_counter()
    data = resp.read()
    t1 = time.perf_counter()
    if resp.status != 200:
        sys.exit(f"HTTP {resp.status}")
    headers = {k.lower(): v for k, v in resp.getheaders()}
    return json.loads(data), headers, t_head - t0, t1 - t0


def new_conn() -> tuple[http.client.HTTPSConnection, float, float]:
    """Open a connection and time TCP and TLS separately."""
    t0 = time.perf_counter()
    sock = socket.create_connection((HOST, 443), timeout=30)
    t1 = time.perf_counter()
    ctx = ssl.create_default_context()
    ssock = ctx.wrap_socket(sock, server_hostname=HOST)
    t2 = time.perf_counter()
    conn = http.client.HTTPSConnection(HOST, timeout=30, context=ctx)
    conn.sock = ssock
    return conn, t1 - t0, t2 - t1


def ms(xs):
    xs = sorted(xs)
    p95 = xs[min(len(xs) - 1, int(round(0.95 * (len(xs) - 1))))]
    return f"p50={statistics.median(xs) * 1000:.0f} p95={p95 * 1000:.0f} min={xs[0] * 1000:.0f} max={xs[-1] * 1000:.0f} ms (n={len(xs)})"


def cmd_models(_args):
    conn, _, _ = new_conn()
    data, _, _, _ = request(conn, "GET", f"/client/v4/accounts/{ACCT}/ai/models/search?search=clef&per_page=50")
    for m in data.get("result", []):
        props = {p.get("property_id"): p.get("value") for p in m.get("properties", [])}
        print(scrub(json.dumps({"name": m.get("name"), "id": m.get("id"), "created_at": m.get("created_at"),
                          "task": (m.get("task") or {}).get("name"), "properties": props}, ensure_ascii=False)))
    for name in sorted({m.get("name") for m in data.get("result", [])}):
        try:
            sch, _, _, _ = request(conn, "GET", f"/client/v4/accounts/{ACCT}/ai/models/schema?model={name}")
        except SystemExit as e:
            print(name, "schema:", e)
            continue
        out = json.dumps(sch.get("result", {}).get("output", {}))
        i = out.find("confidence")
        print(name, "schema output 'confidence' context:", scrub(out[max(0, i - 200): i + 400]) if i >= 0 else "(none)")


def trivial(model: str) -> dict:
    return {"model": model.rsplit("/", 1)[-1], "state": {"x": "a"},
            "questions": {"q": R.choice("Is `x` a letter?", {"yes": None, "no": None})}}


def full(model: str) -> dict:
    import json as _j
    golden = _j.loads((R.HERE / "golden.json").read_text())
    item = next(it for it in golden["lines"] if it["id"] == "L02")
    assert item.get("set", "dev") == "dev"
    R.FRAMING = "v2"
    payload, _ = R.build_line_request(item)
    return {**payload, "model": model.rsplit("/", 1)[-1]}


def cmd_latency(args):
    path = f"/client/v4/accounts/{ACCT}/ai/run/{args.model}"
    for label, body in (("trivial", trivial(args.model)), ("full L02", full(args.model))):
        # 1. fresh connection per request (what run_spike.py's urllib does)
        tcp, tls, head, tot, rays, toks = [], [], [], [], set(), 0
        for _ in range(args.n):
            conn, a, b = new_conn()
            data, h, th, tt = request(conn, "POST", path, body)
            conn.close()
            tcp.append(a); tls.append(b); head.append(th); tot.append(a + b + tt)
            rays.add(h.get("cf-ray", "?").rsplit("-", 1)[-1])
            toks = data.get("result", {}).get("usage", {}).get("input_tokens", toks)
        print(f"[{label}] input_tokens={toks} colos={sorted(rays)}")
        print(f"  fresh conn: tcp {ms(tcp)}")
        print(f"  fresh conn: tls {ms(tls)}")
        print(f"  fresh conn: request->headers {ms(head)}")
        print(f"  fresh conn: total {ms(tot)}")
        # 2. one kept-alive connection
        conn, _, _ = new_conn()
        warm = []
        for i in range(args.n):
            data, h, th, tt = request(conn, "POST", path, body)
            warm.append(tt)
            if i == 0:
                print("  response header names:", sorted(h))
                print("  whitelisted headers:", {k: scrub(v) for k, v in h.items() if k in SHOW_HEADERS})
        conn.close()
        print(f"  keep-alive: {ms(warm)}")
        # 3. 8 concurrent, each with its own kept-alive connection
        def worker(_):
            c, _, _ = new_conn()
            out = []
            for _ in range(max(2, args.n // 4)):
                out.append(request(c, "POST", path, body)[3])
            c.close()
            return out
        with cf.ThreadPoolExecutor(8) as ex:
            conc = [x for r in ex.map(worker, range(8)) for x in r]
        print(f"  8 concurrent keep-alive: {ms(conc)}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("models")
    lat = sub.add_parser("latency")
    lat.add_argument("--model", default="@cf/cloudflare/clef")
    lat.add_argument("--n", type=int, default=20)
    args = ap.parse_args()
    {"models": cmd_models, "latency": cmd_latency}[args.cmd](args)


if __name__ == "__main__":
    main()
