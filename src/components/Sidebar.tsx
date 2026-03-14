"use client";

import { useApp } from "@/lib/store";
import { View } from "@/lib/types";

const NAV_ITEMS: { id: View; label: string; icon: string; requiresData?: boolean; requiresFiles?: boolean }[] = [
  { id: "upload", label: "UPLOAD", icon: "↑" },
  { id: "content", label: "CONTENT", icon: "◲", requiresFiles: true },
  { id: "ledger", label: "TOPIC LEDGER", icon: "▦", requiresData: true },
  { id: "flashcards", label: "FLASHCARDS", icon: "◫", requiresData: true },
  { id: "audit", label: "PRE-FLIGHT AUDIT", icon: "✓", requiresData: true },
  { id: "workflow", label: "WORKFLOW", icon: "⎇", requiresData: true },
  { id: "calendar", label: "CALENDAR", icon: "◰", requiresData: true },
];

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const hasData = !!state.analysisResult;
  const hasFiles = state.uploadedFiles.length > 0;

  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="font-mono text-accent text-xl font-bold tracking-widest">
          CLUTCH
        </h1>
        <p className="font-mono text-muted text-[10px] tracking-[0.2em] mt-1">
          ACADEMIC INTELLIGENCE
        </p>
      </div>

      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = state.view === item.id;
          const isDisabled =
            (item.requiresData && !hasData) ||
            (item.requiresFiles && !hasFiles);

          return (
            <button
              key={item.id}
              onClick={() =>
                !isDisabled && dispatch({ type: "SET_VIEW", view: item.id })
              }
              disabled={isDisabled}
              className={`w-full text-left px-5 py-3 font-mono text-xs tracking-wider transition-colors flex items-center gap-3 ${
                isActive
                  ? "text-accent bg-accent-dim border-r-2 border-accent"
                  : isDisabled
                  ? "text-muted/30 cursor-not-allowed"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="font-mono text-[10px] tracking-wider text-muted">
          STATUS
        </div>
        <div
          className={`font-mono text-xs mt-1 truncate ${
            state.isAnalyzing ? "text-amber animate-pulse" : "text-accent"
          }`}
        >
          {state.status}
        </div>
      </div>
    </aside>
  );
}
