"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  Exam,
  EXAM_COLORS,
  Topic,
  Flashcard,
  AuditQuestion,
  StudySession,
  SuggestionCard,
  UploadedFile,
  AnalysisResult,
  AuditScore,
  WorkflowResult,
} from "./types";

interface ExamContextValue {
  exams: Exam[];
  currentExamId: string | null;
  currentExam: Exam | null;
  setCurrentExam: (id: string) => void;
  addExam: (exam: Omit<Exam, "id" | "color" | "topics" | "flashcards" | "auditQuestions" | "uploadedFiles" | "auditScores" | "workflowResult" | "studySessions">) => Exam;
  deleteExam: (id: string) => void;
  updateExam: (id: string, partial: Partial<Exam>) => void;
  addFileToExam: (examId: string, file: UploadedFile) => void;
  setAnalysisResult: (examId: string, result: AnalysisResult) => void;
  addAuditScore: (examId: string, score: AuditScore) => void;
  setWorkflow: (examId: string, result: WorkflowResult) => void;
  addStudySession: (session: StudySession) => void;
  removeStudySession: (sessionId: string) => void;
  suggestions: SuggestionCard[];
  setSuggestions: React.Dispatch<React.SetStateAction<SuggestionCard[]>>;
  dismissSuggestion: (index: number) => void;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
}

const ExamContext = createContext<ExamContextValue>(null!);

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function loadExams(): Exam[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("clutch_exams");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Restore blob URLs won't persist, clear them
      return parsed.map((e: Exam) => ({
        ...e,
        uploadedFiles: e.uploadedFiles.map((f) => ({ ...f, blobUrl: "" })),
      }));
    }
  } catch {}
  return [];
}

function saveExams(exams: Exam[]) {
  if (typeof window === "undefined") return;
  try {
    // Don't persist blob URLs
    const toSave = exams.map((e) => ({
      ...e,
      uploadedFiles: e.uploadedFiles.map((f) => ({ ...f, blobUrl: "" })),
    }));
    localStorage.setItem("clutch_exams", JSON.stringify(toSave));
  } catch {}
}

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>([]);
  const [googleAccessToken, setGoogleAccessTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const loaded = loadExams();
    setExams(loaded);
    if (loaded.length > 0) setCurrentExamId(loaded[0].id);
    const token = localStorage.getItem("gcal_token");
    if (token) setGoogleAccessTokenState(token);
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (hydrated) saveExams(exams);
  }, [exams, hydrated]);

  const currentExam = exams.find((e) => e.id === currentExamId) || null;

  const setCurrentExam = useCallback((id: string) => {
    setCurrentExamId(id);
  }, []);

  const addExam = useCallback(
    (partial: Omit<Exam, "id" | "color" | "topics" | "flashcards" | "auditQuestions" | "uploadedFiles" | "auditScores" | "workflowResult" | "studySessions">) => {
      const newExam: Exam = {
        ...partial,
        id: generateId(),
        color: EXAM_COLORS[exams.length % EXAM_COLORS.length],
        topics: [],
        flashcards: [],
        auditQuestions: [],
        uploadedFiles: [],
        auditScores: [],
        workflowResult: null,
        studySessions: [],
      };
      setExams((prev) => [...prev, newExam]);
      setCurrentExamId(newExam.id);

      // Auto-add upload nudge
      setSuggestions((prev) => [
        ...prev,
        { type: "upload-nudge", examId: newExam.id },
      ]);

      return newExam;
    },
    [exams.length]
  );

  const deleteExam = useCallback((id: string) => {
    setExams((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      // Switch to previous exam or null
      if (currentExamId === id) {
        const idx = prev.findIndex((e) => e.id === id);
        const newIdx = idx > 0 ? idx - 1 : 0;
        setCurrentExamId(filtered.length > 0 ? filtered[Math.min(newIdx, filtered.length - 1)].id : null);
      }
      return filtered;
    });
    // Remove related suggestions
    setSuggestions((prev) => prev.filter((s) => s.examId !== id));
  }, [currentExamId]);

  const updateExam = useCallback((id: string, partial: Partial<Exam>) => {
    setExams((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...partial } : e))
    );
  }, []);

  const addFileToExam = useCallback((examId: string, file: UploadedFile) => {
    setExams((prev) =>
      prev.map((e) =>
        e.id === examId
          ? { ...e, uploadedFiles: [...e.uploadedFiles, file] }
          : e
      )
    );
  }, []);

  const setAnalysisResult = useCallback(
    (examId: string, result: AnalysisResult) => {
      setExams((prev) =>
        prev.map((e) => {
          if (e.id !== examId) return e;

          // Merge topics: deduplicate by name, merge subtopics
          const mergedTopics: Topic[] = [...e.topics];
          for (const newTopic of result.topics) {
            const existing = mergedTopics.find(
              (t) => t.name.toLowerCase() === newTopic.name.toLowerCase()
            );
            if (existing) {
              // Merge subtopics
              for (const sub of newTopic.subtopics || []) {
                if (!existing.subtopics?.some((s) => s.name.toLowerCase() === sub.name.toLowerCase())) {
                  existing.subtopics = [...(existing.subtopics || []), sub];
                }
              }
              // Update weight if new is higher
              if (newTopic.examWeight > existing.examWeight) {
                existing.examWeight = newTopic.examWeight;
              }
            } else {
              mergedTopics.push(newTopic);
            }
          }
          // Sort by examWeight descending
          mergedTopics.sort((a, b) => b.examWeight - a.examWeight);

          // Append flashcards
          const mergedFlashcards: Flashcard[] = [...e.flashcards, ...result.flashcards];

          // Append audit questions, deduplicate similar
          const mergedAudit: AuditQuestion[] = [...e.auditQuestions];
          for (const q of result.auditQuestions) {
            const isDupe = mergedAudit.some(
              (existing) => existing.question.toLowerCase().substring(0, 50) === q.question.toLowerCase().substring(0, 50)
            );
            if (!isDupe) mergedAudit.push(q);
          }

          return {
            ...e,
            topics: mergedTopics,
            flashcards: mergedFlashcards,
            auditQuestions: mergedAudit,
            workflowResult: null, // Reset workflow so it regenerates
          };
        })
      );

      // Remove upload nudge for this exam
      setSuggestions((prev) =>
        prev.filter(
          (s) => !(s.type === "upload-nudge" && s.examId === examId)
        )
      );

      // Add exam alert if no study sessions scheduled
      setExams((current) => {
        const exam = current.find((e) => e.id === examId);
        if (exam && exam.studySessions.length === 0) {
          setSuggestions((prev) => {
            if (prev.some((s) => s.type === "exam-alert" && s.examId === examId))
              return prev;
            return [...prev, { type: "exam-alert", examId }];
          });
        }
        return current;
      });
    },
    []
  );

  const addAuditScore = useCallback(
    (examId: string, score: AuditScore) => {
      setExams((prev) =>
        prev.map((e) =>
          e.id === examId
            ? { ...e, auditScores: [...e.auditScores, score] }
            : e
        )
      );
    },
    []
  );

  const setWorkflow = useCallback(
    (examId: string, result: WorkflowResult) => {
      setExams((prev) =>
        prev.map((e) =>
          e.id === examId ? { ...e, workflowResult: result } : e
        )
      );
    },
    []
  );

  const addStudySession = useCallback((session: StudySession) => {
    setExams((prev) =>
      prev.map((e) =>
        e.id === session.examId
          ? { ...e, studySessions: [...e.studySessions, session] }
          : e
      )
    );
  }, []);

  const removeStudySession = useCallback((sessionId: string) => {
    setExams((prev) =>
      prev.map((e) => ({
        ...e,
        studySessions: e.studySessions.filter((s) => s.id !== sessionId),
      }))
    );
  }, []);

  const dismissSuggestion = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setGoogleAccessToken = useCallback((token: string | null) => {
    setGoogleAccessTokenState(token);
    if (token) localStorage.setItem("gcal_token", token);
    else localStorage.removeItem("gcal_token");
  }, []);

  return (
    <ExamContext.Provider
      value={{
        exams,
        currentExamId,
        currentExam,
        setCurrentExam,
        addExam,
        deleteExam,
        updateExam,
        addFileToExam,
        setAnalysisResult,
        addAuditScore,
        setWorkflow,
        addStudySession,
        removeStudySession,
        suggestions,
        setSuggestions,
        dismissSuggestion,
        googleAccessToken,
        setGoogleAccessToken,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExams() {
  return useContext(ExamContext);
}
