import { NextRequest, NextResponse } from "next/server";

interface CalendarListEntry {
  id: string;
  summary: string;
  colorId?: string;
  selected?: boolean;
}

interface GoogleEventItem {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  colorId?: string;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Step 1: Fetch all calendars
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      const err = await listRes.json();
      return NextResponse.json(
        { error: err.error?.message || "Failed to fetch calendar list" },
        { status: listRes.status }
      );
    }

    const listData = await listRes.json();
    const calendars: CalendarListEntry[] = listData.items || [];

    // Step 2: Fetch events from each calendar in parallel
    const allEvents = await Promise.all(
      calendars.map(async (cal) => {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events`
        );
        url.searchParams.set("timeMin", now.toISOString());
        url.searchParams.set("timeMax", thirtyDaysLater.toISOString());
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", "250");

        try {
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.items || []).map((item: GoogleEventItem) => ({
            id: item.id,
            summary: item.summary || "",
            start: item.start || {},
            end: item.end || {},
            calendarId: cal.id,
            calendarName: cal.summary,
            colorId: item.colorId || cal.colorId,
          }));
        } catch {
          return [];
        }
      })
    );

    // Step 3: Merge, deduplicate by id, sort by start time
    const seen = new Set<string>();
    const merged = allEvents
      .flat()
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => {
        const aTime = a.start?.dateTime || a.start?.date || "";
        const bTime = b.start?.dateTime || b.start?.date || "";
        return aTime.localeCompare(bTime);
      });

    return NextResponse.json({
      events: merged,
      calendars: calendars.map((c) => ({ id: c.id, summary: c.summary, colorId: c.colorId })),
    });
  } catch (error: unknown) {
    console.error("Calendar events error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
