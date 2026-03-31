# Deployment script for AuraTalk Backend (Google Cloud Run - Source Deploy)
# Uses gcloud run deploy --source (Cloud Buildpacks) — NO Docker Desktop required.

$PROJECT_ID = "auratalk-chatapp"
$REGION     = "us-central1"
$SERVICE    = "auratalk-backend"

Write-Host "--- AuraTalk Backend: Cloud Run Source Deploy ---" -ForegroundColor Cyan

# 1. Check gcloud CLI
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# 2. Set active project
Write-Host "Setting project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# 3. Ensure required APIs are enabled
Write-Host "Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --quiet

# 4. Read .env and write a YAML env-vars file (handles URLs and special chars safely)
$envFile    = ".env"
$envYaml    = "env-vars.yaml"
$hasEnvVars = $false

if (Test-Path $envFile) {
    # PORT is reserved by Cloud Run — must not be passed via env vars
    $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' -and $_ -notmatch '^PORT\s*=' }
    $yamlLines = $lines | ForEach-Object {
        $parts = $_ -split '=', 2
        $key   = $parts[0].Trim()
        $value = $parts[1].Trim()
        # Strip surrounding single or double quotes if already present in .env value
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        # Escape any single quotes inside the value by doubling them (YAML single-quote rule)
        $value = $value -replace "'", "''"
        # Use single-quoted YAML — safe for URLs, colons, commas, and all special chars
        "${key}: '$value'"
    }
    $yamlLines | Set-Content $envYaml -Encoding UTF8
    $hasEnvVars = $true
    Write-Host "Loaded $($yamlLines.Count) environment variables from .env -> $envYaml" -ForegroundColor Green
} else {
    Write-Host "Warning: .env file not found. Set env vars manually in Cloud Run console." -ForegroundColor Yellow
}

# 5. Deploy from source — Cloud Build creates the container in the cloud
Write-Host "`nDeploying to Cloud Run from source (no Docker Desktop needed)..." -ForegroundColor Cyan

$deployArgs = @(
    "run", "deploy", $SERVICE,
    "--source", ".",
    "--region", $REGION,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--min-instances", "0",
    "--max-instances", "3",
    "--port", "5001",
    "--quiet"
)

if ($hasEnvVars) {
    $deployArgs += "--env-vars-file"
    $deployArgs += $envYaml
}

& gcloud @deployArgs

# Clean up temp YAML file
if (Test-Path $envYaml) { Remove-Item $envYaml }

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nDeployment failed. Check the output above for details." -ForegroundColor Red
    exit 1
}

Write-Host "`n--- Deployment Successful! ---" -ForegroundColor Green
Write-Host "Getting service URL..." -ForegroundColor Yellow
gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"
