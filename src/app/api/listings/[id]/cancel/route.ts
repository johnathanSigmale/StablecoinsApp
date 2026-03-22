import { NextResponse } from "next/server";

import { hasEscrowWallet, transferFromEscrow } from "@/lib/services/escrow-service";
import { cancelListingEscrow, findListing } from "@/lib/services/listings-service";
import { notifySellerBuyerCancelled } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { reason?: string };

  try {
    const listingBeforeCancel = await findListing(id);
    const listing = await cancelListingEscrow(id, body.reason);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    let escrowRefund: { ok: boolean; transactionRef?: string; error?: string } = { ok: true };

    const hadRealPayment =
      listingBeforeCancel?.escrow.reservationMode === "balance_check" &&
      listingBeforeCancel.escrow.transactionRef?.startsWith("tonconnect:");

    if (hadRealPayment && hasEscrowWallet() && listingBeforeCancel?.escrow.buyerWalletAddress) {
      try {
        const ref = await transferFromEscrow(
          listingBeforeCancel.escrow.buyerWalletAddress,
          listingBeforeCancel.priceTon,
        );
        escrowRefund = { ok: true, transactionRef: ref };
      } catch (err) {
        escrowRefund = { ok: false, error: err instanceof Error ? err.message : "Refund transfer failed." };
      }
    }

    const sellerNotification =
      listingBeforeCancel?.sellerTelegramChatId
        ? await notifySellerBuyerCancelled(listingBeforeCancel, body.reason)
        : { ok: false, error: "No seller Telegram chat available." };

    return NextResponse.json({ listing, sellerNotification, escrowRefund });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel reservation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
