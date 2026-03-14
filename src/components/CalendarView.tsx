"use client";

import { useApp } from "@/lib/store";
import { useState, useEffect } from "react";
import { GoogleEvent, StudySession } from "@/lib/types";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function CalendarView() {
  const { state, dispatch } = useApp();
  const [examDate, setExamDate] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"week" | "list">("week");
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);

  const { calendarPlan, googleAccessToken, analysisResult } = state;

  // Check for token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("google_token");
    if (token) {
      localStorage.setItem("google_access_token", token);
      dispatch({ type: "SET_GOOGLE_TOKEN", token });
      window.history.replaceState({}, "", "/");
    } else {
      const stored = localStorage.getItem("google_access_token");
      if (stored) {
        dispatch({ type: "SET_GOOGLE_TOKEN", token: stored });
      }
    }
  }, [dispatch]);

  const connectGoogle = async () => {
    try {
      const res = await fetch("/api/calendar/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("Could not get auth URL. Check GOOGLE_CLIENT_ID config.");
      }
    } catch {
      setError("Failed to connect to Google");
    }
  };

  const fetchEvents = async () => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch("/api/calendar/events", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch events");
    }
  };

  useEffect(() => {
    if (googleAccessToken) fetchEvents();
  }, [googleAccessToken]);

  const handlePlan = async () => {
    if (!examDate || !examSubject) return;
    setPlanning(true);
    setError("");

    try {
      const res = await fetch("/api/calendar/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events,
          examDateTime: examDate,
          examSubject,
          topics: analysisResult?.topics || [],
        }),
      });

      if (!res.ok) throw new Error("Planning failed");
      const plan = await res.json();
      dispatch({ type: "SET_CALENDAR_PLAN", plan });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed");
    } finally {
      setPlanning(false);
    }
  };

  // Step 1: Connect Google
  if (!googleAccessToken) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="font-heading text-white text-2xl font-bold mb-2">
            Study Calendar
          </h2>
          <p className="font-mono text-muted text-xs tracking-wider mb-8">
            CONNECT YOUR GOOGLE CALENDAR TO PLAN STUDY SESSIONS
          </p>
          <button
            onClick={connectGoogle}
            className="px-6 py-3 bg-accent text-bg font-mono text-sm font-bold tracking-wider rounded-lg hover:bg-accent/90 transition-colors"
          >
            CONNECT GOOGLE CALENDAR
          </button>
          {error && (
            <p className="font-mono text-danger text-xs mt-4">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Step 2/3: Set exam details and plan
  if (!calendarPlan) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="font-heading text-white text-2xl font-bold mb-2">
              Study Calendar
            </h2>
            <p className="font-mono text-muted text-xs tracking-wider">
              CALENDAR CONNECTED — SET YOUR EXAM DETAILS
            </p>
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.15em] text-muted block mb-2">
              EXAM SUBJECT
            </label>
            <input
              type="text"
              value={examSubject}
              onChange={(e) => setExamSubject(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-muted/40 focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[0.15em] text-muted block mb-2">
              EXAM DATE & TIME
            </label>
            <input
              type="datetime-local"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-white focus:outline-none focus:border-accent/50 [color-scheme:dark]"
            />
          </div>

          <button
            onClick={handlePlan}
            disabled={!examDate || !examSubject || planning}
            className="w-full py-3 bg-accent text-bg font-mono text-sm font-bold tracking-wider rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            {planning ? "PLANNING..." : "PLAN MY STUDY SCHEDULE"}
          </button>

          {error && (
            <p className="font-mono text-danger text-xs">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Step 4: Display calendar
  const weekDates = getWeekDates(weekOffset);
  const { studySessions, summary, totalStudyHours, daysUntilExam } =
    calendarPlan;

  const getEventsForDateHour = (date: string, hour: number) => {
    return events.filter((e) => {
      const start = e.start?.dateTime;
      if (!start) return false;
      const d = new Date(start);
      return dateStr(d) === date && d.getHours() === hour;
    });
  };

  const getSessionsForDateHour = (date: string, hour: number) => {
    return studySessions.filter((s) => {
      return s.date === date && parseInt(s.startTime.split(":")[0]) === hour;
    });
  };

  const intensityBadge = (intensity: string) => {
    const colors: Record<string, string> = {
      deep: "text-accent border-accent/30 bg-accent/10",
      review: "text-amber border-amber/30 bg-amber/10",
      light: "text-muted border-border bg-white/5",
    };
    return colors[intensity] || colors.light;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Summary cards */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-white text-2xl font-bold">
            Study Calendar
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
                viewMode === "week"
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-white"
              }`}
            >
              WEEK
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 font-mono text-xs rounded border transition-colors ${
                viewMode === "list"
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-muted hover:text-white"
              }`}
            >
              LIST
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "TOTAL HOURS", value: `${totalStudyHours.toFixed(1)}h` },
            { label: "DAYS UNTIL EXAM", value: daysUntilExam },
            { label: "SESSIONS", value: studySessions.length },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-surface border border-border rounded-lg p-3"
            >
              <div className="font-mono text-[10px] tracking-[0.15em] text-muted">
                {card.label}
              </div>
              <div className="font-mono text-xl text-white mt-1">
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-xs text-muted">{summary}</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {viewMode === "week" ? (
          <div className="flex-1 overflow-auto">
            {/* Week navigation */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface sticky top-0 z-10">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="font-mono text-xs text-muted hover:text-white"
              >
                ← PREV
              </button>
              <span className="font-mono text-xs text-white">
                {weekDates[0].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                —{" "}
                {weekDates[6].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="font-mono text-xs text-muted hover:text-white"
              >
                NEXT →
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Header */}
              <div className="border-b border-r border-border bg-surface p-2" />
              {DAYS.map((day, i) => (
                <div
                  key={day}
                  className="border-b border-r border-border bg-surface p-2 text-center"
                >
                  <div className="font-mono text-[10px] tracking-wider text-muted">
                    {day}
                  </div>
                  <div className="font-mono text-xs text-white mt-0.5">
                    {weekDates[i].getDate()}
                  </div>
                </div>
              ))}

              {/* Time rows */}
              {HOURS.map((hour) => (
                <>
                  <div
                    key={`time-${hour}`}
                    className="border-b border-r border-border p-1 text-right"
                  >
                    <span className="font-mono text-[10px] text-muted">
                      {hour > 12 ? hour - 12 : hour}
                      {hour >= 12 ? "p" : "a"}
                    </span>
                  </div>
                  {weekDates.map((date, di) => {
                    const ds = dateStr(date);
                    const googleEvents = getEventsForDateHour(ds, hour);
                    const sessions = getSessionsForDateHour(ds, hour);

                    return (
                      <div
                        key={`${hour}-${di}`}
                        className="border-b border-r border-border p-0.5 min-h-[40px] relative"
                      >
                        {googleEvents.map((e, ei) => (
                          <div
                            key={ei}
                            className="text-[9px] font-mono px-1 py-0.5 bg-white/10 text-muted rounded truncate mb-0.5"
                          >
                            {e.summary}
                          </div>
                        ))}
                        {sessions.map((s, si) => (
                          <div
                            key={si}
                            onClick={() => setSelectedSession(s)}
                            className="text-[9px] font-mono px-1 py-0.5 bg-accent/20 text-accent rounded truncate mb-0.5 cursor-pointer hover:bg-accent/30"
                          >
                            {s.focus}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        ) : (
          /* List view */
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-3">
              {studySessions.map((session, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedSession(session)}
                  className={`bg-surface border rounded-lg p-4 cursor-pointer transition-colors hover:bg-white/[0.02] ${
                    selectedSession === session
                      ? "border-accent"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-white">
                      {session.focus}
                    </span>
                    <span
                      className={`font-mono text-[10px] tracking-wider px-2 py-0.5 rounded border uppercase ${intensityBadge(session.intensity)}`}
                    >
                      {session.intensity}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-xs text-muted">
                    <span>{session.date}</span>
                    <span>
                      {formatTime(session.startTime)} —{" "}
                      {formatTime(session.endTime)}
                    </span>
                    <span>{session.durationMinutes}min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail panel */}
        {selectedSession && (
          <div className="w-72 border-l border-border bg-surface p-5 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] tracking-[0.15em] text-muted">
                SESSION DETAIL
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-muted hover:text-white font-mono text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="font-heading text-white text-lg font-bold mb-4">
              {selectedSession.focus}
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">DATE</span>
                <span className="font-mono text-xs text-white">
                  {selectedSession.date}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">TIME</span>
                <span className="font-mono text-xs text-white">
                  {formatTime(selectedSession.startTime)} —{" "}
                  {formatTime(selectedSession.endTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-muted">DURATION</span>
                <span className="font-mono text-xs text-white">
                  {selectedSession.durationMinutes} min
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-muted">INTENSITY</span>
                <span
                  className={`font-mono text-[10px] tracking-wider px-2 py-0.5 rounded border uppercase ${intensityBadge(selectedSession.intensity)}`}
                >
                  {selectedSession.intensity}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <span className="font-mono text-[10px] tracking-[0.15em] text-muted">
                NOTES
              </span>
              <p className="font-mono text-xs text-white/80 mt-2 leading-relaxed">
                {selectedSession.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
