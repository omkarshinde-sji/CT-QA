import { useCallback, useSyncExternalStore } from "react";
import type { QaReportWithMeta } from "../types/qa-report.types";

const STORAGE_KEY = "testpilot:session:v1";

export interface TestPilotFormFields {
  taskTitle: string;
  taskDescription: string;
  prNumber: string;
  repoOverride: string;
}

interface TestPilotSessionState {
  form: TestPilotFormFields;
  report: QaReportWithMeta | null;
}

const DEFAULT_FORM: TestPilotFormFields = {
  taskTitle: "",
  taskDescription: "",
  prNumber: "",
  repoOverride: "",
};

const DEFAULT_SESSION: TestPilotSessionState = {
  form: DEFAULT_FORM,
  report: null,
};

function loadSessionState(): TestPilotSessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SESSION;
    const parsed = JSON.parse(raw) as Partial<TestPilotSessionState>;
    return {
      form: { ...DEFAULT_FORM, ...parsed.form },
      report: parsed.report ?? null,
    };
  } catch {
    return DEFAULT_SESSION;
  }
}

function saveSessionState(state: TestPilotSessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private browsing
  }
}

let sessionState: TestPilotSessionState = loadSessionState();
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setSessionState(updater: (prev: TestPilotSessionState) => TestPilotSessionState) {
  sessionState = updater(sessionState);
  saveSessionState(sessionState);
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return sessionState;
}

function getServerSnapshot() {
  return DEFAULT_SESSION;
}

export function useTestPilotFormState() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTaskTitle = useCallback((taskTitle: string) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, taskTitle } }));
  }, []);

  const setTaskDescription = useCallback((taskDescription: string) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, taskDescription } }));
  }, []);

  const setPrNumber = useCallback((prNumber: string) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, prNumber } }));
  }, []);

  const setRepoOverride = useCallback((repoOverride: string) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, repoOverride } }));
  }, []);

  const setReport = useCallback((report: QaReportWithMeta | null) => {
    setSessionState((prev) => ({ ...prev, report }));
  }, []);

  return {
    ...session.form,
    report: session.report,
    setTaskTitle,
    setTaskDescription,
    setPrNumber,
    setRepoOverride,
    setReport,
  };
}
