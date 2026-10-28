#!/usr/bin/env python3
"""Checks fly.toml and fly.staging.toml offline (no flyctl, no Fly API).

Both must parse, match docs/spec/operations.md section 2 (lhr, shared-cpu-1x
512 MB, scale to zero, the release step with a 10 minute timeout) and be
identical apart from the app name, so staging rehearses production's config.
"""

import sys
import tomllib
from pathlib import Path

root = Path(__file__).resolve().parent.parent
apps = {"fly.toml": "finders-eaters", "fly.staging.toml": "finders-eaters-staging"}
errors: list[str] = []
configs = {}

for name, app in apps.items():
    config = tomllib.loads((root / name).read_text())
    configs[name] = config
    expected = {
        "app": app,
        "primary_region": "lhr",
        "deploy.release_command": "node apps/server/src/cli.ts release",
        "deploy.release_command_timeout": "10m",
        "http_service.internal_port": 8080,
        "http_service.auto_stop_machines": "stop",
        "http_service.min_machines_running": 0,
        "http_service.checks.0.path": "/health",
        "vm.0.size": "shared-cpu-1x",
        "vm.0.memory": "512mb",
    }
    for path, want in expected.items():
        value = config
        for key in path.split("."):
            value = value[int(key)] if key.isdigit() else value.get(key)
            if value is None:
                break
        if value != want:
            errors.append(f"{name}: {path} is {value!r}, expected {want!r}")

production = {k: v for k, v in configs["fly.toml"].items() if k != "app"}
staging = {k: v for k, v in configs["fly.staging.toml"].items() if k != "app"}
if production != staging:
    errors.append("fly.toml and fly.staging.toml differ in more than the app name")

for error in errors:
    print(f"::error::{error}")
if errors:
    sys.exit(1)
print("fly configs ok")
