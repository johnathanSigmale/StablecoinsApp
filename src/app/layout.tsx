import type { Metadata } from "next";
import "./globals.css";

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
        <TonProvider>{children}</TonProvider>
      </body>
    </html>
  );
}
