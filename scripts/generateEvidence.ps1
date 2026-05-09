$root = Split-Path -Parent $PSScriptRoot
$evidenceDir = Join-Path $root 'evidence'

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Save-TextImage {
  param(
    [string]$Title,
    [string]$Body,
    [string]$FileName
  )

  $width = 1500
  $height = 1000
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $titleFont = New-Object System.Drawing.Font('Consolas', 20, [System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Consolas', 12)
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 63, 170))
  $bodyBrush = [System.Drawing.Brushes]::Black
  $rect = New-Object System.Drawing.RectangleF(40, 90, ($width - 80), ($height - 130))

  $graphics.DrawString($Title, $titleFont, $titleBrush, 40, 25)
  $graphics.DrawString($Body, $bodyFont, $bodyBrush, $rect)

  $outPath = Join-Path $evidenceDir $FileName
  $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $titleFont.Dispose()
  $bodyFont.Dispose()
  $titleBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$verification = Get-Content (Join-Path $root 'verification-output.json') | ConvertFrom-Json
$routeResponse = Get-Content (Join-Path $root 'route-product-category-response.json') | ConvertFrom-Json

$routeBody = $routeResponse | ConvertTo-Json -Depth 8
$aggregationBody = $verification.aggregationRoutePreview | ConvertTo-Json -Depth 8
$virtualBody = $verification.virtualPropertySample | ConvertTo-Json -Depth 6
$documentBody = $verification.documentMiddlewareSample | ConvertTo-Json -Depth 6
$queryBody = $verification.queryMiddlewareSample | ConvertTo-Json -Depth 6
$aggregateBody = $verification.aggregateMiddlewareSample | ConvertTo-Json -Depth 6
$builtInBody = "Validation message:`r`n$($verification.builtInValidatorMessage)"
$customBody = "Validation message:`r`n$($verification.customValidatorMessage)"

Save-TextImage -Title '1. Route Test - /product-category' -Body $routeBody -FileName '01-product-category-route.png'
Save-TextImage -Title '2. Aggregation Pipeline Output' -Body $aggregationBody -FileName '02-aggregation-pipeline.png'
Save-TextImage -Title '3. Virtual Property - daysPosted' -Body $virtualBody -FileName '03-virtual-days-posted.png'
Save-TextImage -Title '4. Document Middleware - productSlug' -Body $documentBody -FileName '04-document-middleware.png'
Save-TextImage -Title '5. Query Middleware - premiumProducts filter' -Body $queryBody -FileName '05-query-middleware.png'
Save-TextImage -Title '6. Aggregate Middleware - premium filter' -Body $aggregateBody -FileName '06-aggregate-middleware.png'
Save-TextImage -Title '7. Built-in Validator' -Body $builtInBody -FileName '07-built-in-validator.png'
Save-TextImage -Title '8. Custom Validator' -Body $customBody -FileName '08-custom-validator.png'
