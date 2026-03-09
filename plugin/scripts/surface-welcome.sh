#!/usr/bin/env bash
set -euo pipefail

# Drain stdin (hook receives JSON input we don't need)
cat > /dev/null

BANNER='Surface Protocol ready\n  Capture:   /surface:capture    — ingest PRD/issue/description\n  Ship:      /surface:ship       — capture + implement\n  Implement: /surface:implement  — pick up pending stubs\n  Check:     /surface:check      — validate coverage\n  Problem:   /surface:problem    — systematic problem resolution\n  Learn:     /surface:learn      — extract learnings from thread'

printf '{"systemMessage":"%s"}\n' "$BANNER"
