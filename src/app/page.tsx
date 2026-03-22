import Link from "next/link";

export const dynamic = "force-dynamic";


import { ListingCard } from "@/components/listing-card";
import { listListings } from "@/lib/services/listings-service";

export default async function HomePage() {
  const listings = await listListings();

  return (
    <main className="pageShell">
      <section className="heroSection">
        <div className="heroCopy">
          <span className="eyebrow">Local marketplace on TON</span>
          <h1>Buy and sell anything, locally on TON.</h1>
          <p>
            Send a photo and a message — JohnTon drafts a polished listing instantly. Buyers reserve through Telegram, inspect in person, and pay only once they&apos;re happy.
          </p>
          <div className="actionRow">
            <Link className="primaryButton" href="/create">
              Start selling
            </Link>
            <a className="secondaryButton" href="#listings">
              Browse listings
            </a>
          </div>
        </div>
        <div className="heroPanel glassPanel">
          <div className="chatBubble sellerBubble">
            <span>@seller</span>
            <p>&ldquo;Selling my Quest 2 with charger and case. Great condition. Need a fast meetup in Casa.&rdquo;</p>
          </div>
          <div className="chatBubble botBubble">
            <span>JohnTon</span>
            <p>
              Listing ready: <strong>Meta Quest 2 128GB</strong> at <strong>145 TON</strong>. Share it in Telegram and let
              buyers reserve the meetup in seconds.
            </p>
          </div>
          <div className="metricStrip">
            <div>
              <strong>1 message</strong>
              <span>to create a listing</span>
            </div>
            <div>
              <strong>Meetup-first</strong>
              <span>pay after inspection</span>
            </div>
            <div>
              <strong>Telegram-native</strong>
              <span>built for communities</span>
            </div>
          </div>
        </div>
      </section>

      <section className="threeUp">
        <article className="glassPanel">
          <span className="eyebrow">Sellers</span>
          <h2>Photo in, listing out</h2>
          <p>Message the bot with a photo and description — JohnTon generates the listing, attaches your wallet, and gives you a shareable link.</p>
        </article>
        <article className="glassPanel">
          <span className="eyebrow">Buyers</span>
          <h2>Reserve first, pay after inspection</h2>
          <p>Discover listings in Telegram, reserve the meetup, inspect the product in person, then confirm payment — no risk.</p>
        </article>
        <article className="glassPanel">
          <span className="eyebrow">Payments</span>
          <h2>Secure TON escrow</h2>
          <p>Funds only move when the buyer confirms the transaction after the in-person meetup. Both sides are protected.</p>
        </article>
      </section>

      <section className="sectionHeader" id="listings">
        <div>
          <span className="eyebrow">Marketplace</span>
          <h2>Active listings</h2>
        </div>
        <Link className="secondaryButton" href="/create">
          Add a listing
        </Link>
      </section>

      <section className="listingGrid">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </section>
    </main>
  );
}
