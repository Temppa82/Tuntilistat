Add-Type -AssemblyName System.IO.Compression.FileSystem;
# ZipArchiveMode on eri kokoonpanossa kuin ZipFile, joten molemmat ladataan.
Add-Type -AssemblyName System.IO.Compression;
function New-FlatZip([string]$path,[string]$dir){
  if(Test-Path $path){Remove-Item $path -Force}
  $zip=[System.IO.Compression.ZipFile]::Open($path,[System.IO.Compression.ZipArchiveMode]::Create)
  try{
    Get-ChildItem -LiteralPath $dir -File | ForEach-Object{
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$_.Name)
    }
  } finally { $zip.Dispose() }
}
$j='C:\Lataukset\Ohjelmat\Tuntilistaaja\jakelu'
$dist='C:\Lataukset\Ohjelmat\Tuntilistaaja\jakelu\Tunnit'
# Rakeennus kirjoittaa dist-kansioon, mutta zipit kootaan Tunnit-kansiosta.
# Ilman tätä kopiointia zipit ja GitHub Pages -kansio jäävät vanhaan versioon
# ja jakeluun päätyy korjaamaton ohjelma. Kopioidaan vain olemassa olevat
# tiedostot, jottein vanhaa tiedostoa ei jää roikkumaan.
$built='C:\Lataukset\Ohjelmat\Tuntilistaaja\paikallinen-ajolista\dist'
if(-not (Test-Path $built)){throw "dist-kansiota ei löyty. Aja ensin: npm run build"}
if(-not (Test-Path $dist)){New-Item -ItemType Directory -Path $dist -Force | Out-Null}
Get-ChildItem -LiteralPath $built -File | ForEach-Object{
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dist $_.Name) -Force
}
# Versio varmistaa, että kopiointi onnistui eikä kansiota ole jäänyt vanhaksi.
$readVersion={param($dir)
  $sw=Join-Path $dir 'sw.js'
  if(-not (Test-Path $sw)){return 'puuttuu'}
  # Versio ei ole kiinnitetty numeroon, vaan luetaan sw.js:stä. Muuten tämä jäisi
  # vanhaan versioon joka kerta kun paketti kootaan uudelleen.
  $m=[regex]::Match((Get-Content -LiteralPath $sw -Raw),'\d+\.\d+\.\d+-[0-9a-f]{16}')
  if($m.Success){return $m.Value}
  return 'tuntematon'
}
$builtVersion=& $readVersion $built
$distVersion=& $readVersion $dist
if($builtVersion -ne $distVersion){throw "Tunnit ei vastaa distiä: $distVersion <> $builtVersion"}
Write-Host ("Tunnit päivitetty dististä, versio $distVersion")
New-FlatZip "$j\Ajolista-GitHub-Pages.zip" $dist
New-FlatZip "$j\Ajolista-GitHub-Pages-korjattu.zip" $dist
New-FlatZip "$j\Ajolista-aloitus-ja-ajoneuvot.zip" $dist
$source='C:\Lataukset\Ohjelmat\Tuntilistaaja\paikallinen-ajolista'
if(Test-Path "$j\Ajolista-Pages-lahdekoodi.zip"){Remove-Item "$j\Ajolista-Pages-lahdekoodi.zip" -Force}
$zip=[System.IO.Compression.ZipFile]::Open("$j\Ajolista-Pages-lahdekoodi.zip",[System.IO.Compression.ZipArchiveMode]::Create)
try{
  # scripts/ mukaan, koska npm run build tarvitsee scripts/make-sw.mjs.
  $skip='node_modules','dist','.git','work'
  Get-ChildItem -LiteralPath $source -Recurse -File | Where-Object{
    $rel=$_.FullName.Substring($source.Length).TrimStart('\')
    $parts=$rel -split '\\'
    -not ($parts | Select-Object -First 1 | Where-Object { $skip -contains $_ })
  } | ForEach-Object{
    $rel=$_.FullName.Substring($source.Length).TrimStart('\')
    # ZIP-alkioissa erotin on aina etuk Slash, ei Windows-kauttiaviiva.
    $rel=$rel -replace '\\','/'
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$rel)
  }
} finally { $zip.Dispose() }
foreach($f in 'Ajolista-GitHub-Pages.zip','Ajolista-GitHub-Pages-korjattu.zip','Ajolista-aloitus-ja-ajoneuvot.zip','Ajolista-Pages-lahdekoodi.zip'){
  $z=[System.IO.Compression.ZipFile]::OpenRead("$j\$f")
  $flat=@($z.Entries | Where-Object { $_.FullName -notmatch '/' }).Count
  $dirs=@($z.Entries | Where-Object { $_.FullName -match '/' }).Count
  Write-Host ("{0}: {1} flat-tiedostoa, {2} kansioalkiota" -f $f,$flat,$dirs)
  $z.Dispose()
}