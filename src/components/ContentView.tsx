"use client";

import { useApp } from "@/lib/store";
import { useState } from "react";

export default function ContentView() {
  const { state, dispatch } = useApp();
  const { uploadedFiles, activeFileIndex } = state;
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  if (uploadedFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono text-muted text-sm">No files uploaded yet.</p>
      </div>
    );
  }

  const activeFile = uploadedFiles[activeFileIndex];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {uploadedFiles.length > 1 && (
        <div className="flex border-b border-border bg-surface overflow-x-auto">
          {uploadedFiles.map((file, i) => (
            <button
              key={i}
              onClick={() => {
                dispatch({ type: "SET_ACTIVE_FILE", index: i });
                setPage(1);
                setZoom(1);
              }}
              className={`px-4 py-2 font-mono text-xs tracking-wider whitespace-nowrap border-r border-border transition-colors ${
                i === activeFileIndex
                  ? "text-accent bg-accent-dim"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
        <div className="font-mono text-sm text-white truncate">
          {activeFile.name}
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
            src={`${activeFile.blobUrl}#page=${page}`}
            className="w-full bg-white rounded-lg"
            style={{ height: `calc(100vh - 180px)` }}
          />
        </div>
      </div>
    </div>
  );
}
