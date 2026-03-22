import { NextResponse } from "next/server";

import { hasEscrowWallet } from "@/lib/services/escrow-service";
import { findListing, reserveListing } from "@/lib/services/listings-service";
import { notifySellerReservation } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    buyerContact?: string;
    walletAddress?: string;
    transactionRef?: string;
  };

  if (!body.buyerContact) {
    return NextResponse.json({ error: "buyerContact is required." }, { status: 400 });
  }

  const listing = await findListing(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const isRealPayment = hasEscrowWallet() && Boolean(body.transactionRef);

  if (isRealPayment && !body.walletAddress) {
    return NextResponse.json({ error: "walletAddress is required for escrow payment." }, { status: 400 });
  }

  try {
    const reserved = await reserveListing(id, {
      buyerContact: body.buyerContact,
      walletAddress: body.walletAddress,
      transactionRef: body.transactionRef,
      reservationMode: isRealPayment ? "balance_check" : "demo",
    });

    if (!reserved) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const sellerNotification = await notifySellerReservation(reserved);
    return NextResponse.json({ listing: reserved, sellerNotification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve listing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
