"use client";

import { useExams } from "@/lib/exam-context";
import { useApp } from "@/lib/store";
import { useState, useEffect, useCallback, useMemo } from "react";
import { GoogleEvent, StudySession, EXAM_TYPES } from "@/lib/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysUntil(dt: string) {
  const diff = new Date(dt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_COLORS = ["#6b7280", "#8b5cf6", "#3b82f6", "#14b8a6", "#f59e0b", "#ec4899", "#84cc16"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function timeToY(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h - START_HOUR + m / 60) * HOUR_HEIGHT;
}

function dateTimeToY(dt: string): number {
  const d = new Date(dt);
  return (d.getHours() - START_HOUR + d.getMinutes() / 60) * HOUR_HEIGHT;
}

function formatMonthRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${months[monday.getMonth()]} ${monday.getDate()} – ${sunday.getDate()}, ${monday.getFullYear()}`;
  }
  return `${months[monday.getMonth()]} ${monday.getDate()} – ${months[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;
}

// Overlap detection for event blocks
interface TimeBlock {
  key: string;
  top: number;
  height: number;
  content: React.ReactNode;
}

function layoutOverlaps(blocks: TimeBlock[]): { block: TimeBlock; colIndex: number; totalCols: number }[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.top - b.top || a.height - b.height);
  const result: { block: TimeBlock; colIndex: number; totalCols: number }[] = [];
  const groups: TimeBlock[][] = [];

  // Group overlapping blocks
  for (const block of sorted) {
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some((g) => g.top < block.top + block.height && block.top < g.top + g.height);
      if (overlaps) {
        group.push(block);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([block]);
  }

  for (const group of groups) {
    const cols: TimeBlock[][] = [];
    for (const block of group) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const lastInCol = cols[c][cols[c].length - 1];
        if (lastInCol.top + lastInCol.height <= block.top) {
          cols[c].push(block);
          placed = true;
          break;
        }
      }
      if (!placed) cols.push([block]);
    }
    const totalCols = Math.min(cols.length, 4);
    for (let c = 0; c < cols.length; c++) {
      for (const block of cols[c]) {
        result.push({ block, colIndex: Math.min(c, 3), totalCols });
      }
    }
  }

  return result;
}

// Plan session type from API
interface PlanSession {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  notes: string;
  type: "deep-study" | "review" | "light";
  priority: "critical" | "high" | "medium";
}

interface SacrificedTopic {
  topicName: string;
  reason: string;
}

export default function CalendarView() {
  const { dispatch } = useApp();
  const {
    exams, addExam, suggestions, setSuggestions, dismissSuggestion,
    addStudySession, googleAccessToken, setGoogleAccessToken, setCurrentExam,
  } = useExams();

  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newType, setNewType] = useState("Midterm");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [planningExamId, setPlanningExamId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(new Date());
  const [sacrificedTopics, setSacrificedTopics] = useState<SacrificedTopic[]>([]);
  const [planSummary, setPlanSummary] = useState<{ sessions: number; hours: number } | null>(null);
  const [calendarNames, setCalendarNames] = useState<string[]>([]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const monday = useMemo(() => {
    const base = getMonday(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  // Listen for OAuth postMessage (GCAL_TOKEN from callback)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "GCAL_TOKEN" && e.data.token) {
        setGoogleAccessToken(e.data.token);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setGoogleAccessToken]);

  // Fetch Google events
  const fetchEvents = useCallback(async () => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch("/api/calendar/events", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.calendars) setCalendarNames(data.calendars.map((c: { summary: string }) => c.summary));
      }
    } catch {}
  }, [googleAccessToken]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const connectGoogle = async () => {
    try {
      const res = await fetch("/api/calendar/auth");
      const data = await res.json();
      if (data.authUrl) {
        const w = 500, h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(data.authUrl, "gcal", `width=${w},height=${h},left=${left},top=${top}`);
      }
    } catch {}
  };

  const disconnectGoogle = () => {
    setGoogleAccessToken(null);
    setEvents([]);
    setCalendarNames([]);
  };

  const handleAddExam = () => {
    if (!newSubject || !newDate) return;
    addExam({
      subjectName: newSubject,
      examType: newType,
      examDateTime: `${newDate}T${newTime}`,
    });
    setNewSubject("");
    setNewDate("");
    setShowAddForm(false);
  };

  const [planError, setPlanError] = useState<string | null>(null);

  const handleAcceptAlert = async (examId: string) => {
    setPlanningExamId(examId);
    setPlanError(null);
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    setSuggestions((prev) =>
      prev.filter((s) => !(s.type === "exam-alert" && s.examId === examId))
    );
    setSacrificedTopics([]);
    setPlanSummary(null);

    try {
      const res = await fetch("/api/calendar/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events,
          examDateTime: exam.examDateTime,
          examSubject: `${exam.subjectName} ${exam.examType}`,
          topics: exam.topics,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Planning failed");
      }
      const plan = await res.json();

      // Handle new API response format
      const sessions: PlanSession[] = plan.sessions || plan.studySessions || [];

      if (sessions.length === 0) {
        throw new Error("No study sessions could be generated");
      }

      const newSuggestions = sessions.map((s: PlanSession) => ({
        type: "schedule-suggestion" as const,
        examId,
        session: {
          id: generateId(),
          examId,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes,
          focus: s.title || s.notes,
          intensity: s.type === "deep-study" ? "deep" as const : s.type === "review" ? "review" as const : "light" as const,
          notes: s.notes,
        },
      }));

      setSuggestions((prev) => [...prev, ...newSuggestions]);

      // Track sacrificed topics
      if (plan.sacrificed && plan.sacrificed.length > 0) {
        setSacrificedTopics(plan.sacrificed);
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Planning failed");
      setSuggestions((prev) => [...prev, { type: "exam-alert", examId }]);
    } finally {
      setPlanningExamId(null);
    }
  };

  const handleAcceptSession = (session: StudySession) => {
    addStudySession(session);
  };

  // Track accepted count for summary
  const scheduleSuggestions = suggestions.filter((s) => s.type === "schedule-suggestion");
  const handleAcceptAndTrack = (session: StudySession, idx: number) => {
    handleAcceptSession(session);
    dismissSuggestion(idx);
    // Check if this was the last suggestion
    const remaining = scheduleSuggestions.length - 1;
    if (remaining === 0) {
      const totalSessions = exams.flatMap((e) => e.studySessions).length + 1;
      const totalHrs = Math.round((exams.flatMap((e) => e.studySessions).reduce((s, ss) => s + ss.durationMinutes, 0) + session.durationMinutes) / 60 * 10) / 10;
      setPlanSummary({ sessions: totalSessions, hours: totalHrs });
    }
  };

  const allSessions = exams.flatMap((e) => e.studySessions);
  const todayStr = dateStr(now);

  const getEventsForDay = (day: string) =>
    events.filter((e) => {
      const start = e.start?.dateTime || e.start?.date || "";
      return start.startsWith(day);
    });

  const getSessionsForDay = (day: string) =>
    allSessions.filter((s) => s.date === day);

  const getExamsOnDay = (day: string) =>
    exams.filter((e) => e.examDateTime.startsWith(day));

  // Current time line position
  const isCurrentWeek = weekDays.some((d) => dateStr(d) === todayStr);
  const currentDayIndex = weekDays.findIndex((d) => dateStr(d) === todayStr);
  const currentTimeY = (now.getHours() - START_HOUR + now.getMinutes() / 60) * HOUR_HEIGHT;
  const showTimeLine = isCurrentWeek && currentTimeY >= 0 && currentTimeY <= TOTAL_HOURS * HOUR_HEIGHT;

  // Filter active suggestions
  const activeSuggestions = suggestions.filter((s) => {
    if (s.type === "exam-alert" && s.dismissedUntil && Date.now() < s.dismissedUntil) return false;
    return true;
  });

  // Group schedule suggestions by day
  const groupedScheduleSuggestions = useMemo(() => {
    const schedCards = activeSuggestions
      .map((s, idx) => ({ card: s, originalIdx: idx }))
      .filter((x) => x.card.type === "schedule-suggestion");

    const groups: Map<string, typeof schedCards> = new Map();
    for (const item of schedCards) {
      if (item.card.type !== "schedule-suggestion") continue;
      const day = item.card.session.date;
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(item);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeSuggestions]);

  const nonScheduleSuggestions = activeSuggestions
    .map((s, idx) => ({ card: s, originalIdx: idx }))
    .filter((x) => x.card.type !== "schedule-suggestion");

  const priorityColor = (p: string) => {
    if (p === "critical") return "text-danger border-danger/30 bg-danger/10";
    if (p === "high") return "text-amber border-amber/30 bg-amber/10";
    return "text-accent border-accent/30 bg-accent/10";
  };

  const intensityColor = (i: string) => {
    if (i === "deep") return "bg-accent/20 text-accent";
    if (i === "review") return "bg-amber/20 text-amber";
    return "bg-white/10 text-muted";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT 75% — Weekly Grid Calendar */}
        <div className="flex-[3] flex flex-col overflow-hidden border-r border-border">
          {/* Header with nav */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-muted hover:text-white transition-colors font-mono text-sm"
                >
                  ‹
                </button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-2 py-1 font-mono text-[10px] tracking-wider text-muted hover:text-white hover:bg-white/10 rounded transition-colors"
                >
                  TODAY
                </button>
                <button
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-muted hover:text-white transition-colors font-mono text-sm"
                >
                  ›
                </button>
              </div>
              <h2 className="font-heading text-white text-lg font-bold">
                {formatMonthRange(monday)}
              </h2>
            </div>
            {!googleAccessToken ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted/30" />
                  <span className="font-mono text-[10px] text-muted tracking-wider">NOT CONNECTED</span>
                </div>
                <button
                  onClick={connectGoogle}
                  className="px-4 py-2 border border-accent text-accent font-mono text-xs tracking-wider rounded-lg hover:bg-accent/10 transition-colors"
                >
                  CONNECT GOOGLE CALENDAR
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="font-mono text-[10px] text-accent tracking-wider">GOOGLE CALENDAR CONNECTED</span>
                </div>
                <button
                  onClick={disconnectGoogle}
                  className="px-3 py-1 border border-border text-muted font-mono text-[10px] tracking-wider rounded hover:text-white hover:border-muted transition-colors"
                >
                  DISCONNECT
                </button>
              </div>
            )}
          </div>

          {/* Day column headers */}
          <div className="flex border-b border-border bg-surface">
            <div className="w-14 shrink-0" />
            {weekDays.map((day, i) => {
              const ds = dateStr(day);
              const isToday = ds === todayStr;
              return (
                <div
                  key={i}
                  className={`flex-1 text-center py-2 border-l border-border ${isToday ? "bg-accent/[0.06]" : ""}`}
                >
                  <div className="font-mono text-[10px] tracking-wider text-muted">
                    {DAY_LABELS[i]}
                  </div>
                  <div
                    className={`font-mono text-sm mt-0.5 ${
                      isToday
                        ? "w-7 h-7 rounded-full bg-accent text-bg mx-auto flex items-center justify-center font-bold"
                        : "text-white"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar legend */}
          {calendarNames.length > 0 && (
            <div className="flex items-center gap-4 px-6 py-1.5 border-b border-border bg-surface">
              {calendarNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAL_COLORS[i % CAL_COLORS.length] }} />
                  <span className="font-mono text-[9px] text-muted truncate max-w-[120px]">{name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Scrollable grid body */}
          <div className="flex-1 overflow-auto">
            <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
              {/* Time gutter */}
              <div className="w-14 shrink-0 relative">
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute right-2 font-mono text-[10px] text-muted"
                    style={{ top: i * HOUR_HEIGHT - 6 }}
                  >
                    {(START_HOUR + i).toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, colIdx) => {
                const ds = dateStr(day);
                const isToday = ds === todayStr;
                const dayEvents = getEventsForDay(ds);
                const daySessions = getSessionsForDay(ds);
                const dayExams = getExamsOnDay(ds);

                // Build all time blocks for overlap detection
                const allBlocks: TimeBlock[] = [];

                dayExams.forEach((exam) => {
                  const y = dateTimeToY(exam.examDateTime);
                  if (y < 0 || y > TOTAL_HOURS * HOUR_HEIGHT) return;
                  allBlocks.push({
                    key: `exam-${exam.id}`,
                    top: Math.max(0, y),
                    height: Math.max(HOUR_HEIGHT * 1.5, 40),
                    content: (
                      <div className="w-full h-full rounded px-1.5 py-1 font-mono text-[10px] font-bold border-l-2 overflow-hidden"
                        style={{ backgroundColor: exam.color + "20", borderLeftColor: exam.color, color: exam.color }}>
                        <div className="truncate">{exam.subjectName}</div>
                        <div className="text-[9px] opacity-70 truncate">{exam.examType}</div>
                      </div>
                    ),
                  });
                });

                dayEvents.forEach((ev, i) => {
                  const startDt = ev.start?.dateTime;
                  const endDt = ev.end?.dateTime;
                  if (!startDt || !endDt) return;
                  const y = dateTimeToY(startDt);
                  const yEnd = dateTimeToY(endDt);
                  const h = Math.max(yEnd - y, 20);
                  if (y < 0 || y > TOTAL_HOURS * HOUR_HEIGHT) return;
                  const calIdx = calendarNames.indexOf(ev.calendarName || "");
                  const calColor = CAL_COLORS[calIdx >= 0 ? calIdx % CAL_COLORS.length : 0];
                  allBlocks.push({
                    key: `gev-${ev.id}-${i}`,
                    top: y,
                    height: h,
                    content: (
                      <div className="w-full h-full rounded px-1.5 py-1 font-mono text-[10px] text-muted overflow-hidden hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: calColor + "18", borderLeft: `2px solid ${calColor}80` }}
                        title={ev.summary}>
                        <div className="truncate">{ev.summary || "Busy"}</div>
                        {h >= 30 && ev.calendarName && (
                          <div className="text-[9px] opacity-50 truncate">{ev.calendarName}</div>
                        )}
                      </div>
                    ),
                  });
                });

                daySessions.forEach((session) => {
                  const exam = exams.find((e) => e.id === session.examId);
                  const color = exam?.color || "#00ff88";
                  const y = timeToY(session.startTime);
                  const yEnd = timeToY(session.endTime);
                  const h = Math.max(yEnd - y, 20);
                  if (y < 0 || y > TOTAL_HOURS * HOUR_HEIGHT) return;
                  allBlocks.push({
                    key: `ss-${session.id}`,
                    top: y,
                    height: h,
                    content: (
                      <div className="w-full h-full rounded px-1.5 py-1 font-mono text-[10px] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: color + "25", borderLeft: `2px solid ${color}`, color }}
                        title={`${exam?.subjectName}: ${session.focus}`}>
                        <div className="truncate font-bold">{session.focus}</div>
                        {h >= 30 && (
                          <div className="text-[9px] opacity-70 truncate">
                            {session.startTime}–{session.endTime}
                          </div>
                        )}
                      </div>
                    ),
                  });
                });

                const laid = layoutOverlaps(allBlocks);

                return (
                  <div
                    key={colIdx}
                    className={`flex-1 relative border-l border-border ${isToday ? "bg-accent/[0.03]" : ""}`}
                  >
                    {/* Hour grid lines */}
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div
                        key={i}
                        className="absolute w-full border-t border-border/50"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Laid out blocks with overlap handling */}
                    {laid.map(({ block, colIndex, totalCols }) => {
                      const widthPct = totalCols > 4 ? 100 : 100 / totalCols;
                      const leftPct = totalCols > 4 ? 0 : (100 / totalCols) * colIndex;
                      return (
                        <div
                          key={block.key}
                          className="absolute z-[4]"
                          style={{
                            top: block.top,
                            height: block.height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        >
                          {block.content}
                          {totalCols > 4 && colIndex === 3 && (
                            <div className="absolute bottom-0 right-1 font-mono text-[9px] text-muted">
                              +{totalCols - 4} more
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Current time red line */}
                    {showTimeLine && colIdx === currentDayIndex && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: currentTimeY }}
                      >
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                          <div className="flex-1 h-[2px] bg-red-500" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT 25% — Suggestions */}
        <div className="flex-1 flex flex-col bg-surface min-w-[280px]">
          <div className="px-5 py-4 border-b border-border">
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted">SUGGESTIONS</div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {planningExamId && (
              <div className="p-3 border border-border rounded-lg bg-bg">
                <div className="font-mono text-xs text-accent animate-pulse">GENERATING STUDY PLAN...</div>
              </div>
            )}

            {planError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30">
                <div className="font-mono text-xs text-danger">{planError}</div>
                <button
                  onClick={() => setPlanError(null)}
                  className="mt-1 font-mono text-[10px] text-muted hover:text-white"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* Sacrificed topics warning */}
            {sacrificedTopics.length > 0 && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30">
                <div className="font-mono text-[10px] tracking-wider text-danger mb-2">SACRIFICED TOPICS</div>
                <div className="space-y-1.5">
                  {sacrificedTopics.map((t, i) => (
                    <div key={i}>
                      <div className="font-mono text-xs text-white">{t.topicName}</div>
                      <div className="font-mono text-[10px] text-muted">{t.reason}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSacrificedTopics([])}
                  className="mt-2 font-mono text-[10px] text-muted hover:text-white"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* Plan summary card */}
            {planSummary && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
                <div className="font-mono text-xs text-accent font-bold">
                  {planSummary.sessions} sessions added, {planSummary.hours}h planned
                </div>
                <button
                  onClick={() => setPlanSummary(null)}
                  className="mt-1 font-mono text-[10px] text-muted hover:text-white"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* Non-schedule suggestions (alerts, nudges) */}
            {nonScheduleSuggestions.map(({ card, originalIdx: idx }) => {
              if (card.type === "exam-alert") {
                const exam = exams.find((e) => e.id === card.examId);
                if (!exam) return null;
                const days = daysUntil(exam.examDateTime);

                return (
                  <div
                    key={`alert-${idx}`}
                    className="p-4 rounded-lg bg-bg border border-white/[0.08] border-l-[3px] transition-all duration-300"
                    style={{ borderLeftColor: exam.color }}
                  >
                    <div className="font-mono text-sm text-white font-bold">
                      {exam.subjectName} — {exam.examType}
                    </div>
                    <div className="font-mono text-xs text-muted mt-1">
                      {new Date(exam.examDateTime).toLocaleDateString()} at{" "}
                      {new Date(exam.examDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="font-mono text-lg font-bold mt-2" style={{ color: exam.color }}>
                      {days} day{days !== 1 ? "s" : ""} remaining
                    </div>
                    {exam.topics.length > 0 && (
                      <div className="font-mono text-[10px] text-muted mt-1">
                        {exam.topics.length} topic{exam.topics.length !== 1 ? "s" : ""} to cover
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAcceptAlert(exam.id)}
                        disabled={exam.topics.length === 0}
                        className="flex-1 py-1.5 border border-accent text-accent font-mono text-xs rounded hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ✓ PLAN
                      </button>
                      <button
                        onClick={() => {
                          setSuggestions((prev) =>
                            prev.map((s, i) =>
                              i === idx && s.type === "exam-alert"
                                ? { ...s, dismissedUntil: Date.now() + 24 * 60 * 60 * 1000 }
                                : s
                            )
                          );
                        }}
                        className="flex-1 py-1.5 border border-border text-muted font-mono text-xs rounded hover:bg-white/5 transition-colors"
                      >
                        ✗ LATER
                      </button>
                    </div>
                  </div>
                );
              }

              if (card.type === "upload-nudge") {
                const exam = exams.find((e) => e.id === card.examId);
                if (!exam) return null;
                return (
                  <div key={`nudge-${idx}`} className="p-3 rounded-lg bg-bg border border-white/[0.08]">
                    <div className="font-mono text-xs text-white mb-2">
                      Upload notes for {exam.subjectName} {exam.examType}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentExam(exam.id);
                          dispatch({ type: "SET_VIEW", view: "upload" });
                          dismissSuggestion(idx);
                        }}
                        className="flex-1 py-1 border border-accent text-accent font-mono text-[10px] rounded hover:bg-accent/10"
                      >
                        ✓ UPLOAD
                      </button>
                      <button
                        onClick={() => dismissSuggestion(idx)}
                        className="flex-1 py-1 border border-border text-muted font-mono text-[10px] rounded hover:bg-white/5"
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                );
              }

              return null;
            })}

            {/* Schedule suggestions grouped by day */}
            {groupedScheduleSuggestions.map(([day, items]) => (
              <div key={day}>
                <div className="font-mono text-[10px] tracking-wider text-muted mb-2 mt-2">
                  {new Date(day + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div className="space-y-2">
                  {items.map(({ card, originalIdx: idx }) => {
                    if (card.type !== "schedule-suggestion") return null;
                    const exam = exams.find((e) => e.id === card.examId);
                    return (
                      <div key={`sched-${idx}`} className="p-3 rounded-lg bg-bg border border-white/[0.08]">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: exam?.color || "#00ff88" }} />
                          <span className="font-mono text-xs text-white">{card.session.focus}</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted">
                          {card.session.startTime}–{card.session.endTime} • {card.session.durationMinutes}m
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded ${intensityColor(card.session.intensity)}`}>
                            {card.session.intensity.toUpperCase()}
                          </span>
                          <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${priorityColor(card.session.intensity === "deep" ? "critical" : card.session.intensity === "review" ? "high" : "medium")}`}>
                            {card.session.intensity === "deep" ? "CRITICAL" : card.session.intensity === "review" ? "HIGH" : "MEDIUM"}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAcceptAndTrack(card.session, idx)}
                            className="flex-1 py-1 border border-accent text-accent font-mono text-[10px] rounded hover:bg-accent/10"
                          >
                            ✓ ADD
                          </button>
                          <button
                            onClick={() => dismissSuggestion(idx)}
                            className="flex-1 py-1 border border-border text-muted font-mono text-[10px] rounded hover:bg-white/5"
                          >
                            ✗
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {activeSuggestions.length === 0 && !planningExamId && sacrificedTopics.length === 0 && !planSummary && (
              <div className="font-mono text-xs text-muted/40 text-center py-8">
                No suggestions right now.
                <br />
                Add an exam to get started.
              </div>
            )}
          </div>

          {/* Add exam form / button */}
          <div className="border-t border-border p-4">
            {showAddForm ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Subject name"
                  className="w-full bg-bg border border-border rounded px-3 py-2 font-mono text-xs text-white placeholder-muted/40 focus:outline-none focus:border-accent/50"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-bg border border-border rounded px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-accent/50"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 bg-bg border border-border rounded px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-24 bg-bg border border-border rounded px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-accent/50 [color-scheme:dark]"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddExam}
                    disabled={!newSubject || !newDate}
                    className="flex-1 py-2 bg-accent text-bg font-mono text-xs font-bold rounded disabled:opacity-30 hover:bg-accent/90 transition-colors"
                  >
                    ADD EXAM
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-2 border border-border text-muted font-mono text-xs rounded hover:text-white"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 border border-border text-muted font-mono text-xs tracking-wider rounded-lg hover:text-white hover:border-muted transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span> ADD EXAM
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
