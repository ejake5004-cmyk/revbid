#!/bin/bash
# Double-click this file to start RevBid. Close this window to stop it.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "RevBid needs Node.js, which isn't installed yet."
  echo "Opening the download page. Install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  echo "Your Node.js is version $(node -v), and RevBid needs 22.18 or newer."
  echo "Opening the download page. Install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

echo "Starting RevBid. Your browser will open in a moment."
echo "Leave this window open while you use the site. Close it to stop RevBid."
echo
(sleep 2 && open "http://localhost:3000") &
node --disable-warning=ExperimentalWarning src/server.ts
