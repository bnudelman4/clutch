import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google Client ID not configured" },
      { status: 500 }
    );
  }

  // Dynamically get the exact origin of the request to prevent cross-origin popup blocking on Vercel
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/calendar/auth/callback`;
  const scope = "https://www.googleapis.com/auth/calendar.readonly";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
