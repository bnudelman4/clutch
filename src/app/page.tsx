"use client";

import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import UploadView from "@/components/UploadView";
import ContentView from "@/components/ContentView";
import TopicLedger from "@/components/TopicLedger";
import Flashcards from "@/components/Flashcards";
import PreFlightAudit from "@/components/PreFlightAudit";
import WorkflowView from "@/components/WorkflowView";
import CalendarView from "@/components/CalendarView";

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex">
          {state.view === "upload" && <UploadView />}
          {state.view === "content" && <ContentView />}
          {state.view === "ledger" && <TopicLedger />}
          {state.view === "flashcards" && <Flashcards />}
          {state.view === "audit" && <PreFlightAudit />}
          {state.view === "workflow" && <WorkflowView />}
          {state.view === "calendar" && <CalendarView />}
        </main>
      </div>
    </AppContext.Provider>
  );
}
