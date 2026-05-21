param(
  [string]$Source = "",
  [string]$InstallDir = "",
  [switch]$Start
)

$ErrorActionPreference = "Stop"

$AppName = "Jarvis Neural Command Interface"
$ExeName = "$AppName.exe"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $ScriptDir "..")).Path

if ([string]::IsNullOrWhiteSpace($Source)) {
  $Source = Join-Path $ProjectRoot "release\win-unpacked"
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\$AppName"
}

$SourcePath = (Resolve-Path -LiteralPath $Source).Path
$SourceExe = Join-Path $SourcePath $ExeName
if (-not (Test-Path -LiteralPath $SourceExe -PathType Leaf)) {
  throw "Packaged app was not found at $SourceExe. Run npm run package:win:dir first."
}

$ProgramsRoot = (Resolve-Path -LiteralPath (Join-Path $env:LOCALAPPDATA "Programs")).Path
$InstallPath = [System.IO.Path]::GetFullPath($InstallDir)
if (-not $InstallPath.StartsWith($ProgramsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to mirror into $InstallPath because it is outside $ProgramsRoot."
}

Write-Host "Updating installed app from $SourcePath"
Write-Host "Install target: $InstallPath"

$running = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ExecutablePath -and
    ([System.IO.Path]::GetFullPath($_.ExecutablePath)).StartsWith($InstallPath, [System.StringComparison]::OrdinalIgnoreCase)
  }

foreach ($process in $running) {
  Write-Host "Stopping running app process $($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
}

New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

& robocopy $SourcePath $InstallPath /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
$RobocopyExit = $LASTEXITCODE
if ($RobocopyExit -gt 7) {
  throw "robocopy failed with exit code $RobocopyExit"
}

$InstalledExe = Join-Path $InstallPath $ExeName
$IconPath = Join-Path $InstallPath "resources\app\build\icon.ico"
if (-not (Test-Path -LiteralPath $IconPath -PathType Leaf)) {
  $IconPath = $InstalledExe
}

function Set-JarvisShortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$Icon
  )

  $ShortcutDir = Split-Path -Parent $ShortcutPath
  New-Item -ItemType Directory -Path $ShortcutDir -Force | Out-Null
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $TargetPath
  $Shortcut.WorkingDirectory = $WorkingDirectory
  $Shortcut.IconLocation = "$Icon,0"
  $Shortcut.Description = $AppName
  $Shortcut.Save()
}

$DesktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$AppName.lnk"
$StartMenuShortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "$AppName.lnk"
Set-JarvisShortcut -ShortcutPath $DesktopShortcut -TargetPath $InstalledExe -WorkingDirectory $InstallPath -Icon $IconPath
Set-JarvisShortcut -ShortcutPath $StartMenuShortcut -TargetPath $InstalledExe -WorkingDirectory $InstallPath -Icon $IconPath

$Version = (Get-Item -LiteralPath $InstalledExe).VersionInfo.ProductVersion
Write-Host "Installed $AppName $Version"
Write-Host "Desktop shortcut: $DesktopShortcut"
Write-Host "Start menu shortcut: $StartMenuShortcut"

if ($Start) {
  Start-Process -FilePath $InstalledExe -WorkingDirectory $InstallPath
}
