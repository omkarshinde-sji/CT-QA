/** Normalize owner/repo from shorthand or full GitHub URLs. */
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

export function isValidGithubRepo(input: string): boolean {
  return normalizeGithubRepo(input) !== null;
}
