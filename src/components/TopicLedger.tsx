"use client";

import { useApp } from "@/lib/store";

export default function TopicLedger() {
  const { state, dispatch } = useApp();
  const { analysisResult, auditScores, pdfBlobUrl } = state;

  if (!analysisResult) return null;

  const { topics, flashcards, auditQuestions } = analysisResult;
  const avgComplexity =
    topics.reduce((s, t) => s + t.complexityScore, 0) / topics.length;
  const avgAuditScore =
    auditScores.length > 0
      ? auditScores.reduce((s, a) => s + a.score, 0) / auditScores.length
      : 0;

  const sortedTopics = [...topics].sort((a, b) => b.examWeight - a.examWeight);

  const getWeightColor = (w: number) => {
    if (w > 20) return "bg-danger";
    if (w > 15) return "bg-amber";
    return "bg-accent";
  };

  const handleJump = (page: number) => {
    if (pdfBlobUrl) {
      window.open(`${pdfBlobUrl}#page=${page}`, "_blank");
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <h2 className="font-heading text-white text-2xl font-bold mb-6">
        Topic Ledger
      </h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "TOPICS FOUND", value: topics.length },
          { label: "AVG COMPLEXITY", value: avgComplexity.toFixed(1) },
          { label: "FLASHCARDS", value: flashcards.length },
          {
            label: "AUDIT SCORE",
            value:
              auditScores.length > 0
                ? `${avgAuditScore.toFixed(0)}%`
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
        <div className="grid grid-cols-[1fr_200px_120px_100px_80px] gap-4 px-5 py-3 border-b border-border">
          {["TOPIC", "EXAM WEIGHT", "COMPLEXITY", "YIELD", ""].map((h) => (
            <div
              key={h}
              className="font-mono text-[10px] tracking-[0.15em] text-muted"
            >
              {h}
            </div>
          ))}
        </div>

        {sortedTopics.map((topic, i) => {
          const topicAuditScores = auditScores.filter(
            (s) =>
              auditQuestions[s.questionIndex] &&
              topics.findIndex((t) => t.name === topic.name) !== -1
          );
          const yieldVal =
            topicAuditScores.length > 0
              ? topicAuditScores.reduce((s, a) => s + a.score, 0) /
                topicAuditScores.length
              : null;

          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_200px_120px_100px_80px] gap-4 px-5 py-4 border-b border-border/50 hover:bg-white/[0.02] transition-colors items-center"
            >
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
                    style={{ width: `${Math.min(topic.examWeight * 2, 100)}%` }}
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
                disabled={!pdfBlobUrl}
                className="font-mono text-xs text-accent hover:text-white transition-colors disabled:text-muted/30 disabled:cursor-not-allowed"
              >
                JUMP →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
