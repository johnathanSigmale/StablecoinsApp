import { NextResponse } from "next/server";

import { hasEscrowWallet, transferFromEscrow } from "@/lib/services/escrow-service";
import { releaseListingEscrow } from "@/lib/services/listings-service";
import { notifySellerFundsReleased } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const listing = await releaseListingEscrow(id);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    let escrowTransfer: { ok: boolean; transactionRef?: string; error?: string } = { ok: true };

    if (listing.escrow.reservationMode === "balance_check" && hasEscrowWallet() && listing.sellerWalletAddress) {
      try {
        const ref = await transferFromEscrow(listing.sellerWalletAddress, listing.priceTon);
        escrowTransfer = { ok: true, transactionRef: ref };
      } catch (err) {
        escrowTransfer = { ok: false, error: err instanceof Error ? err.message : "Escrow transfer failed." };
      }
    }

    const sellerNotification = await notifySellerFundsReleased(listing);
    return NextResponse.json({ listing, sellerNotification, escrowTransfer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
