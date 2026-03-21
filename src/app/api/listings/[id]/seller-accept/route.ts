import { NextResponse } from "next/server";

import { acceptMeetup } from "@/lib/services/listings-service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const listing = await acceptMeetup(id);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept meetup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
