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
            FlipBot AI turns a single seller message into a polished listing, then lets buyers lock funds with TON and
            complete the meetup using a clean escrow release flow.
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
            <p>“Selling my Quest 2 with charger and case. Great condition. Need a fast meetup in Casa.”</p>
          </div>
          <div className="chatBubble botBubble">
            <span>FlipBot AI</span>
            <p>
              Draft ready: <strong>Meta Quest 2 128GB</strong> at <strong>145 TON</strong>. Share to your Telegram group
              and accept secure TON checkout.
            </p>
          </div>
          <div className="metricStrip">
            <div>
              <strong>1 message</strong>
              <span>to create a listing</span>
            </div>
            <div>
              <strong>TON escrow</strong>
              <span>instead of cash meetup risk</span>
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
          <p>Use the bot to generate title, summary, price suggestion and a shareable commerce link in seconds.</p>
        </article>
        <article className="glassPanel">
          <span className="eyebrow">Buyer UX</span>
          <h2>Wallet-connected checkout</h2>
          <p>Buyers discover listings in Telegram, open the Mini App and lock funds with TON instead of carrying cash.</p>
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
