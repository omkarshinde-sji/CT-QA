const GITHUB_API = "https://api.github.com";
const MAX_PATCH_BYTES = 8192;

export interface GithubPrContext {
  prNumber: number;
  title: string;
  body: string | null;
  state: string;
  changedFiles: Array<{ filename: string; status: string; patch?: string }>;
  commitMessages: string[];
  diffSummary: string;
  headSha: string;
  repo: string;
}

interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}

/** Accept owner/repo or full GitHub URLs. */
export function normalizeGithubRepo(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  value = value.replace(/\.git$/i, "");

  const urlMatch = value.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i,
  );
  if (urlMatch) {
    return `${urlMatch[1]}/${urlMatch[2]}`;
  }

  const slashIndex = value.indexOf("/");
  if (slashIndex === -1) return null;

  const owner = value.slice(0, slashIndex).trim();
  const repo = value.slice(slashIndex + 1).split(/[/?#]/)[0].trim();
  if (!owner || !repo) return null;

  return `${owner}/${repo}`;
}

function getGithubConfig(repoOverride?: string): GithubConfig {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured. Add it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.",
    );
  }

  let owner = Deno.env.get("GITHUB_OWNER") ?? "";
  let repo = Deno.env.get("GITHUB_REPO") ?? "";

  const normalized = repoOverride ? normalizeGithubRepo(repoOverride) : null;
  if (normalized) {
    const [o, r] = normalized.split("/");
    owner = o;
    repo = r;
  }

  if (!owner || !repo) {
    throw new Error(
      "GitHub repo is required. Provide owner/repo or a GitHub URL in the request.",
    );
  }

  return { token, owner, repo };
}

async function githubFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${details}`);
  }

  return response.json() as Promise<T>;
}

async function githubFetchPaginated<T>(
  path: string,
  token: string,
  perPage = 100,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (page <= 20) {
    const separator = path.includes("?") ? "&" : "?";
    const pageItems = await githubFetch<T[]>(
      `${path}${separator}per_page=${perPage}&page=${page}`,
      token,
    );
    if (!pageItems.length) break;
    items.push(...pageItems);
    if (pageItems.length < perPage) break;
    page++;
  }

  return items;
}

function truncatePatch(patch: string | undefined): string | undefined {
  if (!patch) return undefined;
  const encoder = new TextEncoder();
  if (encoder.encode(patch).length <= MAX_PATCH_BYTES) return patch;
  return `${patch.slice(0, MAX_PATCH_BYTES)}\n... [truncated]`;
}

export async function fetchPullRequestContext(
  prNumber: number,
  repoOverride?: string,
): Promise<GithubPrContext> {
  const { token, owner, repo } = getGithubConfig(repoOverride);
  const repoPath = `/repos/${owner}/${repo}`;

  const pr = await githubFetch<{
    title: string;
    body: string | null;
    state: string;
    head: { sha: string };
  }>(`${repoPath}/pulls/${prNumber}`, token);

  const files = await githubFetchPaginated<{
    filename: string;
    status: string;
    patch?: string;
    additions?: number;
    deletions?: number;
  }>(`${repoPath}/pulls/${prNumber}/files`, token);

  const commits = await githubFetchPaginated<{ commit: { message: string } }>(
    `${repoPath}/pulls/${prNumber}/commits`,
    token,
    100,
  );

  const changedFiles = files.map((file) => ({
    filename: file.filename,
    status: file.status,
    patch: truncatePatch(file.patch),
  }));

  const commitMessages = commits.map((c) => c.commit.message);
  const diffSummary = files
    .map((f) => `${f.status}: ${f.filename} (+${f.additions ?? 0}/-${f.deletions ?? 0})`)
    .join("\n");

  return {
    prNumber,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    changedFiles,
    commitMessages,
    diffSummary,
    headSha: pr.head.sha,
    repo: `${owner}/${repo}`,
  };
}

export function normalizePrNumbers(input: number[]): number[] {
  const unique = [...new Set(input.filter((n) => Number.isFinite(n) && n > 0))];
  unique.sort((a, b) => a - b);
  return unique;
}

/** Fetch multiple PRs in parallel and merge file diffs (later PR wins on same file). */
export async function fetchPullRequestContexts(
  prNumbers: number[],
  repoOverride?: string,
): Promise<{ prNumbers: number[]; prs: GithubPrContext[]; merged: GithubPrContext }> {
  const normalized = normalizePrNumbers(prNumbers);
  if (!normalized.length) {
    throw new Error("At least one pull request number is required.");
  }

  const prs = await Promise.all(
    normalized.map((prNumber) => fetchPullRequestContext(prNumber, repoOverride)),
  );

  const fileMap = new Map<string, { filename: string; status: string; patch?: string; fromPr: number }>();
  for (const pr of prs) {
    for (const file of pr.changedFiles) {
      fileMap.set(file.filename, { ...file, fromPr: pr.prNumber });
    }
  }

  const mergedFiles = [...fileMap.values()].map(({ fromPr: _fromPr, ...file }) => file);
  const mergedCommits = prs.flatMap((pr) =>
    pr.commitMessages.map((m) => `[PR #${pr.prNumber}] ${m}`),
  );
  const mergedDiffSummary = prs
    .map((pr) => `--- PR #${pr.prNumber}: ${pr.title} ---\n${pr.diffSummary}`)
    .join("\n\n");

  const merged: GithubPrContext = {
    prNumber: normalized[0],
    title: prs.length === 1
      ? prs[0].title
      : `${prs[0].title} (+ ${prs.length - 1} linked PR${prs.length > 2 ? "s" : ""})`,
    body: prs
      .map((pr) => `### PR #${pr.prNumber}: ${pr.title}\n${pr.body ?? "_No description_"}`)
      .join("\n\n"),
    state: prs.map((p) => p.state).includes("open") ? "open" : prs[prs.length - 1].state,
    changedFiles: mergedFiles,
    commitMessages: mergedCommits,
    diffSummary: mergedDiffSummary,
    headSha: prs.map((p) => p.headSha).join(":"),
    repo: prs[0].repo,
  };

  return { prNumbers: normalized, prs, merged };
}
