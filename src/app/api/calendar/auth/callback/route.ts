import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse(
      `<html><body><script>window.opener?.postMessage({type:"oauth_error",error:"no_code"},"*");window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/calendar/auth/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", tokenData);
      return new NextResponse(
        `<html><body><script>window.opener?.postMessage({type:"oauth_error",error:"token_failed"},"*");window.close();</script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse(
      `<html><body><script>window.opener?.postMessage({type:"oauth_success",token:"${tokenData.access_token}"},"*");window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new NextResponse(
      `<html><body><script>window.opener?.postMessage({type:"oauth_error",error:"oauth_failed"},"*");window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
