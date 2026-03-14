"use client";

import { useApp } from "@/lib/store";
import { useState } from "react";
import { ScoreResult } from "@/lib/types";

export default function PreFlightAudit() {
  const { state, dispatch } = useApp();
  const [currentQ, setCurrentQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [results, setResults] = useState<(ScoreResult | null)[]>([]);
  const [completed, setCompleted] = useState(false);

  if (!state.analysisResult) return null;

  const { auditQuestions } = state.analysisResult;
  const question = auditQuestions[currentQ];

  const handleSubmit = async () => {
    if (!answer.trim() || scoring) return;
    setScoring(true);
    setResult(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question,
          correctAnswer: question.correctAnswer,
          studentAnswer: answer,
        }),
      });

      if (!res.ok) throw new Error("Scoring failed");

      const scoreResult: ScoreResult = await res.json();
      setResult(scoreResult);
      setResults((prev) => [...prev, scoreResult]);

      dispatch({
        type: "ADD_AUDIT_SCORE",
        score: {
          questionIndex: currentQ,
          score: scoreResult.score,
          verdict: scoreResult.verdict,
        },
      });
    } catch {
      setResult({
        verdict: "wrong",
        score: 0,
        feedback: "Failed to score answer. Please try again.",
        missing: "",
      });
    } finally {
      setScoring(false);
    }
  };

  const handleNext = () => {
    if (currentQ < auditQuestions.length - 1) {
      setCurrentQ((q) => q + 1);
      setAnswer("");
      setResult(null);
    } else {
      setCompleted(true);
    }
  };

  const verdictColor = (v: string) => {
    if (v === "correct") return "text-accent border-accent bg-accent/10";
    if (v === "partial") return "text-amber border-amber bg-amber/10";
    return "text-danger border-danger bg-danger/10";
  };

  if (completed) {
    const validResults = results.filter(Boolean) as ScoreResult[];
    const avgScore =
      validResults.reduce((s, r) => s + r.score, 0) / validResults.length;

    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-heading text-white text-3xl font-bold mb-2">
            Audit Complete
          </h2>
          <div
            className={`font-mono text-6xl font-bold mt-6 ${
              avgScore >= 70
                ? "text-accent"
                : avgScore >= 40
                ? "text-amber"
                : "text-danger"
            }`}
          >
            {avgScore.toFixed(0)}%
          </div>
          <p className="font-mono text-muted text-xs tracking-wider mt-4">
            {validResults.filter((r) => r.verdict === "correct").length}/
            {validResults.length} CORRECT
          </p>
          <button
            onClick={() => dispatch({ type: "SET_VIEW", view: "ledger" })}
            className="mt-8 px-6 py-3 border border-accent text-accent font-mono text-xs tracking-wider rounded-lg hover:bg-accent/10 transition-colors"
          >
            VIEW TOPIC LEDGER →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-white text-2xl font-bold">
            Pre-Flight Audit
          </h2>
          <span className="font-mono text-xs text-muted tracking-wider">
            {currentQ + 1} / {auditQuestions.length}
          </span>
        </div>

        <div className="flex gap-1.5 mb-8">
          {auditQuestions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < currentQ
                  ? results[i]?.verdict === "correct"
                    ? "bg-accent"
                    : results[i]?.verdict === "partial"
                    ? "bg-amber"
                    : "bg-danger"
                  : i === currentQ
                  ? "bg-white"
                  : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-3">
            QUESTION {currentQ + 1} — PAGE {question.sourcePageNumber}
          </div>
          <p className="font-mono text-white text-sm leading-relaxed">
            {question.question}
          </p>
        </div>

        {!result ? (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              disabled={scoring}
              className="w-full h-32 bg-surface border border-border rounded-lg p-4 font-mono text-sm text-white placeholder-muted/40 resize-none focus:outline-none focus:border-accent/50 disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || scoring}
              className="mt-4 w-full py-3 bg-accent text-bg font-mono text-sm font-bold tracking-wider rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            >
              {scoring ? "SCORING..." : "SUBMIT ANSWER"}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div
              className={`border rounded-lg p-5 ${verdictColor(result.verdict)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs tracking-wider uppercase font-bold">
                  {result.verdict}
                </span>
                <span className="font-mono text-2xl font-bold">
                  {result.score}
                </span>
              </div>
              <p className="font-mono text-sm opacity-90">{result.feedback}</p>
              {result.missing && (
                <p className="font-mono text-xs mt-2 opacity-70">
                  Missing: {result.missing}
                </p>
              )}
            </div>

            {state.pdfBlobUrl && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-surface">
                  <span className="font-mono text-[10px] tracking-wider text-muted">
                    SOURCE — PAGE {question.sourcePageNumber}
                  </span>
                </div>
                <iframe
                  src={`${state.pdfBlobUrl}#page=${question.sourcePageNumber}`}
                  className="w-full h-64 bg-white"
                />
              </div>
            )}

            <button
              onClick={handleNext}
              className="w-full py-3 border border-accent text-accent font-mono text-sm tracking-wider rounded-lg hover:bg-accent/10 transition-colors"
            >
              {currentQ < auditQuestions.length - 1
                ? "NEXT QUESTION →"
                : "FINISH AUDIT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
