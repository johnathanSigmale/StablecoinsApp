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

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const listing = await findListing(id);

  if (!listing) {
    notFound();
  }

  const shareText = buildTelegramShareText(listing);

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
        />
      </section>

      <section className="twoUp">
        <article className="glassPanel">
          <span className="eyebrow">AI Insight</span>
          <h2>Why this should convert</h2>
          <p>{listing.aiInsights.pricingRationale}</p>
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
