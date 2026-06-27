import manifest from "../data/project-manifest.json" with { type: "json" };

interface ManifestModule {
  id: string;
  name: string;
  description: string;
  paths: string[];
}

interface ProjectManifest {
  name: string;
  description: string;
  stack: string[];
  modules: ManifestModule[];
  dependencies: string[];
  criticalPaths: string[];
}

const PROJECT_MANIFEST = manifest as ProjectManifest;

const PATH_PREFIX_RULES: Array<{ prefix: string; moduleName: string }> = [
  { prefix: "src/modules/actions/", moduleName: "actions" },
  { prefix: "src/modules/business-dev/", moduleName: "business-dev" },
  { prefix: "src/modules/meetings/", moduleName: "meetings" },
  { prefix: "src/modules/knowledge/", moduleName: "knowledge" },
  { prefix: "src/modules/projects/", moduleName: "projects" },
  { prefix: "src/modules/eos/", moduleName: "eos" },
  { prefix: "src/modules/productivity/", moduleName: "productivity" },
  { prefix: "src/modules/automation/", moduleName: "automation" },
  { prefix: "src/modules/admin/", moduleName: "admin" },
  { prefix: "src/modules/platform/", moduleName: "platform" },
  { prefix: "src/modules/testpilot/", moduleName: "testpilot" },
  { prefix: "src/pages/admin/", moduleName: "admin" },
  { prefix: "src/components/auth/", moduleName: "platform" },
  { prefix: "src/contexts/", moduleName: "platform" },
  { prefix: "supabase/functions/", moduleName: "edge-functions" },
  { prefix: "supabase/migrations/", moduleName: "database" },
];

export interface ProjectContext {
  modules: Array<{ id: string; name: string; description: string }>;
  dependencies: string[];
  pathHints: string[];
  impactedModulesFromPaths: Array<{ moduleName: string; files: string[] }>;
}

export function getProjectContext(changedFilePaths: string[]): ProjectContext {
  const impacted = new Map<string, string[]>();

  for (const filePath of changedFilePaths) {
    const rule = PATH_PREFIX_RULES.find((r) => filePath.startsWith(r.prefix));
    const moduleName = rule?.moduleName ?? inferModuleFromPath(filePath);
    const existing = impacted.get(moduleName) ?? [];
    existing.push(filePath);
    impacted.set(moduleName, existing);
  }

  const impactedModulesFromPaths = [...impacted.entries()].map(([moduleName, files]) => ({
    moduleName,
    files,
  }));

  const pathHints = impactedModulesFromPaths.map(
    (item) => `${item.moduleName}: ${item.files.slice(0, 5).join(", ")}${item.files.length > 5 ? "..." : ""}`,
  );

  return {
    modules: PROJECT_MANIFEST.modules.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    })),
    dependencies: PROJECT_MANIFEST.dependencies,
    pathHints,
    impactedModulesFromPaths,
  };
}

function inferModuleFromPath(filePath: string): string {
  if (filePath.startsWith("src/hooks/")) return "platform";
  if (filePath.startsWith("src/lib/")) return "platform";
  if (filePath.startsWith("src/pages/")) return "platform";
  if (filePath.startsWith("src/components/")) return "platform";
  return "unknown";
}

export function getOnboardingContext(): string {
  const moduleLines = PROJECT_MANIFEST.modules
    .map((m) => `- **${m.name}** (${m.id}): ${m.description}`)
    .join("\n");

  return [
    `# ${PROJECT_MANIFEST.name}`,
    PROJECT_MANIFEST.description,
    "",
    "## Stack",
    PROJECT_MANIFEST.stack.join(", "),
    "",
    "## Modules",
    moduleLines,
    "",
    "## Critical paths",
    PROJECT_MANIFEST.criticalPaths.map((p) => `- ${p}`).join("\n"),
  ].join("\n");
}
