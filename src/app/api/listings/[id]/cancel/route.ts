import { NextResponse } from "next/server";

import { cancelListingEscrow, findListing } from "@/lib/services/listings-service";
import { notifySellerBuyerCancelled } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    reason?: string;
  };

  try {
    const listingBeforeCancel = await findListing(id);
    const listing = await cancelListingEscrow(id, body.reason);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const sellerNotification =
      listingBeforeCancel && listingBeforeCancel.sellerTelegramChatId
        ? await notifySellerBuyerCancelled(listingBeforeCancel, body.reason)
        : { ok: false, error: "No seller Telegram chat was available for cancellation notification." };

    return NextResponse.json({ listing, sellerNotification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel meetup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
