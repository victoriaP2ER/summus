#!/bin/bash
# Runs a command with the Node version this project expects (see .nvmrc).
# The system node on some machines is too old for Next 16, and Turbopack spawns
# helper processes off PATH — so PATH has to be fixed up, not just the binary.
set -e
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null 2>&1 || true
fi
exec "$@"
