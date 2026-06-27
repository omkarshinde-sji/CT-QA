import { useCallback, useSyncExternalStore } from "react";
import type { ActiveCollabTaskComment } from "../types/activecollab.types";
import type { QaReportWithMeta } from "../types/qa-report.types";

const STORAGE_KEY = "testpilot:session:v3";

export interface TestPilotFormFields {
  taskTitle: string;
  taskDescription: string;
  prNumbers: number[];
  repoOverride: string;
  acProjectId: string;
  acTaskId: string;
  acTaskComments: ActiveCollabTaskComment[];
}

interface TestPilotSessionState {
  form: TestPilotFormFields;
  report: QaReportWithMeta | null;
}

const DEFAULT_FORM: TestPilotFormFields = {
  taskTitle: "",
  taskDescription: "",
  prNumbers: [],
  repoOverride: "",
  acProjectId: "",
  acTaskId: "",
  acTaskComments: [],
};

const DEFAULT_SESSION: TestPilotSessionState = {
  form: DEFAULT_FORM,
  report: null,
};

function migrateLegacyForm(parsed: Partial<TestPilotFormFields> & { prNumber?: string }): TestPilotFormFields {
  const base = { ...DEFAULT_FORM, ...parsed, acTaskComments: parsed.acTaskComments ?? [] };

  if ((!base.prNumbers || base.prNumbers.length === 0) && parsed.prNumber?.trim()) {
    const n = Number(parsed.prNumber);
    if (Number.isFinite(n) && n > 0) {
      base.prNumbers = [n];
    }
  }

  if (!Array.isArray(base.prNumbers)) {
    base.prNumbers = [];
  }

  return base;
}

function loadSessionState(): TestPilotSessionState {
  try {
    for (const key of [STORAGE_KEY, "testpilot:session:v2", "testpilot:session:v1"]) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<TestPilotSessionState> & {
        form?: Partial<TestPilotFormFields> & { prNumber?: string };
      };
      return {
        form: migrateLegacyForm(parsed.form ?? {}),
        report: parsed.report ?? null,
      };
    }
    return DEFAULT_SESSION;
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

  const setPrNumbers = useCallback((prNumbers: number[]) => {
    const normalized = [...new Set(prNumbers.filter((n) => n > 0))].sort((a, b) => a - b);
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, prNumbers: normalized } }));
  }, []);

  const addPrNumber = useCallback((pr: number) => {
    if (!Number.isFinite(pr) || pr <= 0) return;
    setSessionState((prev) => {
      const next = [...new Set([...prev.form.prNumbers, Math.floor(pr)])].sort((a, b) => a - b);
      return { ...prev, form: { ...prev.form, prNumbers: next } };
    });
  }, []);

  const removePrNumber = useCallback((pr: number) => {
    setSessionState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        prNumbers: prev.form.prNumbers.filter((n) => n !== pr),
      },
    }));
  }, []);

  const setRepoOverride = useCallback((repoOverride: string) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, repoOverride } }));
  }, []);

  const setAcProjectId = useCallback((acProjectId: string) => {
    setSessionState((prev) => ({
      ...prev,
      form: { ...prev.form, acProjectId, acTaskId: "", acTaskComments: [] },
    }));
  }, []);

  const setAcTaskId = useCallback((acTaskId: string) => {
    setSessionState((prev) => ({
      ...prev,
      form: { ...prev.form, acTaskId, acTaskComments: [] },
    }));
  }, []);

  const setAcTaskComments = useCallback((acTaskComments: ActiveCollabTaskComment[]) => {
    setSessionState((prev) => ({ ...prev, form: { ...prev.form, acTaskComments } }));
  }, []);

  const applyActiveCollabContext = useCallback(
    (input: { title: string; description: string; comments: ActiveCollabTaskComment[] }) => {
      setSessionState((prev) => ({
        ...prev,
        form: {
          ...prev.form,
          taskTitle: input.title,
          taskDescription: input.description,
          acTaskComments: input.comments,
        },
      }));
    },
    [],
  );

  const setReport = useCallback((report: QaReportWithMeta | null) => {
    setSessionState((prev) => ({ ...prev, report }));
  }, []);

  return {
    ...session.form,
    report: session.report,
    setTaskTitle,
    setTaskDescription,
    setPrNumbers,
    addPrNumber,
    removePrNumber,
    setRepoOverride,
    setAcProjectId,
    setAcTaskId,
    setAcTaskComments,
    applyActiveCollabContext,
    setReport,
  };
}
