"use client";

import { createContext, useContext } from "react";
import {
  AnalysisResult,
  AuditScore,
  CalendarPlan,
  UploadedFile,
  View,
  WorkflowResult,
} from "./types";

export interface AppState {
  view: View;
  analysisResult: AnalysisResult | null;
  uploadedFiles: UploadedFile[];
  activeFileIndex: number;
  isAnalyzing: boolean;
  auditScores: AuditScore[];
  status: string;
  workflowResult: WorkflowResult | null;
  calendarPlan: CalendarPlan | null;
  googleAccessToken: string | null;
}

export const initialState: AppState = {
  view: "upload",
  analysisResult: null,
  uploadedFiles: [],
  activeFileIndex: 0,
  isAnalyzing: false,
  auditScores: [],
  status: "AWAITING UPLOAD",
  workflowResult: null,
  calendarPlan: null,
  googleAccessToken: null,
};

export type AppAction =
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_ANALYZING"; isAnalyzing: boolean }
  | { type: "SET_RESULT"; result: AnalysisResult; fileName: string }
  | { type: "ADD_FILE"; file: UploadedFile }
  | { type: "SET_ACTIVE_FILE"; index: number }
  | { type: "ADD_AUDIT_SCORE"; score: AuditScore }
  | { type: "SET_STATUS"; status: string }
  | { type: "SET_WORKFLOW"; result: WorkflowResult }
  | { type: "SET_CALENDAR_PLAN"; plan: CalendarPlan }
  | { type: "SET_GOOGLE_TOKEN"; token: string | null };

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
        isAnalyzing: false,
        view: "ledger",
        status: `LOADED: ${action.fileName}`,
      };
    case "ADD_FILE":
      return {
        ...state,
        uploadedFiles: [...state.uploadedFiles, action.file],
        activeFileIndex: state.uploadedFiles.length,
      };
    case "SET_ACTIVE_FILE":
      return { ...state, activeFileIndex: action.index };
    case "ADD_AUDIT_SCORE":
      return {
        ...state,
        auditScores: [...state.auditScores, action.score],
      };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_WORKFLOW":
      return { ...state, workflowResult: action.result };
    case "SET_CALENDAR_PLAN":
      return { ...state, calendarPlan: action.plan };
    case "SET_GOOGLE_TOKEN":
      return { ...state, googleAccessToken: action.token };
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
