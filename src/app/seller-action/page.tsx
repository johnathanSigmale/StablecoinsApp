import Link from "next/link";
import { notFound } from "next/navigation";

import { acceptMeetup, cancelListingEscrow, findListing } from "@/lib/services/listings-service";

type SellerActionPageProps = {
  searchParams: Promise<{
    action?: string;
    listingId?: string;
    chatId?: string;
  }>;
};

export default async function SellerActionPage({ searchParams }: SellerActionPageProps) {
  const params = await searchParams;
  const action = params.action;
  const listingId = params.listingId;
  const chatId = Number(params.chatId || 0);

  if (!listingId || !action || !["accept", "cancel"].includes(action)) {
    notFound();
  }

  const listing = await findListing(listingId);
  if (!listing) {
    notFound();
  }

  if (listing.sellerTelegramChatId && chatId && listing.sellerTelegramChatId !== chatId) {
    return (
      <main className="pageShell">
        <section className="glassPanel">
          <span className="eyebrow">Seller Action</span>
          <h1>Unauthorized chat</h1>
          <p>This seller action link does not match the Telegram chat that created the listing.</p>
          <Link className="secondaryButton" href={`/listings/${listing.id}`}>
            Open listing
          </Link>
        </section>
      </main>
    );
  }

  try {
    const updatedListing =
      action === "accept"
        ? await acceptMeetup(listingId)
        : await cancelListingEscrow(listingId, "Seller cancelled the reservation from Telegram.");

    if (!updatedListing) {
      notFound();
    }

    return (
      <main className="pageShell">
        <section className="glassPanel">
          <span className="eyebrow">Seller Action</span>
          <h1>{action === "accept" ? "Meetup accepted" : "Reservation cancelled"}</h1>
          <p>
            {action === "accept"
              ? "The buyer can now inspect the item in person. Keep the release code private until the meetup is complete."
              : "The listing is active again and can be reserved by another buyer."}
          </p>
          <Link className="primaryButton" href={`/listings/${updatedListing.id}`}>
            Open listing
          </Link>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Seller action failed.";

    return (
      <main className="pageShell">
        <section className="glassPanel">
          <span className="eyebrow">Seller Action</span>
          <h1>Action already processed</h1>
          <p>{message}</p>
          <Link className="primaryButton" href={`/listings/${listing.id}`}>
            Open listing
          </Link>
        </section>
      </main>
    );
  }
}
