import { appConfig } from "@/lib/config";
import type { Listing } from "@/lib/types";

type TelegramUrlButton = {
  text: string;
  url: string;
};

type TelegramCallbackButton = {
  text: string;
  callback_data: string;
};

type TelegramInlineButton = TelegramUrlButton | TelegramCallbackButton;

function normalizeTelegramHandle(handle?: string | null) {
  const normalized = handle?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

function normalizePhoneNumber(contact?: string | null) {
  const normalized = contact?.trim();
  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? digits : null;
}

export function buildListingUrl(listing: Listing) {
  return `${appConfig.appUrl}/listings/${listing.id}`;
}

export function buildTelegramUserUrl(handle?: string | null) {
  const normalizedHandle = normalizeTelegramHandle(handle);
  if (!normalizedHandle) {
    return null;
  }

  if (/^[A-Za-z0-9_]{5,}$/.test(normalizedHandle)) {
    return `https://t.me/${normalizedHandle}`;
  }

  return null;
}

export function buildContactUrl(contact?: string | null) {
  return buildTelegramUserUrl(contact) || (() => {
    const phone = normalizePhoneNumber(contact);
    return phone ? `tel:${phone}` : null;
  })();
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

export async function sendTelegramBotMessage(chatId: number, text: string, rows?: TelegramInlineButton[][]) {
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
      reply_markup: rows?.length
        ? {
            inline_keyboard: rows,
          }
        : undefined,
    }),
  });

  return response.ok;
}

export async function answerTelegramCallbackQuery(callbackQueryId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });

  return response.ok;
}

export async function notifySellerReservation(listing: Listing) {
  if (!listing.sellerTelegramChatId) {
    return false;
  }

  const listingUrl = buildListingUrl(listing);
  const buyerContactUrl = buildContactUrl(listing.escrow.buyerContact || listing.escrow.buyer);
  const rows: TelegramInlineButton[][] = [
    [
      { text: "Accept meetup", callback_data: `seller_accept:${listing.id}` },
      { text: "Cancel reservation", callback_data: `seller_cancel:${listing.id}` },
    ],
    [{ text: "Open listing", url: listingUrl }],
  ];

  if (buyerContactUrl) {
    rows.push([{ text: "Contact buyer", url: buyerContactUrl }]);
  }

  return sendTelegramBotMessage(
    listing.sellerTelegramChatId,
    [
      "Reservation confirmed.",
      "",
      `Listing: ${listing.title}`,
      `Buyer: ${listing.escrow.buyer || "Unknown buyer"}`,
      listing.escrow.buyerContact ? `Buyer contact: ${listing.escrow.buyerContact}` : "",
      `Status: ${listing.escrow.status}`,
      `Release code: ${listing.escrow.releaseCode || "Pending"}`,
      "",
      "Use the buttons below to accept or cancel directly from Telegram.",
    ]
      .filter(Boolean)
      .join("\n"),
    rows,
  );
}
