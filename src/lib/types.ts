export interface Subtopic {
  name: string;
  description: string;
  importance: "high" | "medium" | "low";
  pageNumber: number;
}

export interface Topic {
  name: string;
  summary: string;
  examWeight: number;
  complexityScore: number;
  pageNumber: number;
  subtopics: Subtopic[];
}

export interface Flashcard {
  front: string;
  back: string;
  sourcePageNumber: number;
}

export interface AuditQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  sourcePageNumber: number;
}

export interface AnalysisResult {
  topics: Topic[];
  flashcards: Flashcard[];
  auditQuestions: AuditQuestion[];
}

export type View =
  | "upload"
  | "content"
  | "ledger"
  | "flashcards"
  | "audit"
  | "workflow"
  | "calendar";

export interface AuditScore {
  questionIndex: number;
  score: number;
  verdict: string;
}

export interface UploadedFile {
  name: string;
  blobUrl: string;
  type: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: "topic" | "subtopic" | "milestone";
  duration: number;
  depends_on: string[];
  complexity: number;
  priority: "critical" | "high" | "medium";
}

export interface WorkflowResult {
  nodes: WorkflowNode[];
  totalMinutes: number;
  milestones: { afterNodeId: string; label: string }[];
}

export interface StudySession {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  focus: string;
  intensity: "deep" | "review" | "light";
  notes: string;
}

export interface CalendarPlan {
  studySessions: StudySession[];
  summary: string;
  totalStudyHours: number;
  daysUntilExam: number;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}
