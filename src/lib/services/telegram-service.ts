import { appConfig } from "@/lib/config";
import type { Listing } from "@/lib/types";

type TelegramUrlButton = {
  text: string;
  url: string;
};

type TelegramInlineButton = TelegramUrlButton;

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
  return (
    buildTelegramUserUrl(contact) ||
    (() => {
      const phone = normalizePhoneNumber(contact);
      return phone ? `tel:${phone}` : null;
    })()
  );
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

export function buildSellerActionUrl(listing: Listing, action: "accept" | "cancel") {
  const listingUrl = `${appConfig.appUrl}/seller-action?action=${action}&listingId=${encodeURIComponent(listing.id)}`;
  const chatId = listing.sellerTelegramChatId;

  return chatId ? `${listingUrl}&chatId=${encodeURIComponent(String(chatId))}` : listingUrl;
}

export async function sendTelegramBotMessage(chatId: number, text: string, rows?: TelegramInlineButton[][]) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      ok: false as const,
      error: "Missing TELEGRAM_BOT_TOKEN.",
    };
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

  if (response.ok) {
    return { ok: true as const };
  }

  const errorBody = await response.text().catch(() => "");
  console.error("Telegram sendMessage failed:", response.status, errorBody);

  return {
    ok: false as const,
    error: `Telegram sendMessage failed with HTTP ${response.status}${errorBody ? `: ${errorBody}` : ""}`,
  };
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
    return {
      ok: false as const,
      error: "Listing has no sellerTelegramChatId. Create the listing from the bot before testing seller notifications.",
    };
  }

  const listingUrl = buildListingUrl(listing);
  const buyerTelegramUrl = buildTelegramUserUrl(listing.escrow.buyerContact || listing.escrow.buyer);
  const rows: TelegramInlineButton[][] = [
    [
      { text: "Accept meetup", url: buildSellerActionUrl(listing, "accept") },
      { text: "Cancel reservation", url: buildSellerActionUrl(listing, "cancel") },
    ],
    [{ text: "Open listing", url: listingUrl }],
  ];

  if (buyerTelegramUrl) {
    rows.push([{ text: "Contact buyer", url: buyerTelegramUrl }]);
  }

  return sendTelegramBotMessage(
    listing.sellerTelegramChatId,
    [
      "Reservation confirmed.",
      "",
      `Listing: ${listing.title}`,
      `Buyer: ${listing.escrow.buyer || "Unknown buyer"}`,
      listing.escrow.buyerContact ? `Buyer contact: ${listing.escrow.buyerContact}` : "",
      `Reservation mode: ${listing.escrow.reservationMode || "demo"}`,
      listing.sellerWalletAddress ? `Seller wallet: ${listing.sellerWalletAddress}` : "Seller wallet: not configured",
      `Status: ${listing.escrow.status}`,
      `Release code: ${listing.escrow.releaseCode || "Pending"}`,
      "",
      "Keep the release code private until the in-person inspection is complete.",
      "Use the buttons below to accept or cancel directly from Telegram.",
    ]
      .filter(Boolean)
      .join("\n"),
    rows,
  );
}

export async function notifySellerBuyerCancelled(listing: Listing, reason?: string) {
  if (!listing.sellerTelegramChatId) {
    return { ok: false as const, error: "Listing has no sellerTelegramChatId." };
  }

  return sendTelegramBotMessage(
    listing.sellerTelegramChatId,
    [
      "Reservation cancelled by buyer.",
      "",
      `Listing: ${listing.title}`,
      `Buyer: ${listing.escrow.buyer || "Unknown buyer"}`,
      reason ? `Reason: ${reason}` : "",
      "",
      "The listing is available again for new reservations.",
    ]
      .filter(Boolean)
      .join("\n"),
    [[{ text: "Open listing", url: buildListingUrl(listing) }]],
  );
}

export async function notifySellerFundsReleased(listing: Listing) {
  if (!listing.sellerTelegramChatId) {
    return { ok: false as const, error: "Listing has no sellerTelegramChatId." };
  }

  return sendTelegramBotMessage(
    listing.sellerTelegramChatId,
    [
      "Buyer confirmed the meetup.",
      "",
      `Listing: ${listing.title}`,
      `Buyer: ${listing.escrow.buyer || "Unknown buyer"}`,
      `Reservation mode: ${listing.escrow.reservationMode || "demo"}`,
      listing.escrow.transactionRef ? `Transaction proof: ${listing.escrow.transactionRef}` : "",
      "",
      "The listing is now marked as sold.",
    ]
      .filter(Boolean)
      .join("\n"),
    [[{ text: "Open listing", url: buildListingUrl(listing) }]],
  );
}
