"use client";

import { useExams } from "@/lib/exam-context";
import { useState } from "react";

export default function ExamSwitcher() {
  const { exams, currentExamId, setCurrentExam, deleteExam } = useExams();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (exams.length === 0) return null;

  const currentIndex = exams.findIndex((e) => e.id === currentExamId);
  const current = exams[currentIndex];

  const prev = () => {
    const i = currentIndex <= 0 ? exams.length - 1 : currentIndex - 1;
    setCurrentExam(exams[i].id);
  };

  const next = () => {
    const i = currentIndex >= exams.length - 1 ? 0 : currentIndex + 1;
    setCurrentExam(exams[i].id);
  };

  if (!current) return null;

  return (
    <div className="flex items-center justify-center gap-4 px-6 py-2.5 border-b border-border bg-surface relative">
      <button
        onClick={prev}
        className="w-6 h-6 flex items-center justify-center text-muted hover:text-white transition-colors font-mono text-sm"
      >
        ‹
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: current.color }}
        />
        <span className="font-mono text-sm text-white truncate">
          {current.subjectName} — {current.examType}
        </span>
      </div>

      <button
        onClick={next}
        className="w-6 h-6 flex items-center justify-center text-muted hover:text-white transition-colors font-mono text-sm"
      >
        ›
      </button>

      {/* Trash icon */}
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-6 h-6 flex items-center justify-center text-muted/50 hover:text-danger transition-colors ml-1"
        title="Delete exam"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
        </svg>
      </button>

      {exams.length > 1 && (
        <div className="flex gap-1.5 ml-2">
          {exams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => setCurrentExam(exam.id)}
              className="w-2 h-2 rounded-full transition-opacity"
              style={{
                backgroundColor: exam.color,
                opacity: exam.id === currentExamId ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation popover */}
      {showDeleteConfirm && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-surface border border-border rounded-lg p-4 shadow-xl min-w-[280px]">
          <p className="font-mono text-xs text-white mb-3">
            Delete {current.subjectName} {current.examType}? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-1.5 border border-border text-muted font-mono text-xs rounded hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteExam(current.id);
                setShowDeleteConfirm(false);
              }}
              className="flex-1 py-1.5 border border-danger text-danger font-mono text-xs rounded hover:bg-danger/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
