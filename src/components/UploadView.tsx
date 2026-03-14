"use client";

import { useApp } from "@/lib/store";
import { useExams } from "@/lib/exam-context";
import ExamSwitcher from "./ExamSwitcher";
import { useState, useRef, useCallback } from "react";

const MAX_FILES = 20;

interface QueueItem {
  file: File;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadView() {
  const { dispatch } = useApp();
  const { currentExam, exams, addFileToExam, setAnalysisResult } = useExams();
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nudgeExams = exams.filter((e) => e.uploadedFiles.length === 0 && e.topics.length === 0);
  const currentFileCount = currentExam?.uploadedFiles.length || 0;

  const processQueue = useCallback(
    async (items: QueueItem[]) => {
      if (!currentExam || processing) return;
      setProcessing(true);
      dispatch({ type: "SET_ANALYZING", isAnalyzing: true });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.status !== "queued") continue;

        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: "processing" as const } : q))
        );

        try {
          const blobUrl = URL.createObjectURL(item.file);
          addFileToExam(currentExam.id, { name: item.file.name, blobUrl, type: item.file.type });

          let body: Record<string, string>;
          if (item.file.type === "application/pdf") {
            // Send base64 to server for text extraction + analysis
            const arrayBuffer = await item.file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            );
            body = { fileBase64: base64, fileType: item.file.type, fileName: item.file.name };
          } else {
            const text = await item.file.text();
            body = { text, fileName: item.file.name };
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

          setQueue((prev) =>
            prev.map((q, idx) => (idx === i ? { ...q, status: "done" as const } : q))
          );
        } catch (e) {
          setQueue((prev) =>
            prev.map((q, idx) =>
              idx === i
                ? { ...q, status: "error" as const, error: e instanceof Error ? e.message : "Failed" }
                : q
            )
          );
        }
      }

      setProcessing(false);
      dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
      dispatch({ type: "SET_STATUS", status: `PROCESSED: ${items.length} file(s)` });
    },
    [currentExam, processing, dispatch, addFileToExam, setAnalysisResult]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (!currentExam) return;
      const fileArray = Array.from(files);
      const remaining = MAX_FILES - currentFileCount - queue.length;
      if (remaining <= 0) {
        setError(`Maximum ${MAX_FILES} files per exam. Remove some files first.`);
        return;
      }
      const toAdd = fileArray.slice(0, remaining);
      if (toAdd.length < fileArray.length) {
        setError(`Only ${toAdd.length} of ${fileArray.length} files added (max ${MAX_FILES}).`);
      } else {
        setError("");
      }
      const newItems: QueueItem[] = toAdd.map((f) => ({ file: f, status: "queued" }));
      const updatedQueue = [...queue, ...newItems];
      setQueue(updatedQueue);
      processQueue(updatedQueue);
    },
    [currentExam, currentFileCount, queue, processQueue]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFromQueue = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const doneCount = queue.filter((q) => q.status === "done").length;
  const totalCount = queue.length;

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

      <div className="flex-1 flex items-start justify-center p-8 overflow-auto">
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
              <span className="ml-3 text-muted/60">
                {currentFileCount}/{MAX_FILES} FILES
              </span>
            </div>
          )}

          <div>
            <h2 className="font-heading text-white text-2xl font-bold">
              Upload Study Material
            </h2>
            <p className="font-mono text-muted text-xs tracking-wider mt-2">
              PDF, PPTX, DOCX, OR TXT — DROP OR SELECT MULTIPLE FILES (MAX {MAX_FILES})
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
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              !currentExam
                ? "border-border/50 opacity-50 cursor-not-allowed"
                : dragOver
                ? "border-accent bg-accent-dim cursor-pointer"
                : "border-border hover:border-muted cursor-pointer"
            }`}
          >
            <div className="font-mono text-accent text-4xl mb-4">↑</div>
            <p className="font-mono text-muted text-sm">
              Drop files here or click to browse
            </p>
            <p className="font-mono text-muted/50 text-xs mt-2">
              PDF • PPTX • DOCX • TXT • Multiple files supported
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.pptx,.docx,.txt"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Upload queue */}
          {queue.length > 0 && (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="font-mono text-[10px] tracking-wider text-muted">
                  UPLOAD QUEUE
                </div>
                <div className="font-mono text-xs text-white">
                  {doneCount}/{totalCount} processed
                </div>
              </div>
              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="h-1 bg-border">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${(doneCount / totalCount) * 100}%` }}
                  />
                </div>
              )}
              <div className="divide-y divide-border/50">
                {queue.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.status === "done" ? "bg-accent" :
                      item.status === "processing" ? "bg-amber animate-pulse" :
                      item.status === "error" ? "bg-danger" : "bg-muted/30"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-white truncate">{item.file.name}</div>
                      <div className="font-mono text-[10px] text-muted">
                        {formatSize(item.file.size)}
                        {item.status === "processing" && " • Analyzing..."}
                        {item.status === "done" && " • Done"}
                        {item.status === "error" && ` • ${item.error}`}
                      </div>
                    </div>
                    {(item.status === "queued" || item.status === "error") && (
                      <button
                        onClick={() => removeFromQueue(i)}
                        className="font-mono text-xs text-muted hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {doneCount === totalCount && totalCount > 0 && (
                <div className="px-4 py-3 border-t border-border">
                  <button
                    onClick={() => {
                      setQueue([]);
                      dispatch({ type: "SET_VIEW", view: "ledger" });
                    }}
                    className="w-full py-2 border border-accent text-accent font-mono text-xs tracking-wider rounded hover:bg-accent/10 transition-colors"
                  >
                    VIEW RESULTS →
                  </button>
                </div>
              )}
            </div>
          )}

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
