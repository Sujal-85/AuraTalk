# Firebase Storage CORS Configuration Script
# This script helps you apply the CORS settings to your Firebase bucket.

$BUCKET_NAME = "auratalk-chatapp.firebasestorage.app"
$CORS_FILE = "cors.json"

Write-Host "--- Firebase Storage CORS Configuration ---" -ForegroundColor Cyan

if (!(Test-Path $CORS_FILE)) {
    Write-Host "Error: $CORS_FILE not found." -ForegroundColor Red
    exit
}

Write-Host "To apply CORS, you need the Google Cloud SDK (gsutil) installed." -ForegroundColor Yellow
Write-Host "If you have it installed, run the following command:" -ForegroundColor White
Write-Host "`ngsutil cors set $CORS_FILE gs://$BUCKET_NAME" -ForegroundColor Green

Write-Host "`n--- Alternative Method (Manual) ---" -ForegroundColor Cyan
Write-Host "If you don't want to use the CLI, you can set this in the Google Cloud Console:"
Write-Host "1. Go to https://console.cloud.google.com/storage/browser"
Write-Host "2. Select your project: auratalk-chatapp"
Write-Host "3. Find your bucket: $BUCKET_NAME"
Write-Host "4. Use the Cloud Shell (terminal icon at the top right) and run the gsutil command there."

Write-Host "`nNote: CORS is required for the browser to display images/videos from Firebase." -ForegroundColor Gray
