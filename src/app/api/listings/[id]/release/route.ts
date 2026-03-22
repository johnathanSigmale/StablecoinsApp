import { NextResponse } from "next/server";

import { releaseListingEscrow } from "@/lib/services/listings-service";
import { notifySellerFundsReleased } from "@/lib/services/telegram-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    releaseCode?: string;
    transactionRef?: string;
  };

  try {
    const listing = await releaseListingEscrow(id, {
      providedCode: body.releaseCode,
      transactionRef: body.transactionRef,
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    const sellerNotification = await notifySellerFundsReleased(listing);
    return NextResponse.json({ listing, sellerNotification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to release escrow.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
