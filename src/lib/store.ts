"use client";

import { createContext, useContext } from "react";
import { View } from "./types";

export interface AppState {
  view: View;
  isAnalyzing: boolean;
  status: string;
}

export const initialState: AppState = {
  view: "calendar",
  isAnalyzing: false,
  status: "READY",
};

export type AppAction =
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_ANALYZING"; isAnalyzing: boolean }
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
