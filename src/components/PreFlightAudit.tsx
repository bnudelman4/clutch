"use client";

import { useExams } from "@/lib/exam-context";
import { useApp } from "@/lib/store";
import ExamSwitcher from "./ExamSwitcher";
import { useState, useEffect, useCallback } from "react";

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function PreFlightAudit() {
  const { dispatch } = useApp();
  const { currentExam, addAuditScore } = useExams();
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [completed, setCompleted] = useState(false);

  const auditQuestions = currentExam?.auditQuestions;

  const advanceToNext = useCallback(() => {
    if (!auditQuestions) return;
    if (currentQ < auditQuestions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelectedIndex(null);
      setAnswered(false);
    } else {
      setCompleted(true);
    }
  }, [currentQ, auditQuestions]);

  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(advanceToNext, 1500);
    return () => clearTimeout(timer);
  }, [answered, advanceToNext]);

  if (!currentExam || !auditQuestions || auditQuestions.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-muted text-sm">No audit questions yet.</p>
        </div>
      </div>
    );
  }

  const question = auditQuestions[currentQ];

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    const isCorrect = index === question.correctIndex;
    setResults((prev) => [...prev, isCorrect]);
    addAuditScore(currentExam.id, {
      questionIndex: currentQ,
      score: isCorrect ? 100 : 0,
      verdict: isCorrect ? "correct" : "wrong",
    });
  };

  if (completed) {
    const correctCount = results.filter(Boolean).length;
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-heading text-white text-3xl font-bold mb-2">Audit Complete</h2>
            <div className={`font-mono text-6xl font-bold mt-6 ${correctCount >= 4 ? "text-accent" : correctCount >= 2 ? "text-amber" : "text-danger"}`}>
              {correctCount}/{auditQuestions.length}
            </div>
            <p className="font-mono text-muted text-xs tracking-wider mt-4">
              {correctCount} CORRECT OUT OF {auditQuestions.length}
            </p>
            <button
              onClick={() => dispatch({ type: "SET_VIEW", view: "ledger" })}
              className="mt-8 px-6 py-3 border border-accent text-accent font-mono text-xs tracking-wider rounded-lg hover:bg-accent/10 transition-colors"
            >
              VIEW TOPIC LEDGER →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ExamSwitcher />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-white text-2xl font-bold">Pre-Flight Audit</h2>
            <span className="font-mono text-xs text-muted tracking-wider">{currentQ + 1} / {auditQuestions.length}</span>
          </div>
          <div className="flex gap-1.5 mb-8">
            {auditQuestions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < currentQ ? (results[i] ? "bg-accent" : "bg-danger") : i === currentQ ? "bg-white" : "bg-border"}`} />
            ))}
          </div>
          <div className="bg-surface border border-border rounded-lg p-6 mb-6">
            <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-3">QUESTION {currentQ + 1} — PAGE {question.sourcePageNumber}</div>
            <p className="font-mono text-white text-sm leading-relaxed">{question.question}</p>
          </div>
          <div className="space-y-3">
            {question.options.map((option, i) => {
              const isSelected = selectedIndex === i;
              const isCorrect = i === question.correctIndex;
              let cls = "border-border text-white hover:border-muted hover:bg-white/[0.02]";
              if (answered) {
                if (isCorrect) cls = "border-accent bg-accent/10 text-accent";
                else if (isSelected) cls = "border-danger bg-danger/10 text-danger";
                else cls = "border-border/50 text-muted/50";
              }
              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={answered}
                  className={`w-full text-left border rounded-lg p-4 font-mono text-sm transition-all flex items-start gap-3 ${cls} ${answered ? "cursor-default" : "cursor-pointer"}`}>
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 mt-0.5 ${answered && isCorrect ? "border-accent text-accent" : answered && isSelected ? "border-danger text-danger" : "border-current"}`}>
                    {OPTION_LABELS[i]}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-4 p-4 bg-surface border border-border rounded-lg">
              <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-2">EXPLANATION</div>
              <p className="font-mono text-sm text-white/80 leading-relaxed">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
