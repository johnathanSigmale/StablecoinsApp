# FlipBot AI

**One-line pitch:** FlipBot AI turns Telegram into a conversational commerce assistant on TON, where users can create listings with AI, share them instantly, and complete secure escrow-style checkout with minimal friction.

## Problem

Buying and selling second-hand items in chat groups is fast, but trust is weak.

People want a simple way to:

- Create listings quickly from a photo or short message.
- Avoid awkward back-and-forth just to describe an item.
- Buy with confidence without relying on cash, screenshots, or informal promises.
- Keep the experience inside Telegram, where the audience already is.

The gap is not transaction volume. The gap is trust + convenience.

## Solution

FlipBot AI is a Telegram-native conversational commerce flow built for TON.

Instead of forcing users into a complex marketplace UI, FlipBot AI lets them talk to a bot:

- A seller sends a photo and a short message.
- The bot suggests a title, description, category, and price.
- The bot generates a shareable listing card for Telegram.
- A buyer taps a secure purchase flow and pays with TON.
- Funds are held in an escrow-style flow until the deal is confirmed.

The experience is designed to feel like chatting with an assistant, not using a shopping app.

## Core Features

- AI-assisted listing creation from text and image.
- Telegram-native listing sharing for groups and channels.
- Secure checkout flow with TON Connect.
- Escrow-style transaction state tracking.
- Buyer/seller confirmation flow for release of funds.
- Demo-friendly local data model for listings, orders, and statuses.
- Clean onboarding path for users who already have a TON wallet.

## Architecture Overview

FlipBot AI is intentionally split into a few simple layers:

- Telegram Bot Layer: receives messages, photos, commands, and button actions.
- AI Layer: generates listing text, categorization, pricing suggestions, and optional moderation logic.
- App Layer: serves a lightweight web experience or mini app for listing details and checkout.
- TON Layer: handles wallet connection and testnet transaction flow.
- Storage Layer: keeps listings, users, orders, and escrow status.

High-level flow:

1. Seller talks to the bot.
2. AI converts the message into a structured listing.
3. Listing is stored and shared through Telegram.
4. Buyer opens the listing and starts checkout.
5. TON transaction is initiated.
6. Escrow state updates until the deal is confirmed.

## MVP Demo Flow

The hackathon demo should stay focused on one happy path:

1. User opens the Telegram bot.
2. User sends a photo of an item to sell.
3. The bot proposes a title, price, and short description.
4. User confirms the listing.
5. The bot generates a shareable Telegram message/card.
6. Another user opens the listing and taps buy.
7. Buyer connects a TON wallet and starts payment on testnet.
8. The demo shows the escrow state changing from pending to confirmed.

This is enough to communicate innovation, usability, and a credible TON-based business flow.

## Stack

- Frontend: Next.js App Router mini app
- UI: custom responsive React components
- Bot/Webhook Layer: Telegram Bot API compatible webhook route
- AI: Gemini REST integration with local heuristic fallback if no API key is present
- Blockchain: TON Connect ready flow for testnet checkout
- Backend: Node.js + TypeScript + Next.js route handlers
- Storage: local JSON store for hackathon demo speed

## Local Setup

```bash
git clone <repo-url>
cd flipbot-ai
npm install
npm run dev
```

### Environment Variables

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_TON_ADDRESS=optional_testnet_wallet_or_escrow_address
GEMINI_API_KEY=optional_for_real_ai_listing_generation
TELEGRAM_BOT_TOKEN=optional_for_real_bot_wiring
TELEGRAM_BOT_USERNAME=your_bot_username
```

### Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Testnet Notes

FlipBot AI is built for a hackathon-first testnet demo.

- Use TON testnet for every blockchain interaction during development.
- Set `NEXT_PUBLIC_DEMO_TON_ADDRESS` to enable a wallet-connected TON transfer.
- If no TON address is configured, the escrow flow stays simulated so the demo remains reliable.
- Make the escrow state visible in the UI so judges can understand the flow immediately.
- Avoid mainnet assumptions unless the product is being prepared for post-hackathon deployment.

## Repo Structure

```text
.
|-- .env.example
|-- eslint.config.mjs
|-- package.json
|-- README.md
|-- data/
|-- public/
|-- src/
|   |-- app/
|   |-- components/
|   `-- lib/
`-- tsconfig.json
```

Main routes currently implemented:

- `/` landing page + active listings
- `/create` seller listing generation flow
- `/listings/[id]` listing detail + purchase/release flow
- `/api/listings` listing read/create API
- `/api/telegram/webhook` Telegram webhook-compatible entry point
- `/api/tonconnect-manifest` TON Connect manifest

## Roadmap

### MVP

- Telegram bot onboarding.
- AI-assisted listing creation.
- Listing generation and sharing.
- TON testnet checkout flow.
- Escrow state updates.
- JSON-backed persistence for quick local demos.

### Next

- Search and discovery across listings.
- Seller reputation or profile trust markers.
- Better pricing suggestions using market context.
- Lightweight analytics for conversion and retention.

### Later

- Shipping integration.
- Multi-item carts.
- Dispute handling workflow.
- Merchant mode for small businesses.
- Deeper TON-native monetization features.

## 5-Minute Pitch Outline

### 0:00 - 0:45

Introduce the problem: people already buy and sell in Telegram, but trust and checkout are messy.

### 0:45 - 1:30

Show the core idea: a conversational assistant that turns a message or photo into a listing on TON.

### 1:30 - 2:30

Walk through the seller flow: send a photo, get an AI-generated listing, share it instantly in Telegram.

### 2:30 - 3:30

Walk through the buyer flow: open the listing, connect a wallet, pay on testnet, and place funds in escrow-style flow.

### 3:30 - 4:15

Explain why it is Telegram-native and why TON fits the product: simple onboarding, wallet-ready users, and fast distribution through chats.

### 4:15 - 5:00

Close with product-market fit and monetization: transaction fee, boosted listings, and a realistic path to adoption in existing Telegram communities.

## Why This Can Win

- The idea is simple to understand in seconds.
- The demo path is short enough to execute well.
- The product feels native to Telegram instead of bolted on.
- TON is used for a real reason: secure value transfer, not just branding.
- The AI component improves usability, not just novelty.

## License

[placeholder] Add the license that matches the final repo policy.
