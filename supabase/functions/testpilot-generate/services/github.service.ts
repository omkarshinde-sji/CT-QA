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

  const files = await githubFetch<Array<{
    filename: string;
    status: string;
    patch?: string;
    additions?: number;
    deletions?: number;
  }>>(`${repoPath}/pulls/${prNumber}/files?per_page=100`, token);

  const commits = await githubFetch<Array<{ commit: { message: string } }>>(
    `${repoPath}/pulls/${prNumber}/commits?per_page=50`,
    token,
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
