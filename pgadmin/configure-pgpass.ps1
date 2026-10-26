$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
$pgpassPath = Join-Path $PSScriptRoot '.pgpass'
$composePath = Join-Path $projectRoot 'docker-compose.yml'

if (-not (Test-Path $envPath)) {
    throw 'Missing .env. Copy .env.example to .env and set the database passwords first.'
}

$dbPasswordLine = Get-Content $envPath |
    Where-Object { $_ -match '^DB_PASSWORD=' } |
    Select-Object -First 1
if (-not $dbPasswordLine) {
    throw 'DB_PASSWORD is missing from .env.'
}

$dbPassword = $dbPasswordLine.Substring('DB_PASSWORD='.Length)
if (-not $dbPassword -or $dbPassword -match '[:\\]') {
    throw 'DB_PASSWORD must be non-empty and must not contain colon or backslash for pgpass format.'
}

$pgpassEntry = "db:5432:hrm:hrm_app:$dbPassword"
[System.IO.File]::WriteAllText(
    $pgpassPath,
    "$pgpassEntry`n",
    [System.Text.Encoding]::ASCII
)

Push-Location $projectRoot
try {
    docker compose -f $composePath up -d pgadmin
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not start pgAdmin and its database dependency.'
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        docker compose -f $composePath exec -T pgadmin /bin/true 2>$null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) {
        throw 'pgAdmin did not become ready within 60 seconds.'
    }

    docker compose -f $composePath exec -T pgadmin cp /pgadmin4/.pgpass /var/lib/pgadmin/.pgpass
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not install the pgpass file in the pgAdmin data volume.'
    }

    docker compose -f $composePath exec -T pgadmin chmod 600 /var/lib/pgadmin/.pgpass
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not restrict pgpass file permissions.'
    }

    docker compose -f $composePath exec -T pgadmin /venv/bin/python3 /pgadmin4/setup.py load-servers /pgadmin4/servers.json --user 'pgadmin4@pgadmin.org' --sqlite-path /var/lib/pgadmin/pgadmin4.db --replace
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not register the HRM PostgreSQL connection in pgAdmin.'
    }
}
finally {
    Pop-Location
}

Write-Output 'pgAdmin is configured to connect to HRM PostgreSQL without prompting for the database password.'
