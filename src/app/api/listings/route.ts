import { NextResponse } from "next/server";

import { createListing, listListings } from "@/lib/services/listings-service";

export async function GET() {
  const listings = await listListings();
  return NextResponse.json(listings);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sellerPrompt?: string;
      imageUrl?: string;
      sellerHandle?: string;
      sellerWalletAddress?: string;
      city?: string;
      desiredPriceTon?: number;
    };

    if (!body.sellerPrompt || !body.imageUrl || !body.sellerHandle || !body.city) {
      return NextResponse.json({ error: "sellerPrompt, imageUrl, sellerHandle and city are required." }, { status: 400 });
    }

    const listing = await createListing({
      sellerPrompt: body.sellerPrompt,
      imageUrl: body.imageUrl,
      sellerHandle: body.sellerHandle,
      sellerWalletAddress: body.sellerWalletAddress,
      city: body.city,
      desiredPriceTon: body.desiredPriceTon,
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listing creation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}