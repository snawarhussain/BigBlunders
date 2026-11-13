#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
destination="${1:-$root/_site}"
room="$root/research-room"

# Fail before touching the output if either build is missing.
test -s "$destination/index.html"
test -s "$room/index.html"
test -s "$room/assets/workstation.glb"
if [[ -e "$destination/research-room" ]]; then
  echo "The Jekyll build already owns /research-room/." >&2
  exit 1
fi

if [[ -e "$destination/portfolio" ]]; then
  echo "The Jekyll build already owns /portfolio/." >&2
  exit 1
fi
mkdir "$destination/research-room" "$destination/portfolio"
# Keep Jekyll's root build and pagination, and adjust the relocated home's
# canonical and Open Graph URL to its published address.
sed -E '/rel="canonical"|property="og:url"/s@(https?://[^/"]+)/"@\1/portfolio/"@'   "$destination/index.html" > "$destination/portfolio/index.html"
cp -R "$room/." "$destination/research-room/"
# The root page references the room's isolated asset directory.
sed 's@<head>@<head>\n<base href="/research-room/">@' "$room/index.html" > "$destination/index.html"
touch "$destination/.nojekyll"
