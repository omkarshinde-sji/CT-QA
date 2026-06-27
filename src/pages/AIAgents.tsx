import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useAIAgents,
  useCreateAgent,
  useUpdateAgent,
  useToggleAgent,
  useDeleteAgent,
  useRunAgent,
  useAgentRuns,
  AIAgent,
  AgentFormData,
} from "@/hooks/useAIAgents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { Brain, Loader2, Plus, Edit, Play, Pause, Trash2, History, MessageSquare } from "lucide-react";
import {
  QuickStartWizard,
  AgentCategoryGuide,
  SystemPromptGuide,
  MemorySystemGuide,
  MultiAgentCollaborationInfo,
  HITLApprovalInfo,
} from "@/components/admin/AgentConfigurationGuide";

export default function AIAgents() {
  const navigate = useNavigate();
  const { data: agents, isLoading } = useAIAgents();
  const { data: recentRuns } = useAgentRuns();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const toggleAgent = useToggleAgent();
  const deleteAgent = useDeleteAgent();
  const runAgent = useRunAgent();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [runInput, setRunInput] = useState("");

  const [formData, setFormData] = useState<AgentFormData>({
    name: "",
    slug: "",
    description: "",
    category: "general",
    system_prompt: "",
    is_enabled: true,
    memory_enabled: false,
    rag_enabled: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      return;
    }

    try {
      if (editingAgent) {
        await updateAgent.mutateAsync({ id: editingAgent.id, data: formData });
      } else {
        await createAgent.mutateAsync(formData);
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleEdit = (agent: AIAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      slug: agent.slug,
      description: agent.description || "",
      category: agent.category || "general",
      system_prompt: agent.system_prompt,
      is_enabled: agent.is_enabled,
      memory_enabled: agent.memory_enabled,
      rag_enabled: agent.rag_enabled,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (agentId: string) => {
    setDeletingAgentId(agentId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAgentId) return;

    try {
      await deleteAgent.mutateAsync(deletingAgentId);
      setDeleteDialogOpen(false);
      setDeletingAgentId(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRun = async () => {
    if (!selectedAgent || !runInput.trim()) return;

    try {
      await runAgent.mutateAsync({
        agentId: selectedAgent.id,
        input: runInput,
      });
      setRunInput("");
      setRunDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const openRunDialog = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setRunInput("");
    setRunDialogOpen(true);
  };

  const handleRunDialogOpenChange = (open: boolean) => {
    setRunDialogOpen(open);
    if (!open) {
      setRunInput("");
      setSelectedAgent(null);
    }
  };

  const openHistoryDialog = () => {
    setHistoryDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      category: "general",
      system_prompt: "",
      is_enabled: true,
      memory_enabled: false,
      rag_enabled: false,
    });
    setEditingAgent(null);
  };

  const getCategoryBadge = (category: string | null) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      communication: "default",
      analysis: "secondary",
      task_management: "default",
      general: "outline",
    };
    return (
      <Badge variant={variants[category || "general"] || "outline"}>
        {category || "general"}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      completed: { variant: "default", label: "Completed" },
      running: { variant: "secondary", label: "Running" },
      failed: { variant: "destructive", label: "Failed" },
      pending: { variant: "outline" as any, label: "Pending" },
    };
    const { variant, label } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const isProcessing = createAgent.isPending || updateAgent.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI agents and their configurations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openHistoryDialog}>
            <History className="mr-2 h-4 w-4" />
            Execution History
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAgent ? "Edit AI Agent" : "Create New AI Agent"}
                </DialogTitle>
                <DialogDescription>
                  Configure your AI agent's behavior and settings
                </DialogDescription>
              </DialogHeader>

              {!editingAgent && <QuickStartWizard />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Meeting Summarizer"
                      required
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="meeting-summarizer"
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-generated if left empty
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Summarizes meetings and extracts action items"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="communication">Communication</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="task_management">Task Management</SelectItem>
                    </SelectContent>
                  </Select>
                  <AgentCategoryGuide />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system_prompt">System Prompt *</Label>
                  <Textarea
                    id="system_prompt"
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder="You are an AI assistant that helps summarize meetings..."
                    rows={6}
                    required
                    disabled={isProcessing}
                  />
                  <SystemPromptGuide />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable Agent</Label>
                    <p className="text-sm text-muted-foreground">
                      Agent will be available for use
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_enabled: checked })
                    }
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <MemorySystemGuide />
                  <Switch
                    checked={formData.memory_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, memory_enabled: checked })
                    }
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Enable RAG</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this agent to answer using synced task context
                    </p>
                  </div>
                  <Switch
                    checked={!!formData.rag_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, rag_enabled: checked })
                    }
                    disabled={isProcessing}
                  />
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <MultiAgentCollaborationInfo />
                  <HITLApprovalInfo />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isProcessing}>
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingAgent ? "Update" : "Create"} Agent
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {agents?.filter((a) => a.is_enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {agents?.filter((a) => !a.is_enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentRuns?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !agents || agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
            <Brain className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No AI agents yet</p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className={!agent.is_enabled ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      {agent.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {agent.description || "No description"}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAgent.mutate({ id: agent.id, is_enabled: !agent.is_enabled })}
                    disabled={toggleAgent.isPending}
                  >
                    {agent.is_enabled ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {getCategoryBadge(agent.category)}
                  {agent.is_enabled && (
                    <Badge variant="default">Active</Badge>
                  )}
                  {agent.memory_enabled && (
                    <Badge variant="outline">Memory</Badge>
                  )}
                  {agent.rag_enabled && (
                    <Badge variant="secondary">RAG</Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Created {new Date(agent.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  {agent.is_enabled && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => navigate(`/admin/ai/chat?agent=${agent.id}`)}
                      >
                        <MessageSquare className="mr-2 h-3 w-3" />
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRunDialog(agent)}
                      >
                        <Play className="mr-2 h-3 w-3" />
                        Run
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={agent.is_enabled ? "" : "flex-1"}
                    onClick={() => handleEdit(agent)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(agent.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run Agent Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={handleRunDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Agent: {selectedAgent?.name}</DialogTitle>
            <DialogDescription>
              Provide input for the agent to process
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-input">Input</Label>
              <Textarea
                id="run-input"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder="Enter your prompt or question..."
                rows={4}
                disabled={runAgent.isPending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleRunDialogOpenChange(false)}
                disabled={runAgent.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRun}
                disabled={runAgent.isPending || !runInput.trim()}
              >
                {runAgent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Execute
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execution History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution History</DialogTitle>
            <DialogDescription>
              Recent agent executions and their results
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {!recentRuns || recentRuns.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No execution history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRuns.map((run) => (
                  <Card key={run.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {agents?.find(a => a.id === run.agent_id)?.name || "Unknown Agent"}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          {run.latency_ms && (
                            <Badge variant="outline" className="text-xs">
                              {run.latency_ms}ms
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Input:</Label>
                        <p className="text-sm mt-1">{run.input}</p>
                      </div>
                      {run.output && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Output:</Label>
                          <div className="mt-1 text-sm prose prose-slate dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-table:text-xs prose-headings:mb-1 prose-headings:mt-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {run.output}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                      {run.error_message && (
                        <div>
                          <Label className="text-xs text-destructive">Error:</Label>
                          <p className="text-sm mt-1 text-destructive">{run.error_message}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone and will also delete all execution history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteAgent.isPending}>
              {deleteAgent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
