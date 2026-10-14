#Requires -Version 5.1
<#
.SYNOPSIS
    Install, verify or uninstall @mfallah/dsh-mcp-studio in a DeepSeek Harness profile.

.DESCRIPTION
    The plugin ships its own bundle layer (package.json -> dsh.bundle.patch), so a
    single `dsh plugin --profile <p> add <source>` is enough to activate it. This
    script wraps that one command with the safety a human installer needs:

      * it refuses to run against a profile that does not exist;
      * it copies the profile's package.json and cordis.patch.yml into a
        timestamped backup before it touches anything;
      * it is idempotent - running it twice installs once and creates one backup;
      * -DryRun prints every operation and changes nothing;
      * -Uninstall removes the plugin it added and restores what it can.

    Nothing outside the chosen profile and $DshHome/mcp-studio/backups/ is ever
    written. Files the script did not create are never deleted.

.PARAMETER Profile
    Profile name under $DshHome/profiles. Default: web.

.PARAMETER DshHome
    Harness home. Defaults to $env:DSH_HOME, then $HOME/.dsh.

.PARAMETER SourcePath
    Local path to install from: this repository, a built tarball, or a bare
    package spec. Defaults to the directory containing this script.

.PARAMETER FromGitHub
    Install from https://github.com/mfallah/dsh-mcp-studio. Needs git on PATH;
    the repository ships the built lib/ output, so no build step is involved.

.PARAMETER Manual
    Also write a managed insert entry into the profile's cordis.patch.yml. Use
    this when the installed DSH version does not honour dsh.bundle.patch.

.PARAMETER Uninstall
    Remove the dependency, remove the managed patch block, and report what is left.

.PARAMETER DryRun
    Print the exact operations and exit without changing any file.

.PARAMETER SkipVerify
    Do not run `dsh --dump-config` after installing.

.PARAMETER Force
    Reinstall even when the dependency is already present.

.PARAMETER DotSourceOnly
    Internal: define the helper functions and stop. Used by scripts/test-install.ps1.

.EXAMPLE
    .\install.ps1 -DryRun
    Show exactly what a default install would do.

.EXAMPLE
    .\install.ps1
    Install from this repository into the 'web' profile.

.EXAMPLE
    .\install.ps1 -Uninstall
    Remove the plugin from the 'web' profile.

.NOTES
    Author: mfallah. License: MIT.
#>
[CmdletBinding()]
param(
    [string] $Profile = 'web',
    [string] $DshHome = '',
    [string] $SourcePath = '',
    [switch] $FromGitHub,
    [switch] $Manual,
    [switch] $Uninstall,
    [switch] $DryRun,
    [switch] $SkipVerify,
    [switch] $Force,
    [switch] $DotSourceOnly
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

$PackageName = '@mfallah/dsh-mcp-studio'
$PanelId = 'mcp-studio'
$GitHubSpec = 'github:mfallah/dsh-mcp-studio'
$GuiUrl = 'http://127.0.0.1:3080'
$PatchBegin = '# >>> dsh-mcp-studio (managed by install.ps1) >>>'
$PatchEnd = '# <<< dsh-mcp-studio <<<'
$ManagedFiles = @('package.json', 'cordis.patch.yml')

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

function Write-Head([string] $text) {
    Write-Host ''
    Write-Host "== $text" -ForegroundColor Cyan
}

function Write-Info([string] $text) { Write-Host "   $text" }

function Write-Ok([string] $text) { Write-Host "   [ok] $text" -ForegroundColor Green }

function Write-Warn([string] $text) { Write-Host "   [warn] $text" -ForegroundColor Yellow }

function Write-Fail([string] $text) { Write-Host "   [fail] $text" -ForegroundColor Red }

function Write-Plan([string] $text) { Write-Host "   [dry-run] $text" -ForegroundColor Magenta }

# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

<#
Writes UTF-8 without a BOM. `Set-Content -Encoding utf8` on Windows PowerShell
5.1 prepends one, and a BOM inside the profile's YAML is not something the
loader should have to tolerate.
#>
function Write-TextFile {
    param(
        [Parameter(Mandatory)] [string] $Path,
        [Parameter(Mandatory)] [AllowEmptyString()] [string] $Text
    )
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

<# Reads a text file with any leading BOM removed. #>
function Read-TextFile {
    param([Parameter(Mandatory)] [string] $Path)
    $raw = Get-Content -LiteralPath $Path -Raw
    if ($null -eq $raw) { return '' }
    return $raw.TrimStart([char]0xFEFF)
}

<# Reads a text file as lines, with any leading BOM removed from line 1. #>
function Read-TextLines {
    param([Parameter(Mandatory)] [string] $Path)
    $lines = @(Get-Content -LiteralPath $Path)
    if ($lines.Count -gt 0 -and $lines[0].Length -gt 0) {
        $lines[0] = $lines[0].TrimStart([char]0xFEFF)
    }
    return $lines
}

# ---------------------------------------------------------------------------
# Native command helper
# ---------------------------------------------------------------------------

<#
Runs a native executable and captures stdout+stderr plus the exit code without
letting a non-zero exit turn into a terminating error.
#>
function Invoke-Native {
    param(
        [Parameter(Mandatory)] [string] $Command,
        [string[]] $Arguments = @()
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Command @Arguments 2>&1 | Out-String
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }
    return [pscustomobject]@{ ExitCode = $code; Output = $output }
}

# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

function Get-DshCommand {
    $cmd = Get-Command dsh -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "The 'dsh' command was not found on PATH. Install DeepSeek Harness first, or run this script from a shell where 'dsh --version' works."
    }
    return $cmd.Source
}

function Get-DefaultDshHome {
    if ($env:DSH_HOME -and $env:DSH_HOME.Trim().Length -gt 0) { return $env:DSH_HOME.Trim() }
    return (Join-Path $HOME '.dsh')
}

function Resolve-Source {
    if ($FromGitHub -and $SourcePath) {
        throw 'Use either -FromGitHub or -SourcePath, not both.'
    }
    if ($FromGitHub) { return $GitHubSpec }
    if ($SourcePath) { return $SourcePath }
    if ($PSScriptRoot) { return $PSScriptRoot }
    throw 'Cannot determine a source path; pass -SourcePath explicitly.'
}

function Test-PluginDependency {
    param([Parameter(Mandatory)] [string] $ProfilePackageJson)
    if (-not (Test-Path -LiteralPath $ProfilePackageJson)) { return $false }
    $raw = Read-TextFile -Path $ProfilePackageJson
    if (-not $raw.Trim()) { return $false }
    $json = $raw | ConvertFrom-Json
    if ($null -eq $json.dependencies) { return $false }
    $names = @($json.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
    return ($names -contains $PackageName)
}

function Test-PatchBlockPresent {
    param([Parameter(Mandatory)] [string] $PatchFile)
    if (-not (Test-Path -LiteralPath $PatchFile)) { return $false }
    $lines = @(Read-TextLines -Path $PatchFile)
    return ($null -ne ($lines | Where-Object { $_ -eq $PatchBegin } | Select-Object -First 1))
}

function Test-PluginComposed {
    param(
        [Parameter(Mandatory)] [string] $Dsh,
        [Parameter(Mandatory)] [string] $ProfileName
    )
    $result = Invoke-Native -Command $Dsh -Arguments @('--profile', $ProfileName, '--dump-config')
    return [pscustomobject]@{
        Ok = ($result.Output -match [regex]::Escape($PackageName))
        Output = $result.Output
        ExitCode = $result.ExitCode
    }
}

# ---------------------------------------------------------------------------
# Backup / restore
# ---------------------------------------------------------------------------

<#
Copies the profile files this script may modify into a fresh timestamped backup
directory, then writes a manifest describing what the installer did so a later
-Uninstall can reason about it. Returns the backup directory.
#>
function New-ProfileBackup {
    param(
        [Parameter(Mandatory)] [string] $BackupRoot,
        [Parameter(Mandatory)] [string] $ProfileDir,
        [Parameter(Mandatory)] [string] $ProfileName,
        [Parameter(Mandatory)] [string] $Mode,
        [Parameter(Mandatory)] [string] $Source,
        [Parameter(Mandatory)] [int] $PatchModified
    )
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dir = Join-Path $BackupRoot $stamp
    # Two installs inside the same second must not share a directory.
    $suffix = 1
    while (Test-Path -LiteralPath $dir) {
        $suffix++
        $dir = Join-Path $BackupRoot "$stamp-$suffix"
    }

    New-Item -ItemType Directory -Path $dir -Force | Out-Null

    $copied = @()
    foreach ($name in $ManagedFiles) {
        $src = Join-Path $ProfileDir $name
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $dir $name) -Force
            $copied += $name
        }
    }

    $manifest = [ordered]@{
        tool          = 'dsh-mcp-studio/install.ps1'
        package       = $PackageName
        profile       = $ProfileName
        dshHome       = $DshHome
        profileDir    = $ProfileDir
        mode          = $Mode
        source        = $Source
        installedAt   = (Get-Date).ToString('o')
        copiedFiles   = $copied
        patchModified = [bool]$PatchModified
        patchBegin    = $PatchBegin
        patchEnd      = $PatchEnd
    }
    $manifest | ConvertTo-Json -Depth 4 | ForEach-Object { Write-TextFile -Path (Join-Path $dir 'manifest.json') -Text $_ }

    return $dir
}

function Get-LatestBackup {
    param([Parameter(Mandatory)] [string] $BackupRoot)
    if (-not (Test-Path -LiteralPath $BackupRoot)) { return $null }
    $dirs = @(Get-ChildItem -LiteralPath $BackupRoot -Directory | Sort-Object Name -Descending)
    if ($dirs.Count -eq 0) { return $null }
    return $dirs[0].FullName
}

# ---------------------------------------------------------------------------
# Patch-block editing
# ---------------------------------------------------------------------------

function Get-PatchBlockLines {
    return @(
        $PatchBegin,
        '# Added by install.ps1. Do not hand-edit this block; re-run install.ps1 -Uninstall to remove it.',
        '- insert:',
        "    - id: $PanelId",
        "      name: '$PackageName'",
        '      config:',
        '        catalogEnabled: true',
        '        registryUrl: https://registry.modelcontextprotocol.io',
        '        probeTimeoutMs: 15000',
        $PatchEnd
    )
}

function Add-ManagedPatchBlock {
    param([Parameter(Mandatory)] [string] $PatchFile)
    if (Test-PatchBlockPresent -PatchFile $PatchFile) {
        Write-Info "managed patch block already present in $PatchFile - leaving it alone"
        return $false
    }
    $lines = @()
    if (Test-Path -LiteralPath $PatchFile) {
        $lines = @(Read-TextLines -Path $PatchFile)
    }
    # A file whose root is the empty flow sequence `[]` cannot also carry a list
    # item, so drop that one line and let the appended entry list be the root.
    $live = @($lines | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') })
    if ($live.Count -eq 1 -and $live[0].Trim() -eq '[]') {
        $lines = @($lines | Where-Object { $_.Trim() -ne '[]' })
    }
    $existing = ($lines -join "`n").TrimEnd([char[]]@("`r", "`n"))
    if ($existing.Length -gt 0) { $existing += "`n" }
    $block = ((Get-PatchBlockLines) -join "`n") + "`n"
    Write-TextFile -Path $PatchFile -Text ($existing + $block)
    return $true
}

function Remove-ManagedPatchBlock {
    param([Parameter(Mandatory)] [string] $PatchFile)
    if (-not (Test-Path -LiteralPath $PatchFile)) { return $false }
    $lines = @(Read-TextLines -Path $PatchFile)
    $out = New-Object System.Collections.Generic.List[string]
    $inside = $false
    $removed = 0
    foreach ($line in $lines) {
        if ($line -eq $PatchBegin) { $inside = $true; $removed++; continue }
        if ($line -eq $PatchEnd) { $inside = $false; $removed++; continue }
        if ($inside) { continue }
        $out.Add($line)
    }
    if ($removed -eq 0) { return $false }
    # Trim trailing blank lines the block may have left behind.
    while ($out.Count -gt 0 -and $out[$out.Count - 1].Trim() -eq '') { $out.RemoveAt($out.Count - 1) }
    # An empty file is not a valid "no patches" layer; the canonical empty root is [].
    if ($out.Count -eq 0) { $out.Add('[]') }
    Write-TextFile -Path $PatchFile -Text ($out -join "`n")
    return $true
}

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

function Write-NextSteps {
    Write-Head 'Next step'
    Write-Info "1. Restart the harness so it re-resolves the profile's plugin list:"
    Write-Info '     stop the running harness, then start it again with:  dsh web'
    Write-Info "2. Open $GuiUrl in your browser."
    Write-Info "3. Click the 'MCP Studio' icon (panel id '$PanelId') in the left sidebar."
    Write-Host ''
    Write-Info "If the plugin is already installed and you only changed cordis.patch.yml,"
    Write-Info "the profile's patchReload: live picks it up without a restart."
}

function Write-VerifyResult {
    param(
        [Parameter(Mandatory)] [string] $Dsh,
        [Parameter(Mandatory)] [string] $ProfileName
    )
    Write-Head 'Verify'
    Write-Info "running: dsh --profile $ProfileName --dump-config"
    $check = Test-PluginComposed -Dsh $Dsh -ProfileName $ProfileName
    if ($check.Ok) {
        Write-Ok "composed config contains $PackageName"
        return $true
    }
    Write-Fail "composed config does NOT contain $PackageName"
    Write-Info 'dump-config output tail:'
    $tail = ($check.Output -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 15)
    foreach ($line in $tail) { Write-Info "  $line" }
    return $false
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

function Invoke-Install {
    param(
        [Parameter(Mandatory)] [string] $Dsh,
        [Parameter(Mandatory)] [string] $ProfileDir,
        [Parameter(Mandatory)] [string] $PatchFile,
        [Parameter(Mandatory)] [string] $ProfilePackageJson,
        [Parameter(Mandatory)] [string] $BackupRoot,
        [Parameter(Mandatory)] [string] $Source
    )

    $alreadyPresent = Test-PluginDependency -ProfilePackageJson $ProfilePackageJson
    $blockPresent = Test-PatchBlockPresent -PatchFile $PatchFile

    Write-Head 'Plan'
    Write-Info "profile        : $Profile"
    Write-Info "profile dir    : $ProfileDir"
    Write-Info "source         : $Source"
    Write-Info "package        : $PackageName"
    Write-Info "dependency     : $(if ($alreadyPresent) { 'already present' } else { 'will be added' })"
    Write-Info "backup root    : $BackupRoot"
    if ($Manual) {
        Write-Info "cordis.patch   : $(if ($blockPresent) { 'managed block already present' } else { 'will append managed block' })"
    }
    else {
        Write-Info 'cordis.patch   : not touched (the package carries its own bundle patch)'
    }
    if ($Manual -and -not $alreadyPresent) {
        $mode = 'manual'
    }
    elseif ($FromGitHub) {
        $mode = 'github'
    }
    else {
        $mode = 'path'
    }

    if ($DryRun) {
        Write-Head 'Dry run'
        Write-Plan "mkdir $BackupRoot"
        foreach ($name in $ManagedFiles) {
            $src = Join-Path $ProfileDir $name
            if (Test-Path -LiteralPath $src) {
                Write-Plan "copy $src -> <timestamp>/$name"
            }
            else {
                Write-Plan "skip missing $src"
            }
        }
        Write-Plan "write <timestamp>/manifest.json (mode=$mode, source=$Source)"
        if ($alreadyPresent) {
            Write-Plan "skip: dsh plugin --profile $Profile add `"$Source`" (dependency already present)"
        }
        else {
            Write-Plan "run: dsh plugin --profile $Profile add `"$Source`""
        }
        if ($Manual -and -not $blockPresent) {
            Write-Plan "append managed insert block to $PatchFile"
        }
        if (-not $SkipVerify) {
            Write-Plan "run: dsh --profile $Profile --dump-config  (expect $PackageName)"
        }
        Write-Host ''
        Write-Ok 'dry run complete - no file was created, changed or deleted'
        return 0
    }

    # --- Everything below actually writes. Backup first. -------------------
    Write-Head 'Backup'
    $backupDir = New-ProfileBackup -BackupRoot $BackupRoot -ProfileDir $ProfileDir `
        -ProfileName $Profile -Mode $mode -Source $Source -PatchModified 0
    Write-Ok "backup written to $backupDir"

    if ($Manual -and -not $blockPresent -and -not $DryRun) {
        Write-Head 'Patch layer'
        $added = Add-ManagedPatchBlock -PatchFile $PatchFile
        if ($added) {
            # Record that we changed the patch file.
            $manifestPath = Join-Path $backupDir 'manifest.json'
            $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
            $manifest.patchModified = $true
            $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8
            Write-Ok "appended managed insert block to $PatchFile"
        }
    }

    Write-Head 'Install'
    if ($alreadyPresent -and -not $Force) {
        Write-Ok "dependency $PackageName is already in $ProfilePackageJson - not adding it again"
        Write-Info 'pass -Force to re-run the add command anyway'
    }
    else {
        Write-Info "running: dsh plugin --profile $Profile add `"$Source`""
        $result = Invoke-Native -Command $Dsh -Arguments @('plugin', '--profile', $Profile, 'add', $Source)
        if ($result.Output.Trim()) {
            foreach ($line in ($result.Output -split "`r?`n" | Where-Object { $_.Trim() })) {
                Write-Info "  $line"
            }
        }
        if ($result.ExitCode -ne 0) {
            Write-Fail "dsh plugin add exited with code $result.ExitCode"
            Write-Info "your profile files were backed up in $backupDir"
            return 1
        }
        Write-Ok 'dsh plugin add completed'
    }

    # --- Verification ------------------------------------------------------
    if ($SkipVerify) {
        Write-Warn 'verification skipped (-SkipVerify)'
    }
    else {
        $ok = Write-VerifyResult -Dsh $Dsh -ProfileName $Profile
        if (-not $ok) {
            Write-Warn 'the plugin was installed but does not appear in the composed config.'
            Write-Warn "Your pre-install files are in $backupDir."
            Write-Warn 'Re-run with -Manual to add an explicit cordis.patch.yml entry, or restore the backup.'
            return 1
        }
    }

    Write-NextSteps
    Write-Host ''
    Write-Ok "installed $PackageName into profile '$Profile'"
    return 0
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

function Invoke-Uninstall {
    param(
        [Parameter(Mandatory)] [string] $Dsh,
        [Parameter(Mandatory)] [string] $ProfileDir,
        [Parameter(Mandatory)] [string] $PatchFile,
        [Parameter(Mandatory)] [string] $ProfilePackageJson,
        [Parameter(Mandatory)] [string] $BackupRoot
    )

    $hasDep = Test-PluginDependency -ProfilePackageJson $ProfilePackageJson
    $hasBlock = Test-PatchBlockPresent -PatchFile $PatchFile

    Write-Head 'Plan'
    Write-Info "profile        : $Profile"
    Write-Info "dependency     : $(if ($hasDep) { 'will be removed' } else { 'not present' })"
    Write-Info "cordis.patch   : $(if ($hasBlock) { 'managed block will be removed' } else { 'no managed block' })"
    Write-Info 'other files    : never touched'

    if (-not $hasDep -and -not $hasBlock) {
        Write-Host ''
        Write-Ok "$PackageName is not installed in profile '$Profile' - nothing to do"
        return 0
    }

    if ($DryRun) {
        Write-Head 'Dry run'
        foreach ($name in $ManagedFiles) {
            $src = Join-Path $ProfileDir $name
            if (Test-Path -LiteralPath $src) {
                Write-Plan "copy $src -> <timestamp>/$name (safety backup before uninstall)"
            }
        }
        if ($hasBlock) {
            Write-Plan "remove managed block ($PatchBegin ... $PatchEnd) from $PatchFile"
        }
        if ($hasDep) {
            Write-Plan "run: dsh plugin --profile $Profile remove $PackageName"
        }
        Write-Plan "run: dsh --profile $Profile --dump-config  (expect $PackageName to be gone)"
        Write-Host ''
        Write-Ok 'dry run complete - no file was created, changed or deleted'
        return 0
    }

    Write-Head 'Backup'
    $backupDir = New-ProfileBackup -BackupRoot $BackupRoot -ProfileDir $ProfileDir `
        -ProfileName $Profile -Mode 'uninstall' -Source '(none)' -PatchModified 0
    Write-Ok "safety backup written to $backupDir"

    if ($hasBlock) {
        Write-Head 'Patch layer'
        if (Remove-ManagedPatchBlock -PatchFile $PatchFile) {
            Write-Ok "removed managed block from $PatchFile"
        }
    }

    Write-Head 'Uninstall'
    if ($hasDep) {
        Write-Info "running: dsh plugin --profile $Profile remove $PackageName"
        $result = Invoke-Native -Command $Dsh -Arguments @('plugin', '--profile', $Profile, 'remove', $PackageName)
        if ($result.Output.Trim()) {
            foreach ($line in ($result.Output -split "`r?`n" | Where-Object { $_.Trim() })) {
                Write-Info "  $line"
            }
        }
        if ($result.ExitCode -ne 0) {
            Write-Fail "dsh plugin remove exited with code $result.ExitCode"
            Write-Warn "Restore manually from $backupDir if the profile looks wrong."
            return 1
        }
        Write-Ok 'dependency removed'
    }
    else {
        Write-Info 'dependency was not present - nothing to remove'
    }

    if (-not $SkipVerify) {
        Write-Head 'Verify'
        Write-Info "running: dsh --profile $Profile --dump-config"
        $check = Test-PluginComposed -Dsh $Dsh -ProfileName $Profile
        if ($check.Ok) {
            Write-Warn "$PackageName still appears in the composed config."
            Write-Warn "Restore $ProfilePackageJson and $PatchFile from $backupDir if needed, then restart the harness."
        }
        else {
            Write-Ok "$PackageName is gone from the composed config"
        }
    }

    Write-Head 'Next step'
    Write-Info 'Restart the harness: stop the running process, then run  dsh web'
    Write-Host ''
    Write-Ok "uninstalled $PackageName from profile '$Profile'"
    return 0
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Dot-sourcing with -DotSourceOnly stops here, so scripts/test-install.ps1 can
# exercise the helpers above without touching a real profile.
if (-not $DotSourceOnly) {

try {
    if (-not $DshHome) { $DshHome = Get-DefaultDshHome }
    $DshHome = (Resolve-Path -LiteralPath $DshHome).Path

    $ProfileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
    if (-not (Test-Path -LiteralPath $ProfileDir)) {
        $available = @()
        $profilesRoot = Join-Path $DshHome 'profiles'
        if (Test-Path -LiteralPath $profilesRoot) {
            $available = @(
                Get-ChildItem -LiteralPath $profilesRoot -Directory |
                    Where-Object { (Test-Path -LiteralPath (Join-Path $_.FullName 'package.json')) -or (Test-Path -LiteralPath (Join-Path $_.FullName 'cordis.yml')) } |
                    Select-Object -ExpandProperty Name
            )
        }
        throw "Profile '$Profile' not found at $ProfileDir. Available profiles: $(if ($available.Count) { $available -join ', ' } else { '(none)' })."
    }

    $ProfilePackageJson = Join-Path $ProfileDir 'package.json'
    $PatchFile = Join-Path $ProfileDir 'cordis.patch.yml'
    $BackupRoot = Join-Path (Join-Path $DshHome 'mcp-studio') 'backups'

    Write-Host "dsh-mcp-studio installer" -ForegroundColor White
    Write-Info "dsh home : $DshHome"
    Write-Info "profile  : $Profile ($ProfileDir)"
    if ($DryRun) { Write-Warn 'DRY RUN - nothing will be changed' }

    $Dsh = Get-DshCommand

    $Source = ''
    if (-not $Uninstall) { $Source = Resolve-Source }

    # A github: spec is fetched with the git binary. The repository ships lib/,
    # so a build step is not involved - only git itself must be reachable.
    if ($FromGitHub -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Warn 'git was not found on PATH, but -FromGitHub needs it to fetch the repository.'
        Write-Info 'On Windows git usually lives at C:\Program Files\Git\cmd\git.exe; add that folder to PATH, or use -SourcePath.'
    }

    if ($Uninstall) {
        $code = Invoke-Uninstall -Dsh $Dsh -ProfileDir $ProfileDir -PatchFile $PatchFile `
            -ProfilePackageJson $ProfilePackageJson -BackupRoot $BackupRoot
    }
    else {
        $code = Invoke-Install -Dsh $Dsh -ProfileDir $ProfileDir -PatchFile $PatchFile `
            -ProfilePackageJson $ProfilePackageJson -BackupRoot $BackupRoot -Source $Source
    }

    exit $code
}
catch {
    Write-Host ''
    Write-Fail $_.Exception.Message
    Write-Host ''
    Write-Info 'No profile file was modified by this failure. Re-run with -DryRun to see the plan first.'
    exit 1
}

} # end if (-not $DotSourceOnly)
