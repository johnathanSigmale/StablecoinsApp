import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchasePanel } from "@/components/purchase-panel";
import { findListing } from "@/lib/services/listings-service";
import { buildTelegramShareText } from "@/lib/services/telegram-service";
import { formatTon } from "@/lib/utils";

type ListingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function describeEscrowStep(status: string) {
  switch (status) {
    case "draft":
      return {
        title: "Waiting for a buyer",
        description: "The seller posted the listing and is waiting for someone to reserve it.",
      };
    case "funds_locked":
      return {
        title: "Funds locked",
        description: "A buyer reserved the item and locked funds in TON. The seller now verifies that payment exists.",
      };
    case "seller_accepted":
      return {
        title: "Meetup accepted",
        description: "The seller accepted the meetup. The buyer inspects the item in person before releasing funds.",
      };
    case "released":
      return {
        title: "Funds released",
        description: "The buyer confirmed the item after inspection, so the seller received payment.",
      };
    case "cancelled":
      return {
        title: "Meetup cancelled",
        description: "The buyer did not approve the handoff, so the escrow remained unreleased.",
      };
    default:
      return {
        title: "Escrow draft",
        description: "The listing exists, but no buyer has locked funds yet.",
      };
  }
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const listing = await findListing(id);

  if (!listing) {
    notFound();
  }

  const shareText = buildTelegramShareText(listing);
  const escrowStep = describeEscrowStep(listing.escrow.status);

  return (
    <main className="pageShell">
      <section className="listingDetail">
        <div className="listingVisual glassPanel">
          <div
            className="detailImage"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(11,18,32,0.05), rgba(11,18,32,0.6)), url(${listing.imageUrl})`,
            }}
          />
          <div className="detailCopy">
            <div className="pillRow">
              <span className="pill">{listing.category}</span>
              <span className="pill">{listing.status}</span>
              <span className="pill">{listing.city}</span>
            </div>
            <h1>{listing.title}</h1>
            <p>{listing.summary}</p>
            <div className="detailStats">
              <div>
                <span>Price</span>
                <strong>{formatTon(listing.priceTon)}</strong>
              </div>
              <div>
                <span>Seller</span>
                <strong>{listing.sellerHandle}</strong>
              </div>
              <div>
                <span>Condition</span>
                <strong>{listing.condition}</strong>
              </div>
            </div>
          </div>
        </div>

        <PurchasePanel
          listingId={listing.id}
          priceTon={listing.priceTon}
          status={listing.status}
          escrowStatus={listing.escrow.status}
          releaseCode={listing.escrow.releaseCode}
          buyer={listing.escrow.buyer}
          cancellationReason={listing.escrow.cancellationReason}
        />
      </section>

      <section className="twoUp">
        <article className="glassPanel">
          <span className="eyebrow">Generation Debug</span>
          <h2>
            Text: {listing.generation?.textSource || "unknown"} | Image: {listing.generation?.imageSource || "unknown"}
          </h2>
          <p>{listing.generation?.textStatusMessage || "No text status available."}</p>
          <p>{listing.generation?.imageStatusMessage || "No image status available."}</p>
          <div className="tagRow">
            {listing.aiInsights.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        </article>

        <article className="glassPanel">
          <span className="eyebrow">Telegram Share</span>
          <h2>Distribution copy</h2>
          <pre className="shareBox">{shareText}</pre>
          <Link className="secondaryButton" href="/">
            Back to marketplace
          </Link>
        </article>
      </section>
    </main>
  );
}
