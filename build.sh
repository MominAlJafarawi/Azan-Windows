#!/bin/zsh
# Builds the Windows installer of أذان from the Mac.
#   ./build.sh        -> Windows installer (NSIS) + zip in ./dist
#   ./build.sh run    -> run the app on this Mac for testing (AZAN_DATA / AZAN_SHOW work)
# Sounds, Majed recordings, adhkar and fonts come from ../Azan/Resources (single source with the Mac app).
set -e
cd "$(dirname "$0")"
SRC="$PWD"
MAC="$SRC/../Azan"
STAGE="$HOME/Library/Caches/AzanWinBuild"
mkdir -p "$STAGE"
rsync -a --delete --exclude node_modules --exclude dist --exclude res --exclude '._*' --exclude '.DS_Store' "$SRC/" "$STAGE/src/"
R="$STAGE/src/res"; mkdir -p "$R/sounds" "$R/speech" "$R/fonts" "$STAGE/src/app/fonts" "$STAGE/src/app/img" "$STAGE/src/build"
rsync -a --delete --exclude '._*' "$MAC/Resources/Sounds/" "$R/sounds/"
rsync -a --delete --exclude '._*' "$MAC/Resources/Speech/" "$R/speech/"
rsync -a --exclude '._*' "$MAC/Resources/Fonts/"*.ttf "$R/fonts/"
rsync -a --exclude '._*' "$MAC/Resources/Fonts/"*.ttf "$STAGE/src/app/fonts/"
cp "$MAC/Resources/adhkar.json" "$R/"
# icons from the Mac icon
cp "$MAC/build/icon1024.png" "$STAGE/src/build/icon.png"
sips -z 64 64 "$MAC/build/icon1024.png" --out "$STAGE/src/app/img/tray.png" >/dev/null
# manifest: every file the app needs, checked and repaired at every start
( cd "$R" && find . -type f ! -name manifest.json ! -name '._*' | sed 's|^\./||' | sort | while read f; do printf '%s\t%s\n' "$f" "$(shasum -a 256 "$f" | cut -d' ' -f1)"; done ) \
  | python3 -c "import sys,json; print(json.dumps(dict(l.rstrip('\n').split('\t') for l in sys.stdin), ensure_ascii=False, indent=1))" > "$R/manifest.json"
echo "manifest: $(grep -c '"' "$R/manifest.json") files"
# the prayer engine must match the reference times before anything is built
node "$SRC/tools/selftest.js" "$STAGE/src"
cd "$STAGE/src"
if [ ! -d node_modules ] || [ package.json -nt node_modules/.stamp ]; then
  npm install --no-audit --no-fund
  touch node_modules/.stamp
fi
if [ "$1" = "run" ]; then shift; export AZAN_DATA="${AZAN_DATA:-$HOME/Library/Caches/AzanWinBuild/testdata}"; mkdir -p "$AZAN_DATA"; exec npx electron . "$@"; fi
npx electron-builder --win nsis zip --x64
mkdir -p "$SRC/dist"
cp dist/*.exe dist/*.zip "$SRC/dist/" 2>/dev/null || true
ls -la "$SRC/dist"
