import { appConfig } from "@/lib/config";
import type { Listing } from "@/lib/types";

export function buildTelegramShareText(listing: Listing) {
  const listingUrl = `${appConfig.appUrl}/listings/${listing.id}`;

  return [
    `Sell or buy safely with ${appConfig.appName}`,
    "",
    `${listing.title} • ${listing.priceTon} TON`,
    `${listing.city} • ${listing.condition}`,
    listing.summary,
    "",
    `Secure checkout: ${listingUrl}`,
    `Bot: https://t.me/${appConfig.telegramBotUsername}`,
  ].join("\n");
}
