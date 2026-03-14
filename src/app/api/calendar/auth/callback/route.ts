import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return new NextResponse(
      `<html><body style="background:#0d0d0d;color:#ff4444;font-family:monospace;padding:40px;text-align:center">
        <h2>OAuth Error</h2>
        <p>${error || "No authorization code received"}</p>
        <p style="color:#666;font-size:12px;margin-top:20px">You can close this window.</p>
      </body></html>`,
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
        `<html><body style="background:#0d0d0d;color:#ff4444;font-family:monospace;padding:40px;text-align:center">
          <h2>Token Exchange Failed</h2>
          <p>${tokenData.error_description || tokenData.error || "Unknown error"}</p>
          <p style="color:#666;font-size:12px;margin-top:20px">You can close this window.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Send token back to opener via postMessage, then close
    const token = tokenData.access_token;
    return new NextResponse(
      `<html><body style="background:#0d0d0d;color:#00ff88;font-family:monospace;padding:40px;text-align:center">
        <h2>Connected!</h2>
        <p>This window will close automatically.</p>
        <script>
          window.opener.postMessage({ type: 'GCAL_TOKEN', token: '${token}' }, '*');
          setTimeout(function() { window.close(); }, 500);
        </script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return new NextResponse(
      `<html><body style="background:#0d0d0d;color:#ff4444;font-family:monospace;padding:40px;text-align:center">
        <h2>OAuth Error</h2>
        <p>An unexpected error occurred during authentication.</p>
        <p style="color:#666;font-size:12px;margin-top:20px">You can close this window.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}
