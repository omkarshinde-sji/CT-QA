/** Client mirror of edge function QA file filtering. */

const EXACT_BASENAME_EXCLUDE = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  ".gitignore",
  ".npmrc",
  ".editorconfig",
  "config.toml",
]);

const AREA_JUNK_PATTERN =
  /package\.json|lock\s*file|lockfile|dependency\s*(update|bump)|npm\s*audit/i;

const PLACEHOLDER_BEFORE =
  /^(previous behavior before this pr|behavior before this client feedback was implemented)\.?$/i;
const PLACEHOLDER_AFTER =
  /^(updated per pr diff|verify against activecollab)/i;

export function isInfrastructureFile(filename: string): boolean {
  const lower = filename.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() ?? lower;

  if (lower.startsWith("supabase/migrations/")) return true;
  if (lower.startsWith("supabase/seed/")) return true;
  if (lower.startsWith("supabase/functions/")) return true;
  if (lower === "supabase/config.toml") return true;
  if (lower.includes("/integrations/supabase/types.ts")) return true;
  if (base.endsWith(".sql")) return true;
  if (lower.startsWith("scripts/")) return true;
  if (lower.startsWith("docs/")) return true;

  return false;
}

export function isQaRelevantChangedFile(filename: string): boolean {
  const lower = filename.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() ?? lower;

  if (isInfrastructureFile(filename)) return false;
  if (EXACT_BASENAME_EXCLUDE.has(base)) return false;
  if (/^tsconfig(\..+)?\.json$/i.test(base)) return false;
  if (/^(vite|vitest|jest|eslint|prettier|tailwind|postcss)\./i.test(base)) return false;
  if (/^readme(\..+)?$/i.test(base)) return false;
  if (lower.startsWith(".github/") || lower.startsWith("dist/")) return false;

  return true;
}

export function isPlaceholderChange(change: {
  area: string;
  before: string;
  after: string;
  files?: string[];
}): boolean {
  const before = change.before.trim();
  const after = change.after.trim();

  if (PLACEHOLDER_BEFORE.test(before)) return true;
  if (PLACEHOLDER_AFTER.test(after)) return true;

  const area = change.area.trim();
  if (/^update:\s*.+\.(sql|toml|json|yaml|yml)$/i.test(area)) return true;

  const files = change.files ?? [];
  if (
    files.length === 1 &&
    isInfrastructureFile(files[0]) &&
    (PLACEHOLDER_BEFORE.test(before) || PLACEHOLDER_AFTER.test(after))
  ) {
    return true;
  }

  return false;
}

export function isJunkChangeArea(area: string, files: string[]): boolean {
  if (!files.length) return AREA_JUNK_PATTERN.test(area);
  return files.every((f) => !isQaRelevantChangedFile(f));
}

export function sanitizeReportForDisplay<T extends {
  featureSummary: {
    changes?: Array<{
      area: string;
      files?: string[];
      before: string;
      after: string;
      technicalNote?: string;
      whatToVerify: string;
    }>;
    totalChangedFiles?: number;
    qaRelevantFileCount?: number;
    excludedFiles?: string[];
  };
}>(report: T, feedbackItems: string[] = []): T {
  const fs = report.featureSummary;
  const excluded = fs.excludedFiles ?? [];

  const qaPathsFromReport = [
    ...new Set(
      (fs.changes ?? [])
        .flatMap((c) => c.files ?? [])
        .filter((f) => isQaRelevantChangedFile(f)),
    ),
  ];

  const isFeedbackArea = (area: string) =>
    feedbackItems.some((item) => {
      const a = area.toLowerCase().replace(/\s+/g, " ");
      const i = item.toLowerCase().replace(/\s+/g, " ");
      return a === i || a.includes(i.slice(0, 50)) || i.includes(a.slice(0, 50));
    });

  const changes = (fs.changes ?? [])
    .map((c) => {
      let files = (c.files ?? []).filter((f) => isQaRelevantChangedFile(f));
      if (!files.length && qaPathsFromReport.length && isFeedbackArea(c.area)) {
        files = [qaPathsFromReport[0]];
      }
      let technicalNote = c.technicalNote;
      if (technicalNote && isInfrastructureFile(technicalNote)) {
        technicalNote = undefined;
      }
      return { ...c, files, technicalNote };
    })
    .filter((c) => {
      if (isPlaceholderChange(c)) return false;
      if (c.files?.length && !isJunkChangeArea(c.area, c.files)) return true;
      return isFeedbackArea(c.area) && !isPlaceholderChange(c);
    });

  return {
    ...report,
    featureSummary: {
      ...fs,
      changes,
      qaRelevantFileCount: changes.flatMap((c) => c.files ?? []).length,
      excludedFiles: excluded.length ? excluded : fs.excludedFiles,
    },
  };
}
