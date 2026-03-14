"use client";

import { useExams } from "@/lib/exam-context";
import { useApp } from "@/lib/store";
import { useState, useEffect, useCallback } from "react";
import { GoogleEvent, StudySession, EXAM_TYPES } from "@/lib/types";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function formatDate(d: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function daysUntil(dt: string) {
  const diff = new Date(dt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
  const [selectedBlock, setSelectedBlock] = useState<StudySession | GoogleEvent | null>(null);

  // Listen for OAuth postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "oauth_success" && e.data.token) {
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
        window.open(data.authUrl, "google_oauth", `width=${w},height=${h},left=${left},top=${top}`);
      }
    } catch {}
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

  const handleAcceptAlert = async (examId: string) => {
    setPlanningExamId(examId);
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    // Remove the alert card
    setSuggestions((prev) =>
      prev.filter((s) => !(s.type === "exam-alert" && s.examId === examId))
    );

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
      if (!res.ok) throw new Error("Planning failed");
      const plan = await res.json();

      const newSuggestions = plan.studySessions.map(
        (s: Omit<StudySession, "id" | "examId">) => ({
          type: "schedule-suggestion" as const,
          examId,
          session: { ...s, id: generateId(), examId },
        })
      );

      setSuggestions((prev) => [...prev, ...newSuggestions]);
    } catch {
      // Re-add alert on failure
      setSuggestions((prev) => [...prev, { type: "exam-alert", examId }]);
    } finally {
      setPlanningExamId(null);
    }
  };

  const handleAcceptSession = (session: StudySession) => {
    addStudySession(session);
  };

  // Build day-by-day view data (next 14 days)
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  const allSessions = exams.flatMap((e) => e.studySessions);

  const getEventsForDay = (day: string) =>
    events.filter((e) => {
      const start = e.start?.dateTime || e.start?.date || "";
      return start.startsWith(day);
    });

  const getSessionsForDay = (day: string) =>
    allSessions.filter((s) => s.date === day);

  const getExamsOnDay = (day: string) =>
    exams.filter((e) => e.examDateTime.startsWith(day));

  // Filter active suggestions
  const activeSuggestions = suggestions.filter((s) => {
    if (s.type === "exam-alert" && s.dismissedUntil && Date.now() < s.dismissedUntil) return false;
    return true;
  });

  const intensityColor = (i: string) => {
    if (i === "deep") return "bg-accent/20 text-accent";
    if (i === "review") return "bg-amber/20 text-amber";
    return "bg-white/10 text-muted";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT 75% — Calendar */}
        <div className="flex-[3] overflow-auto border-r border-border">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface sticky top-0 z-10">
            <h2 className="font-heading text-white text-xl font-bold">Calendar</h2>
            {!googleAccessToken ? (
              <button
                onClick={connectGoogle}
                className="px-4 py-2 border border-accent text-accent font-mono text-xs tracking-wider rounded-lg hover:bg-accent/10 transition-colors"
              >
                CONNECT GOOGLE CALENDAR
              </button>
            ) : (
              <span className="font-mono text-[10px] text-accent tracking-wider">GOOGLE CONNECTED</span>
            )}
          </div>

          <div className="divide-y divide-border">
            {days.map((day) => {
              const ds = dateStr(day);
              const dayEvents = getEventsForDay(ds);
              const daySessions = getSessionsForDay(ds);
              const dayExams = getExamsOnDay(ds);
              const isToday = dateStr(new Date()) === ds;

              return (
                <div key={ds} className={`px-6 py-4 ${isToday ? "bg-accent/[0.03]" : ""}`}>
                  <div className="font-mono text-xs text-muted tracking-wider mb-3 flex items-center gap-2">
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    {formatDate(day)}
                    {isToday && <span className="text-accent">TODAY</span>}
                  </div>

                  {dayExams.length === 0 && dayEvents.length === 0 && daySessions.length === 0 && (
                    <div className="font-mono text-xs text-muted/30 py-1">No events</div>
                  )}

                  {/* Exam blocks */}
                  {dayExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="mb-2 px-3 py-2 rounded-lg font-mono text-xs font-bold border-l-[3px]"
                      style={{
                        borderColor: exam.color,
                        backgroundColor: exam.color + "15",
                        color: exam.color,
                      }}
                    >
                      {exam.subjectName} — {exam.examType}
                      <span className="font-normal ml-2 opacity-70">
                        {new Date(exam.examDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}

                  {/* Google events */}
                  {dayEvents.map((ev, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedBlock(ev as unknown as StudySession)}
                      className="mb-1.5 px-3 py-1.5 rounded bg-white/[0.06] font-mono text-xs text-muted cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {ev.summary || "Busy"}
                      {ev.start?.dateTime && (
                        <span className="ml-2 opacity-50">
                          {new Date(ev.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Study sessions */}
                  {daySessions.map((session) => {
                    const exam = exams.find((e) => e.id === session.examId);
                    return (
                      <div
                        key={session.id}
                        onClick={() => setSelectedBlock(session)}
                        className="mb-1.5 px-3 py-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
                        style={{ backgroundColor: (exam?.color || "#00ff88") + "20" }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: exam?.color || "#00ff88" }} />
                        <span className="font-mono text-xs" style={{ color: exam?.color || "#00ff88" }}>
                          {exam?.subjectName}: {session.focus}
                        </span>
                        <span className="font-mono text-[10px] text-muted ml-auto">
                          {session.startTime}–{session.endTime} ({session.durationMinutes}m)
                        </span>
                      </div>
                    );
                  })}

                  {/* Inline detail popover */}
                  {selectedBlock && "focus" in selectedBlock && daySessions.includes(selectedBlock) && (
                    <div className="mt-2 p-3 bg-surface border border-border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-xs text-white font-bold">{selectedBlock.focus}</div>
                          <div className="font-mono text-[10px] text-muted mt-1">
                            {selectedBlock.startTime} — {selectedBlock.endTime} • {selectedBlock.durationMinutes}min
                          </div>
                          <span className={`inline-block mt-1.5 font-mono text-[10px] px-2 py-0.5 rounded ${intensityColor(selectedBlock.intensity)}`}>
                            {selectedBlock.intensity.toUpperCase()}
                          </span>
                          {selectedBlock.notes && <p className="font-mono text-xs text-muted mt-2">{selectedBlock.notes}</p>}
                        </div>
                        <button onClick={() => setSelectedBlock(null)} className="font-mono text-xs text-muted hover:text-white">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

            {activeSuggestions.map((card, idx) => {
              if (card.type === "exam-alert") {
                const exam = exams.find((e) => e.id === card.examId);
                if (!exam) return null;
                const days = daysUntil(exam.examDateTime);
                if (days > 7) return null;

                return (
                  <div
                    key={`alert-${idx}`}
                    className="p-4 rounded-lg bg-bg border border-white/[0.08] border-l-[3px]"
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
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleAcceptAlert(exam.id)}
                        className="flex-1 py-1.5 border border-accent text-accent font-mono text-xs rounded hover:bg-accent/10 transition-colors"
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

              if (card.type === "schedule-suggestion") {
                const exam = exams.find((e) => e.id === card.examId);
                return (
                  <div key={`sched-${idx}`} className="p-3 rounded-lg bg-bg border border-white/[0.08]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: exam?.color || "#00ff88" }} />
                      <span className="font-mono text-xs text-white">{card.session.focus}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted">
                      {card.session.date} • {card.session.startTime}–{card.session.endTime} • {card.session.durationMinutes}m
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          handleAcceptSession(card.session);
                          dismissSuggestion(idx);
                        }}
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

            {activeSuggestions.length === 0 && !planningExamId && (
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
