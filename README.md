# JohnTon

**Buy and sell anything locally on TON** — AI-powered listings, Telegram-native, with secure escrow.

## What it does

JohnTon is a local marketplace built on TON and distributed through Telegram.

- A seller sends a photo and a short message to the JohnTon bot.
- The bot identifies the product, searches for current market prices, and generates a polished listing.
- The listing is shared as a link in any Telegram group or chat.
- A buyer reserves the item, verifies they have the funds, and meets the seller in person.
- After inspecting the item, the buyer confirms the transaction — TON is sent to the seller.

No codes, no manual steps. Just a button.

## Problem

Buying and selling in Telegram groups is already happening at scale, but trust and payment are still broken:

- Listings are informal, inconsistent, and hard to share cleanly.
- Payment is done with screenshots, cash, or promises.
- There is no escrow, no dispute path, and no buyer protection.

JohnTon fixes all three with a single Telegram bot and a lightweight web app.

## Core Features

- **AI listing generation** — one photo + message creates a complete, priced listing
- **Web search grounding** — Gemini searches for real market prices before estimating
- **AI clarification loop** — the bot asks for a clearer photo or missing info when needed
- **Telegram-native sharing** — every listing has a shareable link ready for groups
- **TON Connect escrow** — buyer balance is verified at reservation; payment only moves on buyer confirmation
- **Seller accept/cancel flow** — seller controls the meetup via Telegram inline buttons
- **No release codes** — buyer confirms with a single button after the in-person inspection

## Flow

```
Seller sends photo + caption
        ↓
JohnTon identifies product + searches prices
        ↓
Listing generated and shared in Telegram
        ↓
Buyer reserves (balance verified, no payment yet)
        ↓
Seller accepts meetup via Telegram
        ↓
In-person inspection
        ↓
Buyer taps "Confirm transaction" → TON sent to seller
```

## Stack

- **Frontend**: Next.js 15 App Router
- **Bot**: Telegram Bot API webhook
- **AI**: Gemini (image identification + web search grounding + structured JSON generation)
- **Blockchain**: TON Connect + `@ton/ton` for wallet verification and transfer
- **Storage**: Redis (production) / local JSON (development)

## Local Setup

```bash
git clone <repo-url>
cd StablecoinsApp
npm install
npm run dev
```

### Environment Variables

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username
TON_API_BASE_URL=https://testnet.toncenter.com/api/v2
NEXT_PUBLIC_TON_NETWORK=testnet
KV_REST_API_URL=optional_redis_url
KV_REST_API_TOKEN=optional_redis_token
```

### Commands

```bash
npm run dev       # start dev server
npm run build     # production build
npm run lint      # lint
npm run typecheck # type check
```

## Repo Structure

```
src/
  app/
    page.tsx                        # marketplace homepage
    create/                         # manual listing creation
    listings/[id]/                  # listing detail + purchase flow
    seller-action/                  # seller accept/cancel page
    api/
      listings/                     # listing CRUD + purchase/release/cancel
      telegram/webhook/             # Telegram bot entry point
      tonconnect-manifest/          # TON Connect manifest
  components/
    purchase-panel.tsx              # buyer reservation + confirmation UI
    listing-card.tsx
    create-listing-form.tsx
  lib/
    services/
      ai-listing-service.ts         # Gemini pipeline (identify → price search → draft)
      listings-service.ts
      telegram-service.ts
      ton-service.ts
    repository/
      listings-repository.ts
      seller-profiles-repository.ts
    types.ts
    config.ts
```

## Roadmap

- On-chain smart contract escrow (Tact)
- Search and filtering across listings
- Seller reputation and profile pages
- Multi-photo listings
- Dispute handling
- Merchant mode for small businesses
