import Link from "next/link";

import { CreateListingForm } from "@/components/create-listing-form";

export default function CreateListingPage() {
  return (
    <main className="pageShell">
      <section className="sectionHeader">
        <div>
          <span className="eyebrow">New Listing</span>
          <h1>Generate a seller-ready listing draft</h1>
        </div>
        <Link className="secondaryButton" href="/">
          Back home
        </Link>
      </section>

      <CreateListingForm />
    </main>
  );
}
