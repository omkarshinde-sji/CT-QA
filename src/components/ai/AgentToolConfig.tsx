import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Code,
  Search,
  Globe,
  Image,
  Plug,
  Info,
  Sparkles,
} from "lucide-react";

export interface ToolConfig {
  tool_code_interpreter: boolean;
  tool_file_search: boolean;
  tool_web_search: boolean;
  tool_image_generation: boolean;
  tool_mcp: boolean;
  mcp_server_ids: string[];
  tools_config: unknown[];
}

interface AgentToolConfigProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  disabled?: boolean;
}

interface ToolOption {
  key: keyof Pick<ToolConfig, 'tool_code_interpreter' | 'tool_file_search' | 'tool_web_search' | 'tool_image_generation' | 'tool_mcp'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  requiresProvider?: string;
}

const TOOL_OPTIONS: ToolOption[] = [
  {
    key: "tool_file_search",
    label: "File Search",
    description: "Search through knowledge base files using semantic search",
    icon: Search,
    badge: "RAG",
    badgeVariant: "secondary",
  },
  {
    key: "tool_web_search",
    label: "Web Search",
    description: "Search the web for real-time information",
    icon: Globe,
    badge: "Perplexity",
    badgeVariant: "outline",
    requiresProvider: "perplexity",
  },
  {
    key: "tool_code_interpreter",
    label: "Code Interpreter",
    description: "Execute code snippets and analyze results",
    icon: Code,
    badge: "Beta",
    badgeVariant: "default",
  },
  {
    key: "tool_image_generation",
    label: "Image Generation",
    description: "Generate images using DALL-E or similar models",
    icon: Image,
    badge: "DALL-E",
    badgeVariant: "outline",
    requiresProvider: "openai",
  },
  {
    key: "tool_mcp",
    label: "MCP Servers",
    description: "Connect to external Model Context Protocol servers",
    icon: Plug,
    badge: "Advanced",
    badgeVariant: "secondary",
  },
];

export function AgentToolConfig({
  config,
  onChange,
  disabled = false,
}: AgentToolConfigProps) {
  const handleToggle = (key: ToolOption["key"], enabled: boolean) => {
    onChange({
      ...config,
      [key]: enabled,
    });
  };

  const enabledCount = TOOL_OPTIONS.filter((opt) => config[opt.key]).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Tools & Capabilities
            </CardTitle>
            <CardDescription>
              Enable tools to extend this agent's capabilities
            </CardDescription>
          </div>
          {enabledCount > 0 && (
            <Badge variant="secondary">
              {enabledCount} tool{enabledCount !== 1 ? "s" : ""} enabled
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {TOOL_OPTIONS.map((tool) => {
            const Icon = tool.icon;
            const isEnabled = config[tool.key];

            return (
              <div
                key={tool.key}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isEnabled
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-md ${
                      isEnabled ? "bg-primary/10 text-primary" : "bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={tool.key}
                        className="font-medium cursor-pointer"
                      >
                        {tool.label}
                      </Label>
                      {tool.badge && (
                        <Badge variant={tool.badgeVariant} className="text-xs">
                          {tool.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                    {tool.requiresProvider && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Requires {tool.requiresProvider} provider
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Info className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p>{tool.description}</p>
                      {tool.requiresProvider && (
                        <p className="text-amber-500 mt-1">
                          Note: This tool requires the {tool.requiresProvider}{" "}
                          provider to be configured.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Switch
                    id={tool.key}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(tool.key, checked)}
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </TooltipProvider>

        {config.tool_mcp && (
          <div className="mt-4 p-3 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              MCP Server configuration will be available in the Integrations
              page. Connect external tool servers to extend agent capabilities.
            </p>
            <Button variant="outline" size="sm" className="mt-2" disabled>
              Configure MCP Servers
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Default config factory
export function getDefaultToolConfig(): ToolConfig {
  return {
    tool_code_interpreter: false,
    tool_file_search: true, // Enable by default for RAG
    tool_web_search: false,
    tool_image_generation: false,
    tool_mcp: false,
    mcp_server_ids: [],
    tools_config: [],
  };
}
