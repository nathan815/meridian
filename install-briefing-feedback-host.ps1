param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.meridian.briefing_feedback'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$hostScript = Join-Path $PSScriptRoot 'briefing-feedback-host.cjs'
$launcherSource = Join-Path $PSScriptRoot 'briefing-feedback-host-launcher.cs'
$compilerPath = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$installDirectory = Join-Path $env:LOCALAPPDATA 'Meridian\NativeMessaging'
$launcherPath = Join-Path $installDirectory 'briefing-feedback-host.exe'
$configPath = Join-Path $installDirectory 'host.config'
$manifestPath = Join-Path $installDirectory "$hostName.json"

New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
[IO.File]::WriteAllLines($configPath, @($nodePath, $hostScript), [Text.UTF8Encoding]::new($false))
Remove-Item -Force -ErrorAction SilentlyContinue $launcherPath
if (-not (Test-Path $compilerPath)) {
  throw 'The .NET Framework C# compiler is required to install Meridian feedback sync.'
}
& $compilerPath /nologo /target:exe "/out:$launcherPath" $launcherSource
if ($LASTEXITCODE -ne 0) {
  throw 'Could not compile the Meridian feedback host launcher.'
}

$manifest = [ordered]@{
  name = $hostName
  description = 'Meridian briefing feedback bridge'
  path = $launcherPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 3
[IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))

foreach ($registryRoot in @(
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts',
  'HKCU:\Software\Chromium\NativeMessagingHosts'
)) {
  $key = Join-Path $registryRoot $hostName
  New-Item -Path $key -Force | Out-Null
  Set-Item -Path $key -Value $manifestPath
}

Write-Output "Installed $hostName for extension $ExtensionId."
