export const appConfig = {
  appName: "FlipBot AI",
  description:
    "Telegram-native conversational commerce on TON with AI-assisted listing creation and secure escrow flows.",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "flipbot_ai_bot",
  demoTonAddress: process.env.NEXT_PUBLIC_DEMO_TON_ADDRESS || "",
  tonApiBaseUrl: process.env.TON_API_BASE_URL || "https://testnet.toncenter.com/api/v2",
  tonNetwork: process.env.NEXT_PUBLIC_TON_NETWORK || "testnet",
};
