#!/usr/bin/env bash
#
# Install, verify or uninstall @mfallah/dsh-mcp-studio in a DeepSeek Harness
# profile. Git-Bash / WSL / macOS / Linux counterpart of install.ps1.
#
# The plugin ships its own bundle layer (package.json -> dsh.bundle.patch), so a
# single `dsh plugin --profile <p> add <source>` activates it. This script adds
# the safety around that command:
#
#   * refuses to run against a profile that does not exist;
#   * copies the profile's package.json and cordis.patch.yml into a timestamped
#     backup before touching anything;
#   * is idempotent - running it twice installs once and creates one backup;
#   * --dry-run prints every operation and changes nothing;
#   * --uninstall removes only what this script added.
#
# Nothing outside the chosen profile and $DSH_HOME/mcp-studio/backups/ is ever
# written. Files this script did not create are never deleted.
#
# Usage:
#   ./install.sh [options]
#
# Options:
#   -p, --profile <name>   Profile under $DSH_HOME/profiles (default: web)
#       --dsh-home <dir>   Harness home (default: $DSH_HOME, then $HOME/.dsh)
#   -s, --source <spec>    Path, tarball or package spec to install
#                          (default: this repository)
#       --from-github      Install github:mfallah/dsh-mcp-studio (needs git on
#                          PATH; the repo ships the built lib/, so no build step)
#       --manual           Also append a managed insert entry to cordis.patch.yml
#       --uninstall        Remove the plugin and the managed patch block
#   -n, --dry-run          Print the plan; change nothing
#       --skip-verify      Do not run `dsh --dump-config` afterwards
#   -f, --force            Reinstall even when the dependency is already present
#   -h, --help             Show this help
#
# License: MIT.

set -euo pipefail

PACKAGE_NAME='@mfallah/dsh-mcp-studio'
PANEL_ID='mcp-studio'
GITHUB_SPEC='github:mfallah/dsh-mcp-studio'
GUI_URL='http://127.0.0.1:3080'
PATCH_BEGIN='# >>> dsh-mcp-studio (managed by install.sh) >>>'
PATCH_END='# <<< dsh-mcp-studio <<<'

PROFILE='web'
DSH_HOME_ARG=''
SOURCE=''
FROM_GITHUB=0
MANUAL=0
UNINSTALL=0
DRY_RUN=0
SKIP_VERIFY=0
FORCE=0

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

head_() { printf '\n== %s\n' "$1"; }
info()  { printf '   %s\n' "$1"; }
ok()    { printf '   [ok] %s\n' "$1"; }
warn()  { printf '   [warn] %s\n' "$1"; }
fail()  { printf '   [fail] %s\n' "$1" >&2; }
plan()  { printf '   [dry-run] %s\n' "$1"; }

die() { fail "$1"; printf '\n'; info 'No profile file was modified by this failure. Re-run with --dry-run to see the plan first.'; exit 1; }

usage() {
  cat <<'USAGE'
Install, verify or uninstall @mfallah/dsh-mcp-studio in a DeepSeek Harness profile.

Usage:
  bash install.sh [options]

Options:
  -p, --profile <name>   Profile under $DSH_HOME/profiles (default: web)
      --dsh-home <dir>   Harness home (default: $DSH_HOME, then $HOME/.dsh)
  -s, --source <spec>    Path, tarball or package spec to install
                         (default: this repository)
      --from-github      Install github:mfallah/dsh-mcp-studio (needs git on
                         PATH; the repo ships the built lib/, so no build step)
      --manual           Also append a managed insert entry to cordis.patch.yml
      --uninstall        Remove the plugin and the managed patch block
  -n, --dry-run          Print the plan; change nothing
      --skip-verify      Do not run `dsh --dump-config` afterwards
  -f, --force            Reinstall even when the dependency is already present
  -h, --help             Show this help
USAGE
}

# JSON-escape a string (backslashes and double quotes) for the backup manifest.
json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    -p|--profile)    PROFILE="${2:-}"; shift 2 ;;
    --dsh-home)      DSH_HOME_ARG="${2:-}"; shift 2 ;;
    -s|--source)     SOURCE="${2:-}"; shift 2 ;;
    --from-github)   FROM_GITHUB=1; shift ;;
    --manual)        MANUAL=1; shift ;;
    --uninstall)     UNINSTALL=1; shift ;;
    -n|--dry-run)    DRY_RUN=1; shift ;;
    --skip-verify)   SKIP_VERIFY=1; shift ;;
    -f|--force)      FORCE=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

[ -n "$PROFILE" ] || die '--profile needs a value'

if [ "$FROM_GITHUB" -eq 1 ] && [ -n "$SOURCE" ]; then
  die 'Use either --from-github or --source, not both.'
fi

if [ "$FROM_GITHUB" -eq 1 ]; then
  SOURCE="$GITHUB_SPEC"
elif [ -z "$SOURCE" ] && [ "$UNINSTALL" -eq 0 ]; then
  SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

if [ -n "$DSH_HOME_ARG" ]; then
  DSH_HOME="$DSH_HOME_ARG"
elif [ -n "${DSH_HOME:-}" ]; then
  DSH_HOME="$DSH_HOME"
else
  DSH_HOME="$HOME/.dsh"
fi

[ -d "$DSH_HOME" ] || die "Harness home not found: $DSH_HOME (pass --dsh-home, or set DSH_HOME)."
DSH_HOME="$(cd "$DSH_HOME" && pwd)"

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
if [ ! -d "$PROFILE_DIR" ]; then
  available=''
  if [ -d "$DSH_HOME/profiles" ]; then
    for candidate in "$DSH_HOME"/profiles/*/; do
      [ -d "$candidate" ] || continue
      if [ -f "$candidate/package.json" ] || [ -f "$candidate/cordis.yml" ]; then
        available="$available$(basename "$candidate") "
      fi
    done
  fi
  [ -n "$available" ] || available='(none)'
  die "Profile '$PROFILE' not found at $PROFILE_DIR. Available profiles: $available"
fi

PROFILE_PACKAGE_JSON="$PROFILE_DIR/package.json"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
BACKUP_ROOT="$DSH_HOME/mcp-studio/backups"

command -v dsh >/dev/null 2>&1 || die "The 'dsh' command was not found on PATH. Install DeepSeek Harness first."

# ---------------------------------------------------------------------------
# Probes
# ---------------------------------------------------------------------------

has_dependency() {
  [ -f "$PROFILE_PACKAGE_JSON" ] || return 1
  grep -Fq "\"$PACKAGE_NAME\"" "$PROFILE_PACKAGE_JSON"
}

has_patch_block() {
  [ -f "$PATCH_FILE" ] || return 1
  grep -qxF "$PATCH_BEGIN" "$PATCH_FILE"
}

# Deliberately pipe-free: `dsh ... | grep -q` would let grep close the pipe early,
# and `set -o pipefail` would then report a false failure via SIGPIPE.
composed_has_plugin() {
  dump="$(dsh --profile "$PROFILE" --dump-config 2>/dev/null || true)"
  case "$dump" in
    *"$PACKAGE_NAME"*) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------

# Prints the backup directory it created.
new_backup() {
  mode="$1"
  stamp="$(date +%Y%m%d-%H%M%S)"
  dir="$BACKUP_ROOT/$stamp"
  n=1
  while [ -e "$dir" ]; do
    n=$((n + 1))
    dir="$BACKUP_ROOT/$stamp-$n"
  done
  mkdir -p "$dir"

  copied=''
  for name in package.json cordis.patch.yml; do
    if [ -f "$PROFILE_DIR/$name" ]; then
      cp -p "$PROFILE_DIR/$name" "$dir/$name"
      copied="$copied\"$name\","
    fi
  done

  cat > "$dir/manifest.json" <<EOF
{
  "tool": "dsh-mcp-studio/install.sh",
  "package": "$PACKAGE_NAME",
  "profile": "$(json_escape "$PROFILE")",
  "dshHome": "$(json_escape "$DSH_HOME")",
  "profileDir": "$(json_escape "$PROFILE_DIR")",
  "mode": "$(json_escape "$mode")",
  "source": "$(json_escape "$SOURCE")",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "copiedFiles": [${copied%,}],
  "patchBegin": "$(json_escape "$PATCH_BEGIN")",
  "patchEnd": "$(json_escape "$PATCH_END")"
}
EOF
  printf '%s\n' "$dir"
}

# ---------------------------------------------------------------------------
# Managed patch block
# ---------------------------------------------------------------------------

# Returns 0 when it appended the block, 1 when the block was already there.
append_patch_block() {
  if has_patch_block; then
    info "managed patch block already present in $PATCH_FILE - leaving it alone"
    return 1
  fi

  if [ -f "$PATCH_FILE" ]; then
    # An empty flow root `[]` cannot also carry a list item; drop just that line.
    live="$(grep -vE '^[[:space:]]*(#|$)' "$PATCH_FILE" | tr -d '[:space:]' || true)"
    if [ "$live" = '[]' ]; then
      tmp="$PATCH_FILE.tmp.$$"
      grep -vE '^[[:space:]]*\[\][[:space:]]*$' "$PATCH_FILE" > "$tmp" || true
      mv "$tmp" "$PATCH_FILE"
    fi
    # Make sure the file ends with a newline before appending.
    [ -s "$PATCH_FILE" ] && [ "$(tail -c 1 "$PATCH_FILE" | wc -l)" -eq 0 ] && printf '\n' >> "$PATCH_FILE"
  fi

  {
    printf '%s\n' "$PATCH_BEGIN"
    printf '%s\n' '# Added by install.sh. Do not hand-edit this block; re-run install.sh --uninstall to remove it.'
    printf '%s\n' '- insert:'
    printf '    - id: %s\n' "$PANEL_ID"
    printf "      name: '%s'\n" "$PACKAGE_NAME"
    printf '%s\n' '      config:'
    printf '%s\n' '        catalogEnabled: true'
    printf '%s\n' '        registryUrl: https://registry.modelcontextprotocol.io'
    printf '%s\n' '        probeTimeoutMs: 15000'
    printf '%s\n' "$PATCH_END"
  } >> "$PATCH_FILE"
  return 0
}

# Returns 0 when it removed the block, 1 when there was nothing to remove.
remove_patch_block() {
  has_patch_block || return 1
  tmp="$PATCH_FILE.tmp.$$"
  awk -v b="$PATCH_BEGIN" -v e="$PATCH_END" '
    $0 == b { inside = 1; next }
    $0 == e { inside = 0; next }
    !inside { print }
  ' "$PATCH_FILE" > "$tmp"

  remaining="$(cat "$tmp")"
  rm -f "$tmp"
  if [ -z "$remaining" ]; then
    printf '[]\n' > "$PATCH_FILE"
  else
    printf '%s\n' "$remaining" > "$PATCH_FILE"
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

print_next_steps() {
  head_ 'Next step'
  info '1. Restart the harness so it re-resolves the plugin list:'
  info '     stop the running harness, then start it again with:  dsh web'
  info "2. Open $GUI_URL in your browser."
  info "3. Click the 'MCP Studio' icon (panel id '$PANEL_ID') in the left sidebar."
  printf '\n'
  info 'If the plugin is already installed and you only changed cordis.patch.yml,'
  info "the profile's patchReload: live picks it up without a restart."
}

verify_composed() {
  head_ 'Verify'
  info "running: dsh --profile $PROFILE --dump-config"
  if composed_has_plugin; then
    ok "composed config contains $PACKAGE_NAME"
    return 0
  fi
  fail "composed config does NOT contain $PACKAGE_NAME"
  return 1
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

do_install() {
  already=0
  has_dependency && already=1
  block_present=0
  has_patch_block && block_present=1

  mode='path'
  [ "$FROM_GITHUB" -eq 1 ] && mode='github'
  [ "$MANUAL" -eq 1 ] && mode='manual'

  head_ 'Plan'
  info "profile      : $PROFILE"
  info "profile dir  : $PROFILE_DIR"
  info "source       : $SOURCE"
  info "package      : $PACKAGE_NAME"
  if [ "$already" -eq 1 ]; then
    info 'dependency   : already present'
  else
    info 'dependency   : will be added'
  fi
  info "backup root  : $BACKUP_ROOT"
  if [ "$MANUAL" -eq 1 ]; then
    if [ "$block_present" -eq 1 ]; then
      info 'cordis.patch : managed block already present'
    else
      info 'cordis.patch : will append managed block'
    fi
  else
    info 'cordis.patch : not touched (the package carries its own bundle patch)'
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    head_ 'Dry run'
    plan "mkdir $BACKUP_ROOT"
    for name in package.json cordis.patch.yml; do
      if [ -f "$PROFILE_DIR/$name" ]; then
        plan "copy $PROFILE_DIR/$name -> <timestamp>/$name"
      else
        plan "skip missing $PROFILE_DIR/$name"
      fi
    done
    plan "write <timestamp>/manifest.json (mode=$mode, source=$SOURCE)"
    if [ "$already" -eq 1 ] && [ "$FORCE" -eq 0 ]; then
      plan "skip: dsh plugin --profile $PROFILE add \"$SOURCE\" (dependency already present)"
    else
      plan "run: dsh plugin --profile $PROFILE add \"$SOURCE\""
    fi
    if [ "$MANUAL" -eq 1 ] && [ "$block_present" -eq 0 ]; then
      plan "append managed insert block to $PATCH_FILE"
    fi
    if [ "$SKIP_VERIFY" -eq 0 ]; then
      plan "run: dsh --profile $PROFILE --dump-config  (expect $PACKAGE_NAME)"
    fi
    printf '\n'
    ok 'dry run complete - no file was created, changed or deleted'
    return 0
  fi

  head_ 'Backup'
  backup_dir="$(new_backup "$mode")"
  ok "backup written to $backup_dir"

  if [ "$MANUAL" -eq 1 ] && [ "$block_present" -eq 0 ]; then
    head_ 'Patch layer'
    if append_patch_block; then
      ok "appended managed insert block to $PATCH_FILE"
    fi
  fi

  head_ 'Install'
  if [ "$already" -eq 1 ] && [ "$FORCE" -eq 0 ]; then
    ok "dependency $PACKAGE_NAME is already in $PROFILE_PACKAGE_JSON - not adding it again"
    info 'pass --force to re-run the add command anyway'
  else
    info "running: dsh plugin --profile $PROFILE add \"$SOURCE\""
    if ! dsh plugin --profile "$PROFILE" add "$SOURCE"; then
      fail "dsh plugin add failed"
      info "your profile files were backed up in $backup_dir"
      return 1
    fi
    ok 'dsh plugin add completed'
  fi

  if [ "$SKIP_VERIFY" -eq 1 ]; then
    warn 'verification skipped (--skip-verify)'
  else
    if ! verify_composed; then
      warn 'the plugin was installed but does not appear in the composed config.'
      warn "Your pre-install files are in $backup_dir."
      warn 'Re-run with --manual to add an explicit cordis.patch.yml entry, or restore the backup.'
      return 1
    fi
  fi

  print_next_steps
  printf '\n'
  ok "installed $PACKAGE_NAME into profile '$PROFILE'"
  return 0
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

do_uninstall() {
  has_dep=0
  has_dependency && has_dep=1
  has_block=0
  has_patch_block && has_block=1

  head_ 'Plan'
  info "profile      : $PROFILE"
  if [ "$has_dep" -eq 1 ]; then
    info 'dependency   : will be removed'
  else
    info 'dependency   : not present'
  fi
  if [ "$has_block" -eq 1 ]; then
    info 'cordis.patch : managed block will be removed'
  else
    info 'cordis.patch : no managed block'
  fi
  info 'other files  : never touched'

  if [ "$has_dep" -eq 0 ] && [ "$has_block" -eq 0 ]; then
    printf '\n'
    ok "$PACKAGE_NAME is not installed in profile '$PROFILE' - nothing to do"
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    head_ 'Dry run'
    for name in package.json cordis.patch.yml; do
      if [ -f "$PROFILE_DIR/$name" ]; then
        plan "copy $PROFILE_DIR/$name -> <timestamp>/$name (safety backup before uninstall)"
      fi
    done
    if [ "$has_block" -eq 1 ]; then
      plan "remove managed block ($PATCH_BEGIN ... $PATCH_END) from $PATCH_FILE"
    fi
    if [ "$has_dep" -eq 1 ]; then
      plan "run: dsh plugin --profile $PROFILE remove $PACKAGE_NAME"
    fi
    plan "run: dsh --profile $PROFILE --dump-config  (expect $PACKAGE_NAME to be gone)"
    printf '\n'
    ok 'dry run complete - no file was created, changed or deleted'
    return 0
  fi

  head_ 'Backup'
  backup_dir="$(new_backup 'uninstall')"
  ok "safety backup written to $backup_dir"

  if [ "$has_block" -eq 1 ]; then
    head_ 'Patch layer'
    if remove_patch_block; then
      ok "removed managed block from $PATCH_FILE"
    fi
  fi

  head_ 'Uninstall'
  if [ "$has_dep" -eq 1 ]; then
    info "running: dsh plugin --profile $PROFILE remove $PACKAGE_NAME"
    if ! dsh plugin --profile "$PROFILE" remove "$PACKAGE_NAME"; then
      fail 'dsh plugin remove failed'
      warn "Restore manually from $backup_dir if the profile looks wrong."
      return 1
    fi
    ok 'dependency removed'
  else
    info 'dependency was not present - nothing to remove'
  fi

  if [ "$SKIP_VERIFY" -eq 0 ]; then
    head_ 'Verify'
    info "running: dsh --profile $PROFILE --dump-config"
    if composed_has_plugin; then
      warn "$PACKAGE_NAME still appears in the composed config."
      warn "Restore $PROFILE_PACKAGE_JSON and $PATCH_FILE from $backup_dir if needed, then restart the harness."
    else
      ok "$PACKAGE_NAME is gone from the composed config"
    fi
  fi

  head_ 'Next step'
  info 'Restart the harness: stop the running process, then run  dsh web'
  printf '\n'
  ok "uninstalled $PACKAGE_NAME from profile '$PROFILE'"
  return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

printf 'dsh-mcp-studio installer\n'
info "dsh home : $DSH_HOME"
info "profile  : $PROFILE ($PROFILE_DIR)"
if [ "$DRY_RUN" -eq 1 ]; then warn 'DRY RUN - nothing will be changed'; fi

# A github: spec is fetched with the git binary. The repository ships the built
# lib/, so no build step is involved - only git itself must be reachable.
if [ "$FROM_GITHUB" -eq 1 ] && ! command -v git >/dev/null 2>&1; then
  warn 'git was not found on PATH, but --from-github needs it to fetch the repository.'
  info 'Install git, or pass --source with a local clone or tarball instead.'
fi

if [ "$UNINSTALL" -eq 1 ]; then
  do_uninstall
else
  do_install
fi
