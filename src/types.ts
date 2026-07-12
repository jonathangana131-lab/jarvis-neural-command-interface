export type AssistantMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing' | 'learning';
export type TaskMode = 'quick' | 'standard' | 'deep';

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
  codexStatus?: CodexStatus;
  openAiApiKeyPresent: boolean;
  memoryCount: number;
  localModel?: LocalModelConfig;
  providerHealth?: ProviderHealth;
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

export type CodexStatus = {
  available: boolean;
  command: string;
  detail: string;
};

export type ProviderFailureKind = 'auth' | 'rate_limit' | 'offline' | 'model_missing' | 'timeout' | 'unknown';

export type ProviderHealth = {
  provider: LocalModelConfig['provider'];
  endpoint: string;
  model: string;
  available: boolean;
  failureKind: ProviderFailureKind | null;
  failureAction: string | null;
  detail: string;
  checkedAt: string;
};

export type VoiceSettings = {
  voiceEnabled: boolean;
  spokenResponses: boolean;
  selectedVoiceName: string;
  voiceProfile: 'system' | 'jarvis';
  voiceSampleName: string;
  voiceSampleSize: number;
  voiceSampleUpdatedAt: string;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  orbSpeechReactive: boolean;
  orbSpeechIntensity: number;
  autoSendAfterFinalTranscript: boolean;
  summaryMaxLength: number;
};

export type SessionRecoveryState = {
  startedAt: string;
  pid: number;
  previousCrashed: boolean;
  previousCrashAcknowledged: boolean;
  previous: {
    active: boolean;
    cleanExit: boolean;
    startedAt: string | null;
    endedAt: string | null;
    reason: string | null;
    pid: number | null;
  } | null;
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

export type ChatSessionRecord = {
  id: string;
  title: string;
  workspace: string;
  archived?: boolean;
  pinned?: boolean;
  clearedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  lastTaskAt?: string | null;
  lastPrompt?: string | null;
  lastStatus?: TaskRecord['status'] | null;
};

export type TaskRecord = {
  id: string;
  chatId?: string | null;
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
  failureKind?: ProviderFailureKind | null;
  failureAction?: string | null;
  providerUsed?: LocalModelConfig['provider'] | string | null;
  taskMode?: TaskMode | string | null;
  timing?: TaskTiming;
};

export type TaskTiming = {
  queuedAt?: string;
  providerCheckStartedAt?: string;
  providerCheckFinishedAt?: string;
  startedAt?: string;
  firstOutputAt?: string;
  finishedAt?: string;
};

export type MemorySkippedRecord = {
  reason: string;
  content: string;
  confidence: number;
};

export type WorkspaceIntelligence = {
  status: 'ready' | 'missing';
  generatedAt: string;
  workspace: string;
  identity: { name: string; kind: string; description: string };
  score: number;
  metrics: {
    files: number;
    directories: number;
    totalBytes: number;
    sourceFiles: number;
    testFiles: number;
    todoCount: number;
    dirtyFiles: number;
  };
  languages: Array<{ name: string; files: number; percent: number; color: string }>;
  stack: Array<{ name: string; kind: string; confidence: string; source: string }>;
  scripts: Array<{ name: string; command: string; source: string }>;
  git: {
    available: boolean;
    branch: string | null;
    dirty: boolean;
    changed: number;
    staged: number;
    untracked: number;
    ahead: number;
    behind: number;
    lastCommit: { hash: string; subject: string; committedAt: string | null } | null;
  };
  recentFiles: Array<{ path: string; size: number; updatedAt: string; language: string | null }>;
  signals: Array<{ level: 'good' | 'watch' | 'risk'; title: string; detail: string }>;
  scan: {
    truncated: boolean;
    durationMs: number;
    filesInspected: number;
    contentFilesRead: number;
    excludedDirectories: string[];
  };
};

export type MissionBrief = {
  generatedAt: string;
  objective: string;
  intent: { kind: string; label: string; confidence: number };
  selectedMode: TaskMode;
  recommendedMode: TaskMode;
  modeProfile: { label: string; detail: string; phaseLimit: number };
  complexity: { score: number; level: 'low' | 'medium' | 'high'; reasons: string[] };
  phases: Array<{ id: string; title: string; detail: string; icon: string; index: number }>;
  guardrails: string[];
  workspaceSignals: Array<{ label: string; value: string; tone: 'info' | 'good' | 'watch' }>;
  estimatedScope: { scale: string; verification: string; projectFiles: number };
  readiness: number | null;
};
