#requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Device
$servicio = [System.Device.Location.GeoCoordinateWatcher]::new()
try {
    $inicio = [DateTimeOffset]::UtcNow
    $limite = $inicio.AddSeconds(18)
    if (-not $servicio.TryStart($true, [TimeSpan]::FromSeconds(12))) { return }
    if ($servicio.Permission -ne [System.Device.Location.GeoPositionPermission]::Granted) { return }
    do {
        $posicion = $servicio.Position
        $punto = $posicion.Location
        if ($posicion.Timestamp -ge $inicio -and -not $punto.IsUnknown -and
            -not [double]::IsNaN($punto.HorizontalAccuracy) -and $punto.HorizontalAccuracy -gt 0) {
            @{
                latitud = $punto.Latitude
                longitud = $punto.Longitude
                precisionMetros = [Math]::Max(1, $punto.HorizontalAccuracy)
                observada = $posicion.Timestamp.ToUniversalTime().ToString('o')
            } | ConvertTo-Json -Compress
            return
        }
        Start-Sleep -Milliseconds 500
    }
    while ([DateTimeOffset]::UtcNow -lt $limite)
}
finally {
    $servicio.Stop()
    $servicio.Dispose()
}
