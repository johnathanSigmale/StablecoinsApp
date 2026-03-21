import { NextResponse } from "next/server";

import { createListing, listListings } from "@/lib/services/listings-service";

export async function GET() {
  const listings = await listListings();
  return NextResponse.json(listings);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sellerPrompt?: string;
    imageUrl?: string;
    sellerHandle?: string;
    city?: string;
    desiredPriceTon?: number;
  };

  if (!body.sellerPrompt || !body.sellerHandle || !body.city) {
    return NextResponse.json({ error: "sellerPrompt, sellerHandle and city are required." }, { status: 400 });
  }

  const listing = await createListing({
    sellerPrompt: body.sellerPrompt,
    imageUrl: body.imageUrl,
    sellerHandle: body.sellerHandle,
    city: body.city,
    desiredPriceTon: body.desiredPriceTon,
  });

  return NextResponse.json(listing, { status: 201 });
}
