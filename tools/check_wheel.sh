#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
python -m pip wheel --no-deps "$root" -w "$tmp/dist"
python -m venv "$tmp/venv"
"$tmp/venv/bin/python" -m pip install --no-deps "$tmp"/dist/*.whl
export PATH="$tmp/venv/bin:$PATH"
cd "$tmp"
python "$root/tools/verify_installed.py" "$root/docs/controls.json"
