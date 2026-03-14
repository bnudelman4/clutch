"use client";

import { useApp } from "@/lib/store";
import { useState, useRef, useCallback } from "react";

export default function UploadView() {
  const { dispatch } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError("");
      dispatch({ type: "SET_ANALYZING", isAnalyzing: true });

      try {
        const blobUrl = URL.createObjectURL(file);
        dispatch({
          type: "ADD_FILE",
          file: { name: file.name, blobUrl, type: file.type },
        });

        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        let body: Record<string, string>;

        if (file.type === "application/pdf") {
          body = {
            fileBase64: base64,
            fileType: file.type,
            fileName: file.name,
          };
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
        dispatch({ type: "SET_RESULT", result, fileName: file.name });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
        dispatch({ type: "SET_STATUS", status: "ERROR" });
      }
    },
    [dispatch]
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
    if (!pasteText.trim()) return;
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
      dispatch({ type: "SET_RESULT", result, fileName: "Pasted text" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      dispatch({ type: "SET_ANALYZING", isAnalyzing: false });
      dispatch({ type: "SET_STATUS", status: "ERROR" });
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h2 className="font-heading text-white text-2xl font-bold">
            Upload Study Material
          </h2>
          <p className="font-mono text-muted text-xs tracking-wider mt-2">
            PDF, PPTX, DOCX, OR TXT — DROP OR CLICK TO SELECT
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-accent bg-accent-dim"
              : "border-border hover:border-muted"
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
          className="w-full h-40 bg-surface border border-border rounded-lg p-4 font-mono text-sm text-white placeholder-muted/40 resize-none focus:outline-none focus:border-accent/50"
        />

        <button
          onClick={handlePasteSubmit}
          disabled={!pasteText.trim()}
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
  );
}
