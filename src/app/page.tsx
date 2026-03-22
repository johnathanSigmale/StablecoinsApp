import Link from "next/link";

import { ListingCard } from "@/components/listing-card";
import { listListings } from "@/lib/services/listings-service";

export default async function HomePage() {
  const listings = await listListings();

  return (
    <main className="pageShell">
      <section className="heroSection">
        <div className="heroCopy">
          <span className="eyebrow">AlphaTON Capital Track</span>
          <h1>Conversational commerce on TON, built for Telegram distribution.</h1>
          <p>
            FlipBot AI turns one seller message into a polished listing, then lets buyers reserve a meetup, verify wallet
            readiness, and complete payment only after the in-person check.
          </p>
          <div className="actionRow">
            <Link className="primaryButton" href="/create">
              Create listing
            </Link>
            <a className="secondaryButton" href="#listings">
              Explore live demo
            </a>
          </div>
        </div>
        <div className="heroPanel glassPanel">
          <div className="chatBubble sellerBubble">
            <span>@seller</span>
            <p>&ldquo;Selling my Quest 2 with charger and case. Great condition. Need a fast meetup in Casa.&rdquo;</p>
          </div>
          <div className="chatBubble botBubble">
            <span>FlipBot AI</span>
            <p>
              Draft ready: <strong>Meta Quest 2 128GB</strong> at <strong>145 TON</strong>. Share it in Telegram and let
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
              <span>release code at handoff</span>
            </div>
            <div>
              <strong>Telegram-native</strong>
              <span>distribution path</span>
            </div>
          </div>
        </div>
      </section>

      <section className="threeUp">
        <article className="glassPanel">
          <span className="eyebrow">Seller UX</span>
          <h2>Photo or text in, listing out</h2>
          <p>Use the bot to generate the listing, attach your wallet, and push a shareable commerce link in seconds.</p>
        </article>
        <article className="glassPanel">
          <span className="eyebrow">Buyer UX</span>
          <h2>Reserve first, pay after inspection</h2>
          <p>Buyers discover listings in Telegram, open the Mini App, reserve the meetup, and pay only after checking the product.</p>
        </article>
        <article className="glassPanel">
          <span className="eyebrow">Business</span>
          <h2>Practical fee model</h2>
          <p>Charge a take rate on released escrow or premium boosts for sellers posting into high-intent groups.</p>
        </article>
      </section>

      <section className="sectionHeader" id="listings">
        <div>
          <span className="eyebrow">Live Demo</span>
          <h2>Active listings</h2>
        </div>
        <Link className="secondaryButton" href="/create">
          Add a new listing
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
