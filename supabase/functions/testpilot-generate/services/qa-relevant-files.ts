/** Files that are not user-testable QA changes (deps, lockfiles, tooling). */

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
]);

const AREA_JUNK_PATTERN =
  /package\.json|lock\s*file|lockfile|dependency\s*(update|bump)|npm\s*audit|yarn\s*install|pnpm/i;

export function isQaRelevantChangedFile(filename: string): boolean {
  const lower = filename.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() ?? lower;

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
