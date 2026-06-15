import React, { createContext, useContext, useState } from "react";

/**
 * Study Mode — facilitator-driven session state for the focus-group study.
 *
 * When active, the app shows a participant banner and an "End session & take
 * survey" control that opens the in-app SUS questionnaire. Normal users never
 * enter Study Mode, so they never see any of the study UI.
 *
 * State is persisted to sessionStorage so a page reload keeps the session
 * alive, but a new tab / fresh browser session starts clean.
 */

export type StudyProfile = "lab_researcher" | "cs_student";
export type StudyModeKind = "in_person" | "remote";

/** Participant intake header captured at session start. */
export interface StudyIntake {
  participantId: string;
  profile: StudyProfile | null;
  studyDate: string;
  facilitator: string;
  noteTaker: string;
  mode: StudyModeKind | null;
}

interface StudyModeState {
  active: boolean;
  intake: StudyIntake | null;
  startedAt: string | null;
}

interface StudyModeContextType extends StudyModeState {
  startSession: (intake: StudyIntake) => void;
  endSession: () => void;
}

const STORAGE_KEY = "studyMode";

const StudyModeContext = createContext<StudyModeContextType | undefined>(
  undefined
);

function load(): StudyModeState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StudyModeState;
      if (parsed && parsed.active && parsed.intake?.participantId) return parsed;
    }
  } catch {
    /* ignore malformed storage */
  }
  return { active: false, intake: null, startedAt: null };
}

function persist(state: StudyModeState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function StudyModeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StudyModeState>(() => load());

  const startSession = (intake: StudyIntake) => {
    const next: StudyModeState = {
      active: true,
      intake: { ...intake, participantId: intake.participantId.trim() },
      startedAt: new Date().toISOString(),
    };
    setState(next);
    persist(next);
  };

  const endSession = () => {
    const next: StudyModeState = {
      active: false,
      intake: null,
      startedAt: null,
    };
    setState(next);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <StudyModeContext.Provider value={{ ...state, startSession, endSession }}>
      {children}
    </StudyModeContext.Provider>
  );
}

export function useStudyMode() {
  const ctx = useContext(StudyModeContext);
  if (!ctx) {
    throw new Error("useStudyMode must be used within StudyModeProvider");
  }
  return ctx;
}
