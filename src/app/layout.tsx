import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";

import { TelegramWebAppInit } from "@/components/telegram-webapp-init";
import { TonProvider } from "@/components/providers/ton-provider";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: appConfig.appName,
  description: appConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramWebAppInit />
        <TonProvider>
          <header className="siteHeader">
            <div className="siteHeaderInner">
              <Link className="siteLogo" href="/">
                <span className="logoMark">J</span>
                JohnTon
              </Link>
              <nav className="siteNav">
                <Link href="/">Marketplace</Link>
                <Link className="primaryButton" href="/create">
                  Sell
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </TonProvider>
      </body>
    </html>
  );
}
