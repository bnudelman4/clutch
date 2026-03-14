"use client";

import { createContext, useContext } from "react";
import { AnalysisResult, AuditScore, View } from "./types";

export interface AppState {
  view: View;
  analysisResult: AnalysisResult | null;
  pdfBlobUrl: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  auditScores: AuditScore[];
  status: string;
}

export const initialState: AppState = {
  view: "upload",
  analysisResult: null,
  pdfBlobUrl: null,
  fileName: null,
  isAnalyzing: false,
  auditScores: [],
  status: "AWAITING UPLOAD",
};

export type AppAction =
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_ANALYZING"; isAnalyzing: boolean }
  | { type: "SET_RESULT"; result: AnalysisResult; fileName: string }
  | { type: "SET_PDF_BLOB"; url: string }
  | { type: "ADD_AUDIT_SCORE"; score: AuditScore }
  | { type: "SET_STATUS"; status: string };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "SET_ANALYZING":
      return {
        ...state,
        isAnalyzing: action.isAnalyzing,
        status: action.isAnalyzing ? "ANALYZING..." : state.status,
      };
    case "SET_RESULT":
      return {
        ...state,
        analysisResult: action.result,
        fileName: action.fileName,
        isAnalyzing: false,
        view: "ledger",
        status: `LOADED: ${action.fileName}`,
      };
    case "SET_PDF_BLOB":
      return { ...state, pdfBlobUrl: action.url };
    case "ADD_AUDIT_SCORE":
      return {
        ...state,
        auditScores: [...state.auditScores, action.score],
      };
    case "SET_STATUS":
      return { ...state, status: action.status };
    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => {} });

export function useApp() {
  return useContext(AppContext);
}
