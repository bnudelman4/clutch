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
  | "calendar"
  | "upload"
  | "content"
  | "ledger"
  | "flashcards"
  | "audit"
  | "workflow";

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
  id: string;
  examId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  focus: string;
  intensity: "deep" | "review" | "light";
  notes: string;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendarId?: string;
  calendarName?: string;
  colorId?: string;
}

export const EXAM_COLORS = [
  "#00ff88",
  "#00aaff",
  "#ff6b35",
  "#ff3366",
  "#aa44ff",
  "#ffcc00",
  "#00ffcc",
];

export const EXAM_TYPES = [
  "Prelim 1",
  "Prelim 2",
  "Midterm",
  "Final",
  "Quiz",
  "Other",
] as const;

export interface Exam {
  id: string;
  subjectName: string;
  examType: string;
  examDateTime: string;
  color: string;
  topics: Topic[];
  flashcards: Flashcard[];
  auditQuestions: AuditQuestion[];
  uploadedFiles: UploadedFile[];
  auditScores: AuditScore[];
  workflowResult: WorkflowResult | null;
  studySessions: StudySession[];
}

export type SuggestionCard =
  | { type: "exam-alert"; examId: string; dismissedUntil?: number }
  | { type: "schedule-suggestion"; examId: string; session: StudySession }
  | { type: "upload-nudge"; examId: string };
