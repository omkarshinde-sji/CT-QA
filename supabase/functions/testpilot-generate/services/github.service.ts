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

function getGithubConfig(repoOverride?: string): GithubConfig {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured in edge function secrets");
  }

  let owner = Deno.env.get("GITHUB_OWNER") ?? "";
  let repo = Deno.env.get("GITHUB_REPO") ?? "";

  if (repoOverride?.includes("/")) {
    const [o, r] = repoOverride.split("/");
    owner = o;
    repo = r;
  }

  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be configured");
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
