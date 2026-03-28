# context-menu-install.ps1 — Register/unregister Agent Desk Explorer context menu entries
# Usage: .\context-menu-install.ps1           (install)
#        .\context-menu-install.ps1 -Uninstall (uninstall)

param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

# Auto-detect executable path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

# Check for packaged exe first, then dev mode
$exePath = $null
$releaseDir = Join-Path $repoRoot 'release'
if (Test-Path $releaseDir) {
    $exe = Get-ChildItem -Path $releaseDir -Filter '*.exe' -Recurse | Select-Object -First 1
    if ($exe) { $exePath = $exe.FullName }
}
if (-not $exePath) {
    # Dev mode: use npx electron .
    $electronBin = Join-Path $repoRoot 'node_modules\.bin\electron.cmd'
    if (Test-Path $electronBin) {
        $exePath = $electronBin
    } else {
        Write-Error "Could not find Agent Desk executable or electron binary"
        exit 1
    }
}

$regBase = 'HKCU:\Software\Classes\Directory\Background\shell'

if ($Uninstall) {
    Write-Host "Uninstalling Agent Desk context menu entries..."
    foreach ($key in @('AgentDeskTerminal', 'AgentDeskCommand')) {
        $path = Join-Path $regBase $key
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force
            Write-Host "  Removed $key"
        }
    }
    # Also remove from Directory\shell (right-click on folder)
    $regBaseDir = 'HKCU:\Software\Classes\Directory\shell'
    foreach ($key in @('AgentDeskTerminal', 'AgentDeskCommand')) {
        $path = Join-Path $regBaseDir $key
        if (Test-Path $path) {
            Remove-Item -Path $path -Recurse -Force
            Write-Host "  Removed $key (directory)"
        }
    }
    Write-Host "Done."
    exit 0
}

Write-Host "Installing Agent Desk context menu entries..."
Write-Host "  Executable: $exePath"

# Determine if dev mode
$isDev = $exePath -like '*electron*'

foreach ($regRoot in @($regBase, 'HKCU:\Software\Classes\Directory\shell')) {
    # Entry 1: Agent Desk: Terminal (opens with --cwd)
    $termKey = Join-Path $regRoot 'AgentDeskTerminal'
    if (-not (Test-Path $termKey)) { New-Item -Path $termKey -Force | Out-Null }
    Set-ItemProperty -Path $termKey -Name '(Default)' -Value 'Agent Desk: Terminal'
    Set-ItemProperty -Path $termKey -Name 'Icon' -Value "$exePath,0"

    $termCmd = Join-Path $termKey 'command'
    if (-not (Test-Path $termCmd)) { New-Item -Path $termCmd -Force | Out-Null }
    if ($isDev) {
        Set-ItemProperty -Path $termCmd -Name '(Default)' -Value "`"$exePath`" `"$repoRoot`" --cwd `"%V`""
    } else {
        Set-ItemProperty -Path $termCmd -Name '(Default)' -Value "`"$exePath`" --cwd `"%V`""
    }

    # Entry 2: Agent Desk: Command (opens with --cwd --command default)
    $cmdKey = Join-Path $regRoot 'AgentDeskCommand'
    if (-not (Test-Path $cmdKey)) { New-Item -Path $cmdKey -Force | Out-Null }
    Set-ItemProperty -Path $cmdKey -Name '(Default)' -Value 'Agent Desk: Command'
    Set-ItemProperty -Path $cmdKey -Name 'Icon' -Value "$exePath,0"

    $cmdCmd = Join-Path $cmdKey 'command'
    if (-not (Test-Path $cmdCmd)) { New-Item -Path $cmdCmd -Force | Out-Null }
    if ($isDev) {
        Set-ItemProperty -Path $cmdCmd -Name '(Default)' -Value "`"$exePath`" `"$repoRoot`" --cwd `"%V`" --command default"
    } else {
        Set-ItemProperty -Path $cmdCmd -Name '(Default)' -Value "`"$exePath`" --cwd `"%V`" --command default"
    }
}

Write-Host "Done. Context menu entries registered."
Write-Host "Right-click in any folder to see 'Agent Desk: Terminal' and 'Agent Desk: Command'."
