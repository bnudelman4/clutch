"use client";

import { useApp } from "@/lib/store";
import { useState } from "react";

export default function Flashcards() {
  const { state } = useApp();
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  if (!state.analysisResult) return null;

  const { flashcards } = state.analysisResult;

  const toggle = (i: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <h2 className="font-heading text-white text-2xl font-bold mb-6">
        Flashcards
      </h2>
      <p className="font-mono text-muted text-xs tracking-wider mb-6">
        {flashcards.length} CARDS — CLICK TO FLIP
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {flashcards.map((card, i) => {
          const isFlipped = flipped.has(i);

          return (
            <div
              key={i}
              onClick={() => toggle(i)}
              className={`min-h-[200px] bg-surface border rounded-lg p-5 cursor-pointer transition-all hover:bg-white/[0.02] flex flex-col justify-between ${
                isFlipped ? "border-accent" : "border-border"
              }`}
            >
              <div>
                <div className="font-mono text-[10px] tracking-[0.15em] text-muted mb-3">
                  {isFlipped ? "ANSWER" : "QUESTION"} — CARD {i + 1}
                </div>
                <p
                  className={`font-mono text-sm leading-relaxed ${
                    isFlipped ? "text-accent" : "text-white"
                  }`}
                >
                  {isFlipped ? card.back : card.front}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted">
                  {isFlipped ? "↺ CLICK TO FLIP BACK" : "↻ CLICK TO REVEAL"}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  P.{card.sourcePageNumber}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
