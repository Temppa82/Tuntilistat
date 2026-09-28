Add-Type -AssemblyName System.IO.Compression.FileSystem
function New-SourceZip([string]$src,[string]$out){
  if(Test-Path $out){Remove-Item $out -Force}
  $zip=[System.IO.Compression.ZipFile]::Open($out,[System.IO.Compression.ZipArchiveMode]::Create)
  try{
    $skip=@('node_modules','dist','.git','jakelu','scripts')
    Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object{
      $rel=$_.FullName.Substring($src.Length).TrimStart('\')
      $parts=$rel -split '\\'
      if($parts[0] -notin $skip -and $rel){
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$rel)
      }
    }
  } finally { $zip.Dispose() }
}
$base='C:\Lataukset\Ohjelmat\Tuntilistaaja'
New-SourceZip "$base\paikallinen-ajolista" "$base\jakelu\Ajolista-Pages-lahdekoodi.zip"
$z=[System.IO.Compression.ZipFile]::OpenRead("$base\jakelu\Ajolista-Pages-lahdekoodi.zip")
$rel=($z.Entries|Where-Object{$_.FullName -notmatch '/'}).Count
$templates=($z.Entries|Where-Object{$_.FullName -match 'templates|templates-data|make-templates'}).Count
Write-Host ("lähdekoodizip: {0} kohdetta ({1} flat), pohja/template-tiedostoja: {2}" -f $z.Entries.Count,$rel,$templates)
$z.Dispose()