#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Next.js loads .env.local automatically when it exists.
exec npm run dev
