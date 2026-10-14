#!/usr/bin/env bash
#
# Offline tests for install.sh's backup, patch-block and dry-run behaviour.
#
# Runs entirely against a throwaway temp DSH_HOME and a stub `dsh` command.
# Nothing in the real $DSH_HOME is read or written; no package manager runs.
#
# Covers:
#   * --dry-run leaves the profile byte-identical and creates no backup
#   * a real run backs both managed files up before touching them
#   * --manual appends its block exactly once across two runs (idempotent)
#   * --uninstall removes exactly that block and leaves other entries alone
#   * running --uninstall twice is a no-op
#
# Usage: bash scripts/test-install.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"

PACKAGE_NAME='@mfallah/dsh-mcp-studio'
PATCH_BEGIN='# >>> dsh-mcp-studio (managed by install.sh) >>>'

PASSED=0
FAILED=0

ok()   { PASSED=$((PASSED + 1)); printf '  ok   %s\n' "$1"; }
bad()  { FAILED=$((FAILED + 1)); printf '  FAIL %s\n' "$1"; }
check() { if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (expected '$2', got '$1')"; fi; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/mcp-studio-sh-test-XXXXXX")"
cleanup() { case "$WORK" in */mcp-studio-sh-test-*) rm -rf "$WORK" ;; esac; }
trap cleanup EXIT

HOME_DIR="$WORK/home"
PROFILE_DIR="$HOME_DIR/profiles/web"
STUB_DIR="$WORK/bin"
mkdir -p "$PROFILE_DIR" "$STUB_DIR"

# --- stub dsh ---------------------------------------------------------------
cat > "$STUB_DIR/dsh" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  plugin) echo "[stub] dsh $*"; exit 0 ;;
esac
case "$*" in
  *--dump-config*) echo "name: '@mfallah/dsh-mcp-studio'"; exit 0 ;;
esac
exit 0
STUB
chmod +x "$STUB_DIR/dsh"
export PATH="$STUB_DIR:$PATH"

# --- fixtures ---------------------------------------------------------------
cat > "$PROFILE_DIR/package.json" <<'JSON'
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {}
}
JSON

cat > "$PROFILE_DIR/cordis.patch.yml" <<'YAML'
# user layer
- id: user-thing
  name: '@example/user'
YAML

hash_of() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

run() { bash "$INSTALL" --dsh-home "$HOME_DIR" --profile web "$@" >/dev/null 2>&1 || return $?; }

# --- dry run ----------------------------------------------------------------
printf '\n--dry-run\n'
before_pkg="$(hash_of "$PROFILE_DIR/package.json")"
before_patch="$(hash_of "$PROFILE_DIR/cordis.patch.yml")"
run --dry-run || bad 'dry run should exit 0'
check "$(hash_of "$PROFILE_DIR/package.json")" "$before_pkg" 'dry run left package.json byte-identical'
check "$(hash_of "$PROFILE_DIR/cordis.patch.yml")" "$before_patch" 'dry run left cordis.patch.yml byte-identical'
if [ -d "$HOME_DIR/mcp-studio" ]; then bad 'dry run created no backup root'; else ok 'dry run created no backup root'; fi

# --- install with --manual --------------------------------------------------
printf '\n--manual install\n'
run --manual --skip-verify || bad 'install should exit 0'
backups="$(find "$HOME_DIR/mcp-studio/backups" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
check "$backups" '1' 'exactly one backup directory created'
if [ -f "$HOME_DIR/mcp-studio/backups"/*/package.json ]; then ok 'backup contains package.json'; else bad 'backup contains package.json'; fi
if [ -f "$HOME_DIR/mcp-studio/backups"/*/cordis.patch.yml ]; then ok 'backup contains cordis.patch.yml'; else bad 'backup contains cordis.patch.yml'; fi
if [ -f "$HOME_DIR/mcp-studio/backups"/*/manifest.json ]; then ok 'backup contains manifest.json'; else bad 'backup contains manifest.json'; fi
check "$(grep -cF "$PATCH_BEGIN" "$PROFILE_DIR/cordis.patch.yml")" '1' 'patch block appended once'
check "$(grep -cF "user-thing" "$PROFILE_DIR/cordis.patch.yml")" '1' 'pre-existing user entry preserved'

# --- idempotency ------------------------------------------------------------
printf '\n--second run is idempotent\n'
run --manual --skip-verify || bad 'second install should exit 0'
check "$(grep -cF "$PATCH_BEGIN" "$PROFILE_DIR/cordis.patch.yml")" '1' 'second run did not duplicate the patch block'
check "$(grep -cF "$PACKAGE_NAME" "$PROFILE_DIR/cordis.patch.yml")" '1' 'dependency named once in the patch file'

# --- dry-run uninstall ------------------------------------------------------
printf '\n--uninstall dry run\n'
before_patch="$(hash_of "$PROFILE_DIR/cordis.patch.yml")"
run --uninstall --dry-run || bad 'uninstall dry run should exit 0'
check "$(hash_of "$PROFILE_DIR/cordis.patch.yml")" "$before_patch" 'uninstall dry run changed nothing'

# --- uninstall --------------------------------------------------------------
printf '\n--uninstall\n'
run --uninstall --skip-verify || bad 'uninstall should exit 0'
check "$(grep -cF "$PATCH_BEGIN" "$PROFILE_DIR/cordis.patch.yml" || true)" '0' 'patch block removed'
check "$(grep -cF 'user-thing' "$PROFILE_DIR/cordis.patch.yml" || true)" '1' 'user entry survived uninstall'

printf '\n--second uninstall is a no-op\n'
run --uninstall --skip-verify || bad 'second uninstall should exit 0'
check "$(grep -cF 'user-thing' "$PROFILE_DIR/cordis.patch.yml" || true)" '1' 'user entry still intact'

printf '\n'
if [ "$FAILED" -gt 0 ]; then
  printf 'FAILED: %s of %s checks failed\n' "$FAILED" "$((PASSED + FAILED))"
  exit 1
fi
printf 'PASSED: %s checks\n' "$PASSED"
