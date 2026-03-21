param(
  [string]$BotToken = $env:TELEGRAM_BOT_TOKEN,
  [string]$AppUrl = $env:NEXT_PUBLIC_APP_URL,
  [string]$Secret = $env:TELEGRAM_WEBHOOK_SECRET
)

if (-not $BotToken) {
  throw "TELEGRAM_BOT_TOKEN is required."
}

if (-not $AppUrl) {
  throw "NEXT_PUBLIC_APP_URL is required."
}

$webhookUrl = "$AppUrl/api/telegram/webhook"

$body = @{
  url = $webhookUrl
  secret_token = $Secret
  drop_pending_updates = $true
  allowed_updates = @("message", "edited_message", "channel_post", "edited_channel_post", "callback_query")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$BotToken/setWebhook" `
  -ContentType "application/json" `
  -Body $body
