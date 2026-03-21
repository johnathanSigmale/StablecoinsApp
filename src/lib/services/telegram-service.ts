import { appConfig } from "@/lib/config";
import type { Listing } from "@/lib/types";

type TelegramButton = {
  text: string;
  url: string;
};

function normalizeTelegramHandle(handle?: string | null) {
  const normalized = handle?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

export function buildListingUrl(listing: Listing) {
  return `${appConfig.appUrl}/listings/${listing.id}`;
}

export function buildTelegramUserUrl(handle?: string | null) {
  const normalizedHandle = normalizeTelegramHandle(handle);
  return normalizedHandle ? `https://t.me/${normalizedHandle}` : null;
}

export function buildTelegramShareText(listing: Listing) {
  const listingUrl = buildListingUrl(listing);

  return [
    `Sell or buy safely with ${appConfig.appName}`,
    "",
    `${listing.title} - ${listing.priceTon} TON`,
    `${listing.city} - ${listing.condition}`,
    listing.summary,
    "",
    `Secure checkout: ${listingUrl}`,
    `Bot: https://t.me/${appConfig.telegramBotUsername}`,
  ].join("\n");
}

export function buildTelegramShareUrl(listing: Listing) {
  const listingUrl = buildListingUrl(listing);
  const shareText = buildTelegramShareText(listing);
  return `https://t.me/share/url?url=${encodeURIComponent(listingUrl)}&text=${encodeURIComponent(shareText)}`;
}

export async function sendTelegramBotMessage(chatId: number, text: string, buttons?: TelegramButton[]) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: buttons?.length
        ? {
            inline_keyboard: [buttons.map((button) => ({ text: button.text, url: button.url }))],
          }
        : undefined,
    }),
  });

  return response.ok;
}

export async function notifySellerReservation(listing: Listing) {
  if (!listing.sellerTelegramChatId) {
    return false;
  }

  const listingUrl = buildListingUrl(listing);
  const buyerTelegramUrl = buildTelegramUserUrl(listing.escrow.buyer);
  const buttons: TelegramButton[] = [{ text: "Open listing", url: listingUrl }];

  if (buyerTelegramUrl) {
    buttons.push({ text: "Contact buyer", url: buyerTelegramUrl });
  }

  return sendTelegramBotMessage(
    listing.sellerTelegramChatId,
    [
      "Reservation confirmed.",
      "",
      `Listing: ${listing.title}`,
      `Buyer: ${listing.escrow.buyer || "Unknown buyer"}`,
      `Status: ${listing.escrow.status}`,
      `Release code: ${listing.escrow.releaseCode || "Pending"}`,
      "",
      "Next step: discuss the meetup place, date, and item details on Telegram.",
    ].join("\n"),
    buttons,
  );
}
