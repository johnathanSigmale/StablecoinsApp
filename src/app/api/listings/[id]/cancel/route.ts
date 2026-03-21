import { NextResponse } from "next/server";

import { cancelListingEscrow } from "@/lib/services/listings-service";

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
    const listing = await cancelListingEscrow(id, body.reason);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel meetup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
