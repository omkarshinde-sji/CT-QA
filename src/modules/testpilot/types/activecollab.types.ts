export interface ActiveCollabTaskSummary {
  taskId: number;
  projectId: number;
  projectName: string;
  name: string;
  description: string;
  assigneeName: string | null;
  taskListName: string | null;
  taskUrl: string | null;
  isCompleted: boolean;
  updatedOn: string | null;
}

export interface ActiveCollabTaskComment {
  author: string;
  body: string;
  createdAt: string;
}

export interface ActiveCollabTaskDetails {
  task: ActiveCollabTaskSummary;
  comments: ActiveCollabTaskComment[];
}

export interface ListActiveCollabTasksResponse {
  success: boolean;
  tasks: ActiveCollabTaskSummary[];
}

export interface GetActiveCollabTaskDetailsResponse {
  success: boolean;
  task: ActiveCollabTaskSummary;
  comments: ActiveCollabTaskComment[];
}
