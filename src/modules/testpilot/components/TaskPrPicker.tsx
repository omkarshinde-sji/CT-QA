import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTasksV2 } from "@/modules/actions/hooks/useTasksV2";

interface TaskPrPickerProps {
  taskId: string;
  prNumber: string;
  repoOverride: string;
  onTaskIdChange: (value: string) => void;
  onPrNumberChange: (value: string) => void;
  onRepoOverrideChange: (value: string) => void;
  disabled?: boolean;
}

export function TaskPrPicker({
  taskId,
  prNumber,
  repoOverride,
  onTaskIdChange,
  onPrNumberChange,
  onRepoOverrideChange,
  disabled,
}: TaskPrPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: tasks = [], isLoading } = useTasksV2({ search, view: "all" });

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === taskId),
    [tasks, taskId],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2 md:col-span-2">
        <Label>Task</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled || isLoading}
            >
              {selectedTask ? selectedTask.title : "Select a task..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search tasks..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No tasks found.</CommandEmpty>
                <CommandGroup>
                  {tasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={task.id}
                      onSelect={() => {
                        onTaskIdChange(task.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          taskId === task.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{task.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pr-number">PR Number</Label>
        <Input
          id="pr-number"
          type="number"
          min={1}
          placeholder="e.g. 42"
          value={prNumber}
          onChange={(e) => onPrNumberChange(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2 md:col-span-3">
        <Label htmlFor="repo-override">GitHub Repo (optional)</Label>
        <Input
          id="repo-override"
          placeholder="owner/repo — defaults to GITHUB_OWNER/GITHUB_REPO"
          value={repoOverride}
          onChange={(e) => onRepoOverrideChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
