import { NextResponse } from "next/server";

import { findListing, reserveListing } from "@/lib/services/listings-service";
import { notifySellerReservation } from "@/lib/services/telegram-service";
import { verifyTonBalance } from "@/lib/services/ton-service";
import type { ReservationMode } from "@/lib/types";

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
    reservationMode?: ReservationMode;
  };

  if (!body.buyerContact) {
    return NextResponse.json({ error: "buyerContact is required." }, { status: 400 });
  }

  const listingBeforeReservation = await findListing(id);
  if (!listingBeforeReservation) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const reservationMode: ReservationMode = body.reservationMode === "balance_check" ? "balance_check" : "demo";
  let balanceCheck:
    | {
        ok: true;
        statusMessage: string;
        balanceTon: number;
      }
    | {
        ok: false;
        error: string;
      }
    | undefined;

  if (reservationMode === "balance_check") {
    if (!body.walletAddress) {
      return NextResponse.json({ error: "A buyer wallet is required for balance-check mode." }, { status: 400 });
    }

    if (!listingBeforeReservation.sellerWalletAddress) {
      return NextResponse.json(
        { error: "This listing has no seller wallet configured, so real release mode is unavailable." },
        { status: 400 },
      );
    }

    balanceCheck = await verifyTonBalance(body.walletAddress, listingBeforeReservation.priceTon);
    if (!balanceCheck.ok) {
      return NextResponse.json({ error: balanceCheck.error }, { status: 400 });
    }
  }

  try {
    const listing = await reserveListing(id, {
      buyerName: body.buyerName,
      buyerContact: body.buyerContact,
      walletAddress: body.walletAddress,
      reservationMode,
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const sellerNotification = await notifySellerReservation(listing);
    return NextResponse.json({ listing, sellerNotification, balanceCheck });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve listing.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
