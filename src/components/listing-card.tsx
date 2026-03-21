import Link from "next/link";

import { formatTon } from "@/lib/utils";
import type { Listing } from "@/lib/types";

type ListingCardProps = {
  listing: Listing;
};

export function ListingCard({ listing }: ListingCardProps) {
  return (
    <article className="listingCard">
      <div
        className="listingImage"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(11,18,32,0.1), rgba(11,18,32,0.7)), url(${listing.imageUrl})`,
        }}
      />
      <div className="listingContent">
        <div className="pillRow">
          <span className="pill">{listing.category}</span>
          <span className={`pill ${listing.status !== "active" ? "pillMuted" : ""}`}>{listing.status}</span>
        </div>
        <div className="listingHeader">
          <div>
            <h3>{listing.title}</h3>
            <p>{listing.city}</p>
          </div>
          <strong>{formatTon(listing.priceTon)}</strong>
        </div>
        <p className="listingSummary">{listing.summary}</p>
        <div className="listingMeta">
          <span>{listing.condition}</span>
          <span>{listing.sellerHandle}</span>
        </div>
        <Link className="secondaryButton" href={`/listings/${listing.id}`}>
          Open listing
        </Link>
      </div>
    </article>
  );
}
