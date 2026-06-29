/** Client mirror of edge-function client-feedback-parser.ts */

const ACTION_VERB =
  /^(Removed|Updated|Added|Renamed|Fixed|Replaced|Formatted|Implemented|Retained|Center-aligned|Changed|Adjusted|Moved|Enabled|Disabled)\b/i;

const NOISE_LINE =
  /^(update:\s*\d|user story|as a \w+|thanks|please review|acceptance criteria|given\b|when\b|then\b)/i;

const STOP_WORDS = new Set([
  "updated", "section", "the", "with", "from", "added", "renamed", "fixed",
  "replaced", "formatted", "implemented", "retained", "removed", "display",
  "graph", "calculation", "results", "button", "lines", "toggle", "client",
  "feedback", "analysis", "other", "advisor", "issue", "data", "error",
  "correct", "value", "level", "where", "incorrectly", "should",
]);

function cleanLine(line: string): string {
  return line
    .replace(/^update:\s*/i, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function parseFeedbackBlock(text: string): string[] {
  const items: string[] = [];
  let sectionPrefix = "";

  for (const rawLine of text.split(/\n/)) {
    const line = cleanLine(rawLine);
    if (!line || NOISE_LINE.test(line)) continue;
    if (/^\d{1,2}\s+\w+\s+\d{4}$/i.test(line)) continue;
    if (line.length < 6) continue;

    const sectionUpdate = line.match(/^(Updated the .+? section):\s+(.+)$/i);
    if (sectionUpdate) {
      sectionPrefix = sectionUpdate[1].trim();
      items.push(`${sectionPrefix}: ${sectionUpdate[2].trim()}`);
      continue;
    }

    const inlineColon = line.match(/^(.{4,120}?):\s+(.{6,})$/);
    if (inlineColon) {
      const prefix = inlineColon[1].trim();
      const detail = inlineColon[2].trim();
      if (!ACTION_VERB.test(prefix) || /section$/i.test(prefix)) {
        sectionPrefix = prefix;
        items.push(`${prefix}: ${detail}`);
        continue;
      }
    }

    if (/:\s*$/.test(line)) {
      sectionPrefix = line.replace(/:$/, "").trim();
      continue;
    }

    if (ACTION_VERB.test(line)) {
      sectionPrefix = "";
      items.push(line);
      continue;
    }

    if (sectionPrefix) {
      items.push(`${sectionPrefix}: ${line}`);
      continue;
    }

    items.push(line);
  }

  return items;
}

function dedupeItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function extractClientFeedbackItems(
  _description: string,
  comments: Array<{ body: string }>,
): string[] {
  const blocks = comments
    .map((c) => c.body?.trim())
    .filter((body): body is string => Boolean(body));

  return dedupeItems(blocks.flatMap((block) => parseFeedbackBlock(block)));
}

export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

export function distinctiveWords(item: string): string[] {
  const normalized = normalizeForMatch(item);
  const words = normalized
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  for (const n of normalized.match(/\d+/g) ?? []) {
    if (n.length >= 2 && !words.includes(n)) words.push(n);
  }
  return words;
}

function fieldBlob(...parts: string[]): string {
  return normalizeForMatch(parts.filter(Boolean).join(" "));
}

function changeBlob(change: {
  area: string;
  before?: string;
  after?: string;
  whatToVerify?: string;
}): string {
  return fieldBlob(change.area, change.before ?? "", change.after ?? "", change.whatToVerify ?? "");
}

export function changeRelatesToFeedbackItem(
  change: { area: string; before?: string; after?: string; whatToVerify?: string },
  item: string,
): boolean {
  const dist = distinctiveWords(item);
  const blob = changeBlob(change);
  if (!dist.length) {
    const n = normalizeForMatch(item);
    return blob.includes(n.slice(0, 35));
  }
  const hits = dist.filter((w) => blob.includes(w));
  if (hits.length >= Math.ceil(dist.length * 0.5)) return true;
  if (dist.length <= 4 && hits.length >= 2) return true;
  return false;
}

export function testRelatesToFeedbackItem(
  test: { title: string; expectedResult?: string },
  item: string,
): boolean {
  const dist = distinctiveWords(item);
  const blob = fieldBlob(test.title, test.expectedResult ?? "");
  if (!dist.length) {
    const n = normalizeForMatch(item);
    return blob.includes(n.slice(0, 35));
  }
  const hits = dist.filter((w) => blob.includes(w));
  if (hits.length >= Math.ceil(dist.length * 0.5)) return true;
  if (dist.length <= 4 && hits.length >= 2) return true;
  return false;
}

export function hasDedicatedChangeArea(
  item: string,
  changes: Array<{ area: string; before?: string; after?: string; whatToVerify?: string }>,
): boolean {
  return changes.some((c) => changeRelatesToFeedbackItem(c, item));
}

export function hasDedicatedPositiveTest(
  item: string,
  tests: Array<{ title: string; expectedResult?: string }>,
): boolean {
  return tests.some((t) => testRelatesToFeedbackItem(t, item));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function canonicalChangeScore(
  change: { area: string; after?: string; whatToVerify?: string },
  item: string,
): number {
  const nItem = normalizeForMatch(item);
  const nArea = normalizeForMatch(change.area);
  const nAfter = normalizeForMatch(change.after ?? "");
  if (nArea === nItem) return 1000;
  if (nAfter === nItem) return 900;
  if (nArea.includes(nItem) || nItem.includes(nArea)) return 700;
  const dist = distinctiveWords(item);
  const blob = changeBlob(change);
  const hits = dist.filter((w) => blob.includes(w)).length;
  return (hits / Math.max(dist.length, 1)) * 500;
}

function canonicalTestScore(
  test: { title: string; expectedResult?: string },
  item: string,
): number {
  const nItem = normalizeForMatch(item);
  const nExpected = normalizeForMatch(test.expectedResult ?? "");
  if (nExpected === nItem) return 1000;
  const nTitle = normalizeForMatch(test.title);
  if (nTitle.includes(nItem.slice(0, 40))) return 800;
  const dist = distinctiveWords(item);
  const blob = fieldBlob(test.title, test.expectedResult ?? "");
  const hits = dist.filter((w) => blob.includes(w)).length;
  return (hits / Math.max(dist.length, 1)) * 500;
}

function canonicalizeChange<T extends {
  area: string;
  after: string;
  whatToVerify: string;
  files?: string[];
  before: string;
  technicalNote?: string;
}>(change: T, item: string): T {
  return {
    ...change,
    area: truncate(item, 120),
    after: item,
    whatToVerify: `Confirm: ${item}`,
  };
}

export function dedupeChangesByFeedback<T extends {
  area: string;
  before: string;
  after: string;
  whatToVerify: string;
  files?: string[];
  technicalNote?: string;
}>(changes: T[], feedbackItems: string[]): T[] {
  if (!feedbackItems.length) return changes;

  const working = [...changes];
  const remove = new Set<number>();

  for (const item of feedbackItems) {
    const matches = working
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => changeRelatesToFeedbackItem(c, item));

    if (!matches.length) continue;

    let best = matches[0];
    let bestScore = canonicalChangeScore(best.c, item);
    for (let m = 1; m < matches.length; m++) {
      const score = canonicalChangeScore(matches[m].c, item);
      if (score > bestScore) {
        best = matches[m];
        bestScore = score;
      }
    }

    for (const { i } of matches) {
      if (i !== best.i) remove.add(i);
    }
    working[best.i] = canonicalizeChange(working[best.i], item);
  }

  return working.filter((_, i) => !remove.has(i));
}

export function dedupePositiveTestsByFeedback<T extends {
  title: string;
  steps?: string[];
  expectedResult?: string;
  category?: string;
}>(tests: T[], feedbackItems: string[]): T[] {
  if (!feedbackItems.length) return tests;

  const working = [...tests];
  const remove = new Set<number>();

  for (const item of feedbackItems) {
    const matches = working
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => testRelatesToFeedbackItem(t, item));

    if (matches.length <= 1) continue;

    let best = matches[0];
    let bestScore = canonicalTestScore(best.t, item);
    for (let m = 1; m < matches.length; m++) {
      const score = canonicalTestScore(matches[m].t, item);
      if (score > bestScore) {
        best = matches[m];
        bestScore = score;
      }
    }

    for (const { i } of matches) {
      if (i !== best.i) remove.add(i);
    }
    working[best.i] = {
      ...working[best.i],
      title: `Verify client feedback: ${truncate(item, 90)}`,
      expectedResult: item,
    };
  }

  return working.filter((_, i) => !remove.has(i));
}

export function dedupeRequirementsByFeedback<T extends {
  type: string;
  description: string;
  acceptanceCriteria?: string[];
}>(requirements: T[], feedbackItems: string[]): T[] {
  if (!feedbackItems.length) return requirements;

  const working = [...requirements];
  const remove = new Set<number>();

  for (const item of feedbackItems) {
    const nItem = normalizeForMatch(item);
    const matches = working
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        const nDesc = normalizeForMatch(r.description);
        return nDesc === nItem || nDesc.includes(nItem.slice(0, 40)) || changeRelatesToFeedbackItem(
          { area: r.description, after: r.description, whatToVerify: r.description },
          item,
        );
      });

    if (matches.length <= 1) continue;

    let keep = matches[0].i;
    for (const { r, i } of matches) {
      if (normalizeForMatch(r.description) === nItem) {
        keep = i;
        break;
      }
    }

    for (const { i } of matches) {
      if (i !== keep) remove.add(i);
    }
  }

  return working.filter((_, i) => !remove.has(i));
}
