"use client";

import { useApp } from "@/lib/store";
import { useExams } from "@/lib/exam-context";
import ExamSwitcher from "./ExamSwitcher";
import { useState, useRef, useCallback } from "react";

export default function UploadView() {
  const { dispatch } = useApp();
  const { currentExam, exams, addExam, addFileToExam, setAnalysisResult } = useExams();
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nudge cards for exams without uploads
  const nudgeExams = exams.filter((e) => e.uploadedFiles.length === 0 && e.topics.length === 0);

  const processFile = useCallback(
    async (file: File) => {
      if (!currentExam) return;
      setError("");
      dispatch({ type: "SET_ANALYZING", isAnalyzing: true });

      try {
        const blobUrl = URL.createObjectURL(file);
        addFileToExam(currentExam.id, { name: file.name, blobUrl, type: file.type });

        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        let body: Record<string, string>;
        if (file.type === "application/pdf") {
          body = { fileBase64: base64, fileType: file.type, fileName: file.name };
        } else {
          const text = await file.text();
          body = { text, fileName: file.name };
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Analysis failed");
        }

        const result = await res.json();
        setAnalysisResult(currentExam.id, result);
        dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
        dispatch({ type: "SET_STATUS", status: `LOADED: ${file.name}` });
        dispatch({ type: "SET_VIEW", view: "ledger" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
        dispatch({ type: "SET_STATUS", status: "ERROR" });
      }
    },
    [currentExam, dispatch, addFileToExam, setAnalysisResult]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handlePasteSubmit = async () => {
    if (!pasteText.trim() || !currentExam) return;
    setError("");
    dispatch({ type: "SET_ANALYZING", isAnalyzing: true });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, fileName: "Pasted text" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const result = await res.json();
      setAnalysisResult(currentExam.id, result);
      dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
      dispatch({ type: "SET_STATUS", status: "LOADED: Pasted text" });
      dispatch({ type: "SET_VIEW", view: "ledger" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
      dispatch({ type: "SET_STATUS", status: "ERROR" });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ExamSwitcher />

      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="w-full max-w-2xl space-y-6">
          {!currentExam && (
            <div className="p-4 border border-amber/30 rounded-lg bg-amber/5 mb-4">
              <p className="font-mono text-amber text-xs">
                Create an exam first from the Calendar page to start uploading.
              </p>
            </div>
          )}

          {currentExam && (
            <div className="font-mono text-xs tracking-wider text-muted">
              UPLOAD FOR:{" "}
              <span className="text-white">
                {currentExam.subjectName} — {currentExam.examType}
              </span>
            </div>
          )}

          <div>
            <h2 className="font-heading text-white text-2xl font-bold">
              Upload Study Material
            </h2>
            <p className="font-mono text-muted text-xs tracking-wider mt-2">
              PDF, PPTX, DOCX, OR TXT — DROP OR CLICK TO SELECT
            </p>
          </div>

          {nudgeExams.length > 0 && (
            <div className="space-y-2">
              {nudgeExams.map((exam) => (
                <div
                  key={exam.id}
                  className="p-3 bg-surface border rounded-lg flex items-center justify-between"
                  style={{ borderColor: exam.color + "44" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: exam.color }}
                    />
                    <span className="font-mono text-xs text-white">
                      Upload notes for {exam.subjectName} {exam.examType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => currentExam && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-16 text-center transition-colors ${
              !currentExam
                ? "border-border/50 opacity-50 cursor-not-allowed"
                : dragOver
                ? "border-accent bg-accent-dim cursor-pointer"
                : "border-border hover:border-muted cursor-pointer"
            }`}
          >
            <div className="font-mono text-accent text-4xl mb-4">↑</div>
            <p className="font-mono text-muted text-sm">
              Drop file here or click to browse
            </p>
            <p className="font-mono text-muted/50 text-xs mt-2">
              PDF • PPTX • DOCX • TXT
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.pptx,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg px-4 font-mono text-xs text-muted tracking-wider">
                OR PASTE TEXT
              </span>
            </div>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your study notes here..."
            disabled={!currentExam}
            className="w-full h-40 bg-surface border border-border rounded-lg p-4 font-mono text-sm text-white placeholder-muted/40 resize-none focus:outline-none focus:border-accent/50 disabled:opacity-50"
          />

          <button
            onClick={handlePasteSubmit}
            disabled={!pasteText.trim() || !currentExam}
            className="w-full py-3 bg-accent text-bg font-mono text-sm font-bold tracking-wider rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            ANALYZE TEXT
          </button>

          {error && (
            <div className="p-4 border border-danger/30 rounded-lg bg-danger/10">
              <p className="font-mono text-danger text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
