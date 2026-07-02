/** Files that are not user-testable QA changes (deps, lockfiles, tooling, infrastructure). */

const EXACT_BASENAME_EXCLUDE = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "npm-shrinkwrap.json",
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".editorconfig",
  ".prettierignore",
  ".eslintignore",
  "license",
  "license.md",
  "license.txt",
  "config.toml",
]);

const AREA_JUNK_PATTERN =
  /package\.json|lock\s*file|lockfile|dependency\s*(update|bump)|npm\s*audit|yarn\s*install|pnpm/i;

const PLACEHOLDER_BEFORE =
  /^(previous behavior before this pr|behavior before this client feedback was implemented)\.?$/i;
const PLACEHOLDER_AFTER =
  /^(updated per pr diff|verify against activecollab)/i;

/** Database migrations, edge functions, generated types — not shown in Changes tab. */
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
  if (lower.startsWith(".claude/") || lower.startsWith(".agents/")) return true;
  if (lower.startsWith("public/") && /\.(ico|png|svg|webp)$/i.test(base)) return true;

  return false;
}

export function isQaRelevantChangedFile(filename: string): boolean {
  const lower = filename.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() ?? lower;

  if (isInfrastructureFile(filename)) return false;
  if (EXACT_BASENAME_EXCLUDE.has(base)) return false;
  if (/^tsconfig(\..+)?\.json$/i.test(base)) return false;
  if (/^(vite|vitest|jest|playwright|tailwind|postcss|babel|rollup|webpack)\.config\./i.test(base)) {
    return false;
  }
  if (/eslint|prettier|stylelint|commitlint|lint-staged/i.test(base) && /\.(js|cjs|mjs|ts|json|yaml|yml)$/i.test(base)) {
    return false;
  }
  if (/^readme(\..+)?$/i.test(base)) return false;
  if (/^changelog(\..+)?$/i.test(base)) return false;
  if (/^contributing(\..+)?$/i.test(base)) return false;
  if (lower.startsWith(".github/")) return false;
  if (lower.startsWith("dist/") || lower.startsWith("build/") || lower.startsWith("coverage/")) {
    return false;
  }
  if (lower.includes("__snapshots__") || base.endsWith(".snap")) return false;
  if (base.endsWith(".map") && !base.endsWith(".tsx.map")) return false;

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

export function partitionChangedFiles<T extends { filename: string }>(
  files: T[],
): { qaRelevant: T[]; excluded: T[] } {
  const qaRelevant: T[] = [];
  const excluded: T[] = [];
  for (const file of files) {
    if (isQaRelevantChangedFile(file.filename)) qaRelevant.push(file);
    else excluded.push(file);
  }
  return { qaRelevant, excluded };
}

export function isJunkChangeArea(area: string, files: string[]): boolean {
  if (!files.length) return AREA_JUNK_PATTERN.test(area);
  return files.every((f) => !isQaRelevantChangedFile(f));
}
