import { NextResponse } from "next/server";

import { reserveListing } from "@/lib/services/listings-service";
import { notifySellerReservation } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    buyerName?: string;
    buyerContact?: string;
    walletAddress?: string;
  };

  if (!body.buyerContact) {
    return NextResponse.json({ error: "buyerContact is required." }, { status: 400 });
  }

  try {
    const listing = await reserveListing(id, {
      buyerName: body.buyerName,
      buyerContact: body.buyerContact,
      walletAddress: body.walletAddress,
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    try {
      await notifySellerReservation(listing);
    } catch (error) {
      console.error("Seller Telegram notification failed:", error);
    }

    return NextResponse.json(listing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve listing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
