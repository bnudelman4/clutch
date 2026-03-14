export interface Topic {
  name: string;
  summary: string;
  examWeight: number;
  complexityScore: number;
  pageNumber: number;
}

export interface Flashcard {
  front: string;
  back: string;
  sourcePageNumber: number;
}

export interface AuditQuestion {
  question: string;
  correctAnswer: string;
  sourcePageNumber: number;
}

export interface AnalysisResult {
  topics: Topic[];
  flashcards: Flashcard[];
  auditQuestions: AuditQuestion[];
}

export interface ScoreResult {
  verdict: "correct" | "partial" | "wrong";
  score: number;
  feedback: string;
  missing: string;
}

export type View = "upload" | "ledger" | "flashcards" | "audit";

export interface AuditScore {
  questionIndex: number;
  score: number;
  verdict: string;
}
