$proc = Get-Process -Name mysqld -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "[MariaDB] Stopping MariaDB server (PID $($proc.Id))..." -ForegroundColor Yellow
    Stop-Process -Name mysqld -Force
    Write-Host "[MariaDB] MariaDB stopped." -ForegroundColor Green
} else {
    Write-Host "[MariaDB] MariaDB is not running." -ForegroundColor Gray
}
