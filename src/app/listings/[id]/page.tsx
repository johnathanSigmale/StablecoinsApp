import Link from "next/link";
import { notFound } from "next/navigation";

import { PurchasePanel } from "@/components/purchase-panel";
import { findListing } from "@/lib/services/listings-service";
import {
  buildTelegramShareText,
  buildTelegramShareUrl,
  buildTelegramUserUrl,
} from "@/lib/services/telegram-service";
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
        title: "Reservation received",
        description: "A buyer reserved the item. The seller should confirm meetup details on Telegram before accepting.",
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
        description: "The listing exists, but no buyer has reserved it yet.",
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
  const telegramShareUrl = buildTelegramShareUrl(listing);
  const sellerTelegramUrl = buildTelegramUserUrl(listing.sellerHandle);
  const buyerTelegramUrl = buildTelegramUserUrl(listing.escrow.buyer);
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
          <span className="eyebrow">Escrow Flow</span>
          <h2>{escrowStep.title}</h2>
          <p>{escrowStep.description}</p>
          <div className="tagRow">
            {listing.aiInsights.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
          {sellerTelegramUrl ? (
            <a className="secondaryButton" href={sellerTelegramUrl} target="_blank" rel="noreferrer">
              Contact seller on Telegram
            </a>
          ) : null}
          {buyerTelegramUrl ? (
            <a className="secondaryButton" href={buyerTelegramUrl} target="_blank" rel="noreferrer">
              Contact buyer on Telegram
            </a>
          ) : null}
        </article>

        <article className="glassPanel">
          <span className="eyebrow">Telegram Share</span>
          <h2>Distribution copy</h2>
          <pre className="shareBox">{shareText}</pre>
          <a className="primaryButton" href={telegramShareUrl} target="_blank" rel="noreferrer">
            Share in Telegram
          </a>
          <Link className="secondaryButton" href="/">
            Back to marketplace
          </Link>
        </article>
      </section>
    </main>
  );
}
