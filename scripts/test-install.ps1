#Requires -Version 5.1
<#
.SYNOPSIS
    Offline tests for install.ps1's helper functions.

.DESCRIPTION
    Runs entirely against a throwaway temp directory and a stub `dsh` command.
    Nothing in the real $DSH_HOME is read or written, no package manager is run.

    Covers the properties the install/uninstall contract depends on:
      * a backup copies both managed files and never reuses a directory
      * the managed cordis.patch.yml block is appended at most once
      * removing the block leaves every other byte of the file alone
      * the dependency probe reads package.json correctly
      * -DryRun writes nothing and creates no backup directory

.EXAMPLE
    powershell -NoProfile -File scripts/test-install.ps1
    pwsh    -NoProfile -File scripts/test-install.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptRoot '..')).Path
. (Join-Path $repoRoot 'install.ps1') -DotSourceOnly

$script:Passed = 0
$script:Failed = 0

function Assert-True {
    param([Parameter(Mandatory)] [bool] $Condition, [Parameter(Mandatory)] [string] $What)
    if ($Condition) {
        $script:Passed++
        Write-Host "  ok   $What" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "  FAIL $What" -ForegroundColor Red
    }
}

function Assert-Equal {
    param([Parameter(Mandatory)] $Actual, [Parameter(Mandatory)] $Expected, [Parameter(Mandatory)] [string] $What)
    $ok = ($Actual -eq $Expected)
    if (-not $ok) {
        Write-Host "        expected: $Expected" -ForegroundColor DarkGray
        Write-Host "        actual  : $Actual" -ForegroundColor DarkGray
    }
    Assert-True -Condition $ok -What $What
}

$tempRoot = [System.IO.Path]::GetTempPath()
$work = Join-Path $tempRoot ("mcp-studio-test-" + [guid]::NewGuid().ToString('n'))

try {
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    Write-Host "work dir: $work"

    $profileDir = Join-Path $work 'profiles\web'
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    $profilePackageJson = Join-Path $profileDir 'package.json'
    $patchFile = Join-Path $profileDir 'cordis.patch.yml'
    $backupRoot = Join-Path $work 'mcp-studio\backups'
    $installPs1 = Join-Path $repoRoot 'install.ps1'

    # --- dependency probe ---------------------------------------------------
    Write-Host ''
    Write-Host 'Test-PluginDependency'
    Write-TextFile -Path $profilePackageJson -Text '{"dependencies":{}}'
    Assert-True -Condition (-not (Test-PluginDependency -ProfilePackageJson $profilePackageJson)) -What 'absent dependency -> false'

    Write-TextFile -Path $profilePackageJson -Text ('{"dependencies":{"' + $PackageName + '":"link:../repo"}}')
    Assert-True -Condition (Test-PluginDependency -ProfilePackageJson $profilePackageJson) -What 'present dependency -> true'

    Write-TextFile -Path $profilePackageJson -Text '{ "name": "dsh-profile-web", "private": true }'
    Assert-True -Condition (-not (Test-PluginDependency -ProfilePackageJson $profilePackageJson)) -What 'no dependencies key -> false'

    # --- backup -------------------------------------------------------------
    Write-Host ''
    Write-Host 'New-ProfileBackup'
    Write-TextFile -Path $profilePackageJson -Text '{"dependencies":{}}'
    Write-TextFile -Path $patchFile -Text "[]`n"

    $b1 = New-ProfileBackup -BackupRoot $backupRoot -ProfileDir $profileDir -ProfileName 'web' -Mode 'path' -Source 'x' -PatchModified 0
    $b2 = New-ProfileBackup -BackupRoot $backupRoot -ProfileDir $profileDir -ProfileName 'web' -Mode 'path' -Source 'x' -PatchModified 0
    Assert-True -Condition ($b1 -ne $b2) -What 'two backups get distinct directories'
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $b1 'package.json')) -What 'backup contains package.json'
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $b1 'cordis.patch.yml')) -What 'backup contains cordis.patch.yml'
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $b1 'manifest.json')) -What 'backup contains manifest.json'
    Assert-Equal -Actual (Get-LatestBackup -BackupRoot $backupRoot) -Expected $b2 -What 'Get-LatestBackup returns the newest directory'

    # --- managed patch block ------------------------------------------------
    Write-Host ''
    Write-Host 'managed cordis.patch.yml block'
    Write-TextFile -Path $patchFile -Text "[]`n"

    Assert-True -Condition (-not (Test-PatchBlockPresent -PatchFile $patchFile)) -What 'block reported absent on a fresh file'
    Assert-True -Condition (Add-ManagedPatchBlock -PatchFile $patchFile) -What 'first Add appends the block'
    Assert-True -Condition (Test-PatchBlockPresent -PatchFile $patchFile) -What 'block reported present after Add'
    Assert-True -Condition (-not (Add-ManagedPatchBlock -PatchFile $patchFile)) -What 'second Add is a no-op'
    $beginCount = @(Get-Content -LiteralPath $patchFile | Where-Object { $_ -eq $PatchBegin }).Count
    Assert-Equal -Actual $beginCount -Expected 1 -What 'begin marker appears exactly once'
    $endCount = @(Get-Content -LiteralPath $patchFile | Where-Object { $_ -eq $PatchEnd }).Count
    Assert-Equal -Actual $endCount -Expected 1 -What 'end marker appears exactly once'
    $text = Get-Content -LiteralPath $patchFile -Raw
    Assert-True -Condition ($text.Contains($PackageName)) -What 'block names the package'
    Assert-True -Condition (-not $text.Contains('[]')) -What 'empty root [] is dropped so the appended list stays valid YAML'
    $firstLive = @($text -split "`n" | Where-Object { $_.Trim() -ne '' -and -not $_.Trim().StartsWith('#') })[0]
    Assert-Equal -Actual $firstLive -Expected '- insert:' -What 'the appended entry list is the file root'
    # The managed block must carry the shipped budgets (patch.yml / host Config),
    # not an older tighter pair that would report healthy servers as unreachable.
    Assert-True -Condition ($text.Contains('probeTimeoutMs: 60000')) -What 'managed block carries the shipped probe budget'
    Assert-True -Condition ($text.Contains('mountTimeoutMs: 90000')) -What 'managed block carries the shipped mount budget'
    Assert-True -Condition (-not $text.Contains('15000')) -What 'managed block does not pin the old 15s probe budget'

    Assert-True -Condition (Remove-ManagedPatchBlock -PatchFile $patchFile) -What 'Remove strips the block'
    Assert-True -Condition (-not (Test-PatchBlockPresent -PatchFile $patchFile)) -What 'block gone after Remove'
    Assert-True -Condition (-not (Remove-ManagedPatchBlock -PatchFile $patchFile)) -What 'second Remove is a no-op'
    Assert-Equal -Actual ((Get-Content -LiteralPath $patchFile -Raw).Trim()) -Expected '[]' -What 'original content restored'

    # a block appended to a non-empty user layer leaves the user content intact
    Write-TextFile -Path $patchFile -Text "- id: user-thing`n  name: '@example/user'`n"
    Add-ManagedPatchBlock -PatchFile $patchFile | Out-Null
    Add-ManagedPatchBlock -PatchFile $patchFile | Out-Null
    Remove-ManagedPatchBlock -PatchFile $patchFile | Out-Null
    Assert-Equal -Actual ((Get-Content -LiteralPath $patchFile -Raw).Trim()) -Expected "- id: user-thing`n  name: '@example/user'" -What 'user content survives an add/remove cycle'

    # --- DryRun writes nothing ---------------------------------------------
    Write-Host ''
    Write-Host 'end-to-end -DryRun against a stub dsh'

    Write-TextFile -Path $profilePackageJson -Text '{"dependencies":{}}'
    Write-TextFile -Path $patchFile -Text "[]`n"

    $shimDir = Join-Path $work 'shim'
    New-Item -ItemType Directory -Path $shimDir -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $shimDir 'dsh.cmd') -Value "@echo off`r`nexit /b 0`r`n" -Encoding ascii

    $hashBefore = (Get-FileHash -LiteralPath $profilePackageJson -Algorithm SHA256).Hash
    $patchBefore = (Get-FileHash -LiteralPath $patchFile -Algorithm SHA256).Hash
    $backupCountBefore = @(Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue).Count

    $savedPath = $env:PATH
    try {
        $env:PATH = "$shimDir;$savedPath"
        & $installPs1 -DryRun -DshHome $work -Profile web -SkipVerify *> $null
    }
    finally {
        $env:PATH = $savedPath
    }

    Assert-Equal -Actual (Get-FileHash -LiteralPath $profilePackageJson -Algorithm SHA256).Hash -Expected $hashBefore -What 'DryRun left package.json byte-identical'
    Assert-Equal -Actual (Get-FileHash -LiteralPath $patchFile -Algorithm SHA256).Hash -Expected $patchBefore -What 'DryRun left cordis.patch.yml byte-identical'
    $backupCountAfter = @(Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue).Count
    Assert-Equal -Actual $backupCountAfter -Expected $backupCountBefore -What 'DryRun created no new backup directory'
}
finally {
    # Only ever remove the temp directory this script created.
    if ($work.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $work).StartsWith('mcp-studio-test-')) {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
if ($script:Failed -gt 0) {
    Write-Host "FAILED: $($script:Failed) of $($script:Passed + $script:Failed) checks failed" -ForegroundColor Red
    exit 1
}
Write-Host "PASSED: $($script:Passed) checks" -ForegroundColor Green
exit 0
