"use client";

import { useApp } from "@/lib/store";
import { useState } from "react";

export default function TopicLedger() {
  const { state } = useApp();
  const { analysisResult, auditScores } = state;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (!analysisResult) return null;

  const { topics, flashcards } = analysisResult;
  const avgComplexity =
    topics.reduce((s, t) => s + t.complexityScore, 0) / topics.length;
  const totalCorrect = auditScores.filter((s) => s.verdict === "correct").length;
  const totalSubtopics = topics.reduce(
    (s, t) => s + (t.subtopics?.length || 0),
    0
  );

  const sortedTopics = [...topics].sort((a, b) => b.examWeight - a.examWeight);

  const getWeightColor = (w: number) => {
    if (w > 20) return "bg-danger";
    if (w > 15) return "bg-amber";
    return "bg-accent";
  };

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleJump = (page: number) => {
    const pdfFile = state.uploadedFiles.find((f) => f.type === "application/pdf");
    if (pdfFile) {
      window.open(`${pdfFile.blobUrl}#page=${page}`, "_blank");
    }
  };

  const importanceBadge = (importance: string) => {
    const colors: Record<string, string> = {
      high: "text-danger border-danger/30 bg-danger/10",
      medium: "text-amber border-amber/30 bg-amber/10",
      low: "text-muted border-border bg-white/5",
    };
    return colors[importance] || colors.low;
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <h2 className="font-heading text-white text-2xl font-bold mb-1">
        Topic Ledger
      </h2>
      <p className="font-mono text-muted text-xs tracking-wider mb-6">
        {topics.length} TOPICS, {totalSubtopics} SUBTOPICS
      </p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "TOPICS FOUND", value: topics.length },
          { label: "AVG COMPLEXITY", value: avgComplexity.toFixed(1) },
          { label: "FLASHCARDS", value: flashcards.length },
          {
            label: "AUDIT SCORE",
            value:
              auditScores.length > 0
                ? `${totalCorrect}/${auditScores.length}`
                : "—",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <div className="font-mono text-[10px] tracking-[0.15em] text-muted">
              {card.label}
            </div>
            <div className="font-mono text-2xl text-white mt-1">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_200px_120px_100px_80px] gap-4 px-5 py-3 border-b border-border">
          {["", "TOPIC", "EXAM WEIGHT", "COMPLEXITY", "YIELD", ""].map(
            (h, i) => (
              <div
                key={`${h}-${i}`}
                className="font-mono text-[10px] tracking-[0.15em] text-muted"
              >
                {h}
              </div>
            )
          )}
        </div>

        {sortedTopics.map((topic, i) => {
          const isExpanded = expanded.has(i);
          const yieldVal =
            auditScores.length > 0
              ? (totalCorrect / auditScores.length) * 100
              : null;

          return (
            <div key={i}>
              <div className="grid grid-cols-[28px_1fr_200px_120px_100px_80px] gap-4 px-5 py-4 border-b border-border/50 hover:bg-white/[0.02] transition-colors items-center">
                <button
                  onClick={() => toggleExpand(i)}
                  className="text-muted hover:text-white transition-all"
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                <div>
                  <div className="font-mono text-sm text-white">
                    {topic.name}
                  </div>
                  <div className="font-mono text-xs text-muted mt-0.5 line-clamp-1">
                    {topic.summary}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getWeightColor(topic.examWeight)}`}
                      style={{
                        width: `${Math.min(topic.examWeight * 2, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted w-8 text-right">
                    {topic.examWeight}%
                  </span>
                </div>

                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, j) => (
                    <div
                      key={j}
                      className={`w-2 h-2 rounded-full ${
                        j < topic.complexityScore ? "bg-accent" : "bg-border"
                      }`}
                    />
                  ))}
                </div>

                <div className="font-mono text-xs">
                  {yieldVal !== null ? (
                    <span
                      className={
                        yieldVal >= 70
                          ? "text-accent"
                          : yieldVal >= 40
                          ? "text-amber"
                          : "text-danger"
                      }
                    >
                      {yieldVal.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>

                <button
                  onClick={() => handleJump(topic.pageNumber)}
                  disabled={
                    !state.uploadedFiles.some(
                      (f) => f.type === "application/pdf"
                    )
                  }
                  className="font-mono text-xs text-accent hover:text-white transition-colors disabled:text-muted/30 disabled:cursor-not-allowed"
                >
                  JUMP →
                </button>
              </div>

              {isExpanded && topic.subtopics && topic.subtopics.length > 0 && (
                <div className="bg-bg/50">
                  {topic.subtopics.map((sub, j) => (
                    <div
                      key={j}
                      className="grid grid-cols-[28px_28px_1fr_100px_1fr_80px] gap-4 px-5 py-3 border-b border-border/30 items-center"
                    >
                      <div />
                      <div className="w-1 h-full bg-border/50 mx-auto" />
                      <div className="font-mono text-xs text-white/80">
                        {sub.name}
                      </div>
                      <span
                        className={`font-mono text-[10px] tracking-wider px-2 py-0.5 rounded border text-center uppercase ${importanceBadge(sub.importance)}`}
                      >
                        {sub.importance}
                      </span>
                      <div className="font-mono text-xs text-muted line-clamp-1">
                        {sub.description}
                      </div>
                      <button
                        onClick={() => handleJump(sub.pageNumber)}
                        disabled={
                          !state.uploadedFiles.some(
                            (f) => f.type === "application/pdf"
                          )
                        }
                        className="font-mono text-[10px] text-accent hover:text-white transition-colors disabled:text-muted/30"
                      >
                        P.{sub.pageNumber} →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
