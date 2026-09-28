# Päivittää GitHub Pages -haaran uusimpaan buildiin.
# Käyttö: .\scripts\publish-pages.ps1
# Ajetaan paikallinen-ajolista-kansiosta, jossa .git sijaitsee.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$dist='C:\Lataukset\Ohjelmat\Tuntilistaaja\jakelu\Tunnit'
$wt=Join-Path $env:TEMP 'ajolista-pages-haara'

# Build tehdään ensin, jotta Pages-haara saa aina uusimman version.
Push-Location $root
try { & npm.cmd run build | Out-Null; if($LASTEXITCODE -ne 0){throw 'Build epäonnistui'} }
finally { Pop-Location }

if(-not (Test-Path "$dist\sw.js")){throw "dist-kansiota ei löytyi: $dist"}
$version=(Select-String -LiteralPath "$dist\sw.js" -Pattern '\d+\.\d+\.\d+-[0-9a-f]{16}').Matches[0].Value
Write-Host "Julkaiseva versio $version"

Push-Location $root
try {
  # Työpuu on erillinen, jotta lähdekoodikansio pysyy koskemattomana.
  if(-not (Test-Path "$wt\.git")){ & git worktree add --detach $wt | Out-Null }
  Push-Location $wt
  try {
    & git checkout main -- . 2>$null | Out-Null
    & git clean -fdx -e node_modules 2>$null | Out-Null
    & git checkout main 2>$null | Out-Null
    Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
    Copy-Item "$dist\*" $wt -Force
    Copy-Item "$dist\.nojekyll" $wt -Force
    Copy-Item (Join-Path $root '.gitattributes') $wt -Force
    & git add -A | Out-Null
    & git commit -q -m "Ajolista $version" 2>$null
    if($LASTEXITCODE -ne 0){ Write-Host 'Ei muutoksia tällä versiolla.' } else { Write-Host "Commit tehty: $version" }
  } finally { Pop-Location }
  Write-Host ''
  Write-Host 'Pushaa sivustolla:'
  Write-Host "  git push origin main"
} finally { Pop-Location }
