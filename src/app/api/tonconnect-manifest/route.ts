import { NextResponse } from "next/server";

import { appConfig } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    url: appConfig.appUrl,
    name: appConfig.appName,
    iconUrl: `${appConfig.appUrl}/flipbot-mark.svg`,
    termsOfUseUrl: appConfig.appUrl,
    privacyPolicyUrl: appConfig.appUrl,
  });
}
