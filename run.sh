#!/usr/bin/env bash
# Semiclaw Code CLI launcher
# This script runs Semiclaw Code from source with proper Bun execution

# Ensure we're using the right bun installation
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed or not in PATH"
    echo "Please install bun from https://bun.sh/docs/installation"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the main entrypoint with bun
exec bun run -r "$SCRIPT_DIR/src/entrypoints/preload.js" "$SCRIPT_DIR/src/entrypoints/cli.tsx" "$@"
