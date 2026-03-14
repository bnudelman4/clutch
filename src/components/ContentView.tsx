"use client";

import { useExams } from "@/lib/exam-context";
import ExamSwitcher from "./ExamSwitcher";
import { useState } from "react";

export default function ContentView() {
  const { exams, currentExam } = useExams();
  const [expandedExamId, setExpandedExamId] = useState<string | null>(
    currentExam?.id || null
  );
  const [selectedFile, setSelectedFile] = useState<{
    blobUrl: string;
    name: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  const examsWithFiles = exams.filter((e) => e.uploadedFiles.length > 0);

  if (examsWithFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ExamSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-muted text-sm">No files uploaded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ExamSwitcher />

      <div className="flex flex-1 overflow-hidden">
        {/* File accordion sidebar */}
        <div className="w-64 border-r border-border overflow-auto bg-surface">
          {examsWithFiles.map((exam) => {
            const isOpen = expandedExamId === exam.id;
            return (
              <div key={exam.id}>
                <button
                  onClick={() =>
                    setExpandedExamId(isOpen ? null : exam.id)
                  }
                  className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-white/5 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 text-muted transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: exam.color }}
                  />
                  <span className="font-mono text-xs text-white truncate">
                    {exam.subjectName} — {exam.examType}
                  </span>
                </button>
                {isOpen && (
                  <div className="bg-bg/50">
                    {exam.uploadedFiles.map((file, fi) => (
                      <button
                        key={fi}
                        onClick={() => {
                          if (file.blobUrl) {
                            setSelectedFile(file);
                            setPage(1);
                            setZoom(1);
                          }
                        }}
                        className={`w-full text-left px-8 py-2 font-mono text-xs border-b border-border/30 transition-colors ${
                          selectedFile?.name === file.name
                            ? "text-accent bg-accent-dim"
                            : file.blobUrl
                            ? "text-muted hover:text-white hover:bg-white/5"
                            : "text-muted/30 cursor-not-allowed"
                        }`}
                      >
                        {file.name}
                        {!file.blobUrl && (
                          <span className="text-muted/20 ml-2">(reload to view)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PDF viewer */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
                <div className="font-mono text-sm text-white truncate">
                  {selectedFile.name}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="w-7 h-7 flex items-center justify-center border border-border rounded text-muted hover:text-white hover:border-muted transition-colors font-mono text-xs"
                    >
                      ‹
                    </button>
                    <input
                      type="number"
                      value={page}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v > 0) setPage(v);
                      }}
                      className="w-12 h-7 bg-bg border border-border rounded text-center font-mono text-xs text-white focus:outline-none focus:border-accent/50"
                    />
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="w-7 h-7 flex items-center justify-center border border-border rounded text-muted hover:text-white hover:border-muted transition-colors font-mono text-xs"
                    >
                      ›
                    </button>
                  </div>
                  <div className="w-px h-5 bg-border" />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                      className="w-7 h-7 flex items-center justify-center border border-border rounded text-muted hover:text-white hover:border-muted transition-colors font-mono text-xs"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-muted w-10 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                      className="w-7 h-7 flex items-center justify-center border border-border rounded text-muted hover:text-white hover:border-muted transition-colors font-mono text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-bg p-4">
                <div
                  className="mx-auto origin-top transition-transform"
                  style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
                >
                  <iframe
                    src={`${selectedFile.blobUrl}#page=${page}`}
                    className="w-full bg-white rounded-lg"
                    style={{ height: `calc(100vh - 200px)` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-muted text-xs">
                Select a file from the left panel
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
