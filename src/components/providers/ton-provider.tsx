"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import type { PropsWithChildren } from "react";

import { appConfig } from "@/lib/config";

export function TonProvider({ children }: PropsWithChildren) {
  const manifestUrl = `${appConfig.appUrl}/api/tonconnect-manifest`;

  return <TonConnectUIProvider manifestUrl={manifestUrl}>{children}</TonConnectUIProvider>;
}
