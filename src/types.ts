export type AssistantMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing' | 'learning';

export type AppConfig = {
  assistantName: string;
  defaultWorkspace: string;
  workspaceAllowlist: string[];
  dataDir: string;
  memoryAutomatic: boolean;
  appVersion?: string;
  codexCommand: string;
  codexModel?: string;
  codexReasoningEffort?: string;
  codexEphemeral?: boolean;
  modelApiKeyPresent?: boolean;
  modelKey?: ModelKeyStatus;
  openAiApiKeyPresent: boolean;
  memoryCount: number;
  localModel?: LocalModelConfig;
};

export type ModelKeyStatus = {
  present: boolean;
  source: 'userData' | 'environment' | 'missing';
};

export type LocalModelConfig = {
  provider: 'opencode' | 'lmstudio' | 'ollama' | 'codex';
  endpoint: string;
  model: string;
};

export type MemoryRecord = {
  id: number;
  kind: string;
  title: string;
  content: string;
  importance: number;
  confidence?: number;
  source: string;
  scope?: 'project' | 'global';
  workspace?: string;
  pinned?: number;
  createdAt: string;
};

export type TaskRecord = {
  id: string;
  prompt: string;
  workspace: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timed_out' | 'cancelled';
  phase?: 'queued' | 'planning' | 'thinking' | 'streaming' | 'editing' | 'testing' | 'done';
  output: string;
  logs?: string;
  createdAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  rememberedMemoryIds?: number[];
  createdMemoryIds?: number[];
  memorySkipped?: MemorySkippedRecord[];
  filesChanged?: string[];
  commandsRun?: string[];
  testsRun?: string[];
};

export type MemorySkippedRecord = {
  reason: string;
  content: string;
  confidence: number;
};
