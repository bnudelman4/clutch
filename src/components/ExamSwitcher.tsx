"use client";

import { useExams } from "@/lib/exam-context";

export default function ExamSwitcher() {
  const { exams, currentExamId, setCurrentExam } = useExams();

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
    <div className="flex items-center justify-center gap-4 px-6 py-2.5 border-b border-border bg-surface">
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
    </div>
  );
}
