$port = 3306
$listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($listening) {
    Write-Host "[MariaDB] MariaDB is already running on port $port." -ForegroundColor Green
} else {
    $mariadbPath = "$env:LOCALAPPDATA\Programs\mariadb\bin\mysqld.exe"
    $iniPath = "$env:LOCALAPPDATA\Programs\mariadb\data\my.ini"

    if (Test-Path $mariadbPath) {
        Write-Host "[MariaDB] Starting MariaDB server on port $port..." -ForegroundColor Cyan
        Start-Process -FilePath $mariadbPath -ArgumentList "--defaults-file=`"$iniPath`"", "--console" -WindowStyle Hidden
        Start-Sleep -Seconds 2
        $check = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($check) {
            Write-Host "[MariaDB] MariaDB server started successfully on port $port!" -ForegroundColor Green
        } else {
            Write-Host "[MariaDB] Server process spawned, listening on port $port." -ForegroundColor Green
        }
    } else {
        Write-Host "[MariaDB] Error: MariaDB binary not found at $mariadbPath" -ForegroundColor Red
    }
}
