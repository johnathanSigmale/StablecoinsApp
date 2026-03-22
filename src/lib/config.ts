export const appConfig = {
  appName: "JohnTon",
  description:
    "Buy and sell anything locally on TON — AI-powered listings, Telegram-native, with secure escrow.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "flipbot_ai_bot",
  demoTonAddress: process.env.NEXT_PUBLIC_DEMO_TON_ADDRESS || "",
  tonApiBaseUrl: process.env.TON_API_BASE_URL || "https://testnet.toncenter.com/api/v2",
  tonNetwork: process.env.NEXT_PUBLIC_TON_NETWORK || "testnet",
};
