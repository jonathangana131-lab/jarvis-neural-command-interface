import './style.css';
import gsap from 'gsap';
import {
  Activity,
  Download,
  Brain,
  Cloud,
  Cpu,
  History,
  KeyRound,
  Mic,
  Network,
  OctagonX,
  Pause,
  Pin,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  Volume2,
  Zap,
  createIcons
} from 'lucide';
import { JarvisScene } from './JarvisScene';
import { MemoryAnimator } from './MemoryAnimator';
import { TaskHud } from './TaskHud';
import { VoiceSession } from './VoiceSession';
import type { AppConfig, AssistantMode, ChatSessionRecord, MemoryRecord, ModelKeyStatus, ProviderFailureKind, ProviderHealth, SessionRecoveryState, TaskRecord, VoiceSettings } from './types';

const jarvisIcons = {
  Activity,
  Download,
  Brain,
  Cloud,
  Cpu,
  History,
  KeyRound,
  Mic,
  Network,
  OctagonX,
  Pause,
  Pin,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  Volume2,
  Zap
};

const app = required<HTMLElement>('#app');
const canvas = required<HTMLCanvasElement>('#core');
const modeLabel = required<HTMLElement>('#mode');
const memoryCount = required<HTMLElement>('#memory-count');
const workspaceLabel = required<HTMLElement>('#workspace');
const voiceToggle = required<HTMLButtonElement>('#voice-toggle');
const thinkDemo = required<HTMLButtonElement>('#think-demo');
const voiceStatus = required<HTMLElement>('#voice-status');
const taskPrompt = required<HTMLTextAreaElement>('#task-prompt');
const taskWorkspace = required<HTMLInputElement>('#task-workspace');
const runTask = required<HTMLButtonElement>('#run-task');
const chatSidebarToggle = required<HTMLButtonElement>('#chat-sidebar-toggle');
const chatSidebarClose = required<HTMLButtonElement>('#chat-sidebar-close');
const chatSidebarScrim = required<HTMLElement>('#chat-sidebar-scrim');
const newChat = required<HTMLButtonElement>('#new-chat');
const chatSearch = required<HTMLInputElement>('#chat-search');
const chatSessionList = required<HTMLElement>('#chat-session-list');
const refreshDashboard = required<HTMLButtonElement>('#refresh-dashboard');
const dashboardGrid = required<HTMLElement>('#dashboard-grid');
const commandChatFeed = required<HTMLElement>('#command-chat-feed');
const missionObjective = required<HTMLElement>('#mission-objective');
const missionVitals = required<HTMLElement>('#mission-vitals');
const missionPhase = required<HTMLElement>('#mission-phase');
const missionProgressFill = required<HTMLElement>('#mission-progress-fill');
const missionNextAction = required<HTMLElement>('#mission-next-action');
const missionMemorySummary = required<HTMLElement>('#mission-memory-summary');
const missionMemoryContext = required<HTMLElement>('#mission-memory-context');
const missionArtifactSummary = required<HTMLElement>('#mission-artifact-summary');
const missionArtifacts = required<HTMLElement>('#mission-artifacts');
const apiKeyStatus = required<HTMLElement>('#api-key-status');
const pauseQueue = required<HTMLButtonElement>('#pause-queue');
const resumeQueue = required<HTMLButtonElement>('#resume-queue');
const queueStatus = required<HTMLElement>('#queue-status');
const updateBanner = required<HTMLElement>('#update-banner');
const updateBannerTitle = required<HTMLElement>('#update-banner-title');
const updateBannerDetail = required<HTMLElement>('#update-banner-detail');
const updateProgress = required<HTMLElement>('#update-progress');
const updateProgressFill = required<HTMLElement>('#update-progress-fill');
const updateBannerDownload = required<HTMLButtonElement>('#update-banner-download');
const updateBannerInstall = required<HTMLButtonElement>('#update-banner-install');
const updateBannerDetails = required<HTMLButtonElement>('#update-banner-details');
const setupWizard = required<HTMLElement>('#setup-wizard');
const setupProvider = required<HTMLSelectElement>('#setup-provider');
const setupEndpoint = required<HTMLInputElement>('#setup-endpoint');
const setupModel = required<HTMLSelectElement>('#setup-model');
const setupApiKey = required<HTMLInputElement>('#setup-api-key');
const setupStatus = required<HTMLElement>('#setup-status');
const setupScan = required<HTMLButtonElement>('#setup-scan');
const setupTest = required<HTMLButtonElement>('#setup-test');
const setupFinish = required<HTMLButtonElement>('#setup-finish');
const memoryList = required<HTMLElement>('#memory-list');
const refreshMemory = required<HTMLButtonElement>('#refresh-memory');
const resetMemory = required<HTMLButtonElement>('#reset-memory');
const rememberCurrent = required<HTMLButtonElement>('#remember-current');
const memorySearch = required<HTMLInputElement>('#memory-search');
const memorySortFilter = required<HTMLSelectElement>('#memory-sort-filter');
const memoryScopeFilter = required<HTMLSelectElement>('#memory-scope-filter');
const memoryKindFilter = required<HTMLSelectElement>('#memory-kind-filter');
const memoryGraphLegend = required<HTMLElement>('#memory-graph-legend');
const memoryReviewQueue = required<HTMLElement>('#memory-review-queue');
const memoryDetail = required<HTMLElement>('#memory-detail');
const refreshTasks = required<HTMLButtonElement>('#refresh-tasks');
const taskHistoryList = required<HTMLElement>('#task-history-list');
const taskHistoryDetail = required<HTMLElement>('#task-history-detail');
const commandReviewPanel = required<HTMLElement>('#command-review-panel');
const refreshArtifacts = required<HTMLButtonElement>('#refresh-artifacts');
const artifactCatalog = required<HTMLElement>('#artifact-catalog');
const settingsWorkspace = required<HTMLInputElement>('#settings-workspace');
const settingsDataDir = required<HTMLInputElement>('#settings-data-dir');
const settingsCodexCommand = required<HTMLInputElement>('#settings-codex-command');
const settingsReasoning = required<HTMLInputElement>('#settings-reasoning');
const settingsModelProvider = required<HTMLSelectElement>('#settings-model-provider');
const settingsModelEndpoint = required<HTMLInputElement>('#settings-model-endpoint');
const settingsLocalModel = required<HTMLSelectElement>('#settings-local-model');
const modelConnectionStatus = required<HTMLInputElement>('#model-connection-status');
const modelConnectInstructions = required<HTMLElement>('#model-connect-instructions');
const modelPresetGrid = required<HTMLElement>('#model-preset-grid');
const modelProfileSummary = required<HTMLElement>('#model-profile-summary');
const settingsModelApiKey = required<HTMLInputElement>('#settings-model-api-key');
const modelKeyStatus = required<HTMLElement>('#model-key-status');
const refreshLocalModels = required<HTMLButtonElement>('#refresh-local-models');
const saveModelKey = required<HTMLButtonElement>('#save-model-key');
const clearModelKey = required<HTMLButtonElement>('#clear-model-key');
const modelKeyMessage = required<HTMLElement>('#model-key-message');
const settingsVoiceName = required<HTMLSelectElement>('#settings-voice-name');
const settingsVoiceSummaryLength = required<HTMLInputElement>('#settings-voice-summary-length');
const settingsVoiceEnabled = required<HTMLInputElement>('#settings-voice-enabled');
const settingsSpokenResponses = required<HTMLInputElement>('#settings-spoken-responses');
const settingsVoiceAutoSend = required<HTMLInputElement>('#settings-voice-auto-send');
const saveVoiceSettings = required<HTMLButtonElement>('#save-voice-settings');
const testVoiceSummary = required<HTMLButtonElement>('#test-voice-summary');
const voiceSettingsMessage = required<HTMLElement>('#voice-settings-message');
const applyModel = required<HTMLButtonElement>('#apply-model');
const refreshDiagnostics = required<HTMLButtonElement>('#refresh-diagnostics');
const diagnosticsList = required<HTMLElement>('#diagnostics-list');
const releaseAssistant = required<HTMLElement>('#release-assistant');
const workspaceSwitcher = required<HTMLSelectElement>('#workspace-switcher');
const saveWorkspace = required<HTMLButtonElement>('#save-workspace');
const taskHud = new TaskHud(required<HTMLElement>('#task-hud'), cancelTask, renderIcons);
const scene = new JarvisScene(canvas, {
  onRendererStatus: (status) => {
    voiceStatus.textContent = status;
  }
});
const memoryAnimator = new MemoryAnimator(scene);
const voiceSession = new VoiceSession({
  onMode: setMode,
  onStatus: (status) => {
    voiceStatus.textContent = status;
  },
  onAudioLevel: (level) => scene.setAudioLevel(level),
  onTranscript: (text) => {
    appendPromptText(text);
    scheduleVoiceAutoSend(text);
    void rememberText(text, 'voice');
  }
});

let config: AppConfig | null = null;
let modeResetTimer = 0;
const animatedMemoryIds = new Set<number>();
let visibleMemories: MemoryRecord[] = [];
let visibleTasks: TaskRecord[] = [];
let visibleChats: ChatSessionRecord[] = [];
let selectedMemoryId: number | null = null;
let selectedTaskId: string | null = null;
let selectedChatId: string | null = safeStorageGet('jarvis.chat.selectedId') || null;
let reviewingHistoricalTask = false;
let currentTab = 'run';
let lastCommandPrompt = '';
let lastCommandOutput = '';
let lastCommandPhase = 'ready';
let streamTaskId: string | null = null;
let streamVisibleOutput = '';
let streamElement: HTMLElement | null = null;
let streamScrollContainer: HTMLElement | null = null;
let streamingActive = false;
let pendingStreamUpdate: { id: string; output: string; phase: TaskRecord['phase'] } | null = null;
let streamUpdateFrame = 0;
let updateActionBusy = false;
let lastUpdateCheck: UpdateCheck | null = null;
let lastStreamChromeRenderAt = 0;
let lastStreamPulseAt = 0;
let currentRunningTask: TaskRecord | null = null;
let lastMissionSignature = '';
let missionRenderFrame = 0;
let lastMissionRenderAt = 0;
let missionQueueLabel = 'Queue ready';
let taskDispatchInFlight = false;
const lastMemoryRecall = new Map<number, { mode: string; prompt: string; at: string }>();
let voiceSettings: VoiceSettings = {
  voiceEnabled: true,
  spokenResponses: false,
  selectedVoiceName: '',
  autoSendAfterFinalTranscript: true,
  summaryMaxLength: 180
};
let voiceSubmitTimer = 0;
let eventsReconnectTimer = 0;
let eventsReconnectAttempts = 0;
let eventsConnected = false;
const queuedWatchTimers = new Map<string, number>();
let savedWorkspaces: string[] = loadSavedWorkspaces();

window.addEventListener('error', (event) => {
  reportClientIssue(event.error ?? event.message, 'Unexpected UI error');
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientIssue(event.reason, 'Unexpected async UI error');
});

type ModelProvider = NonNullable<AppConfig['localModel']>['provider'];
type ArtifactCatalogItem = {
  task: TaskRecord;
  type: string;
  name: string;
  files: string[];
};

type LocalModelScanResult = {
  provider: ModelProvider;
  endpoint: string;
  available: boolean;
  models: string[];
  failureKind?: ProviderFailureKind | null;
  failureAction?: string | null;
  detail: string;
};

type HealthReport = {
  app: { version: string; dataDir: string; logPath: string };
  backend: { available: boolean; startedAt: string; port: number };
  session: SessionRecoveryState;
  modelKey: ModelKeyStatus;
  localModel: LocalModelScanResult;
  providerHealth: ProviderHealth;
  memory: {
    databasePath: string;
    exists: boolean;
    count: number;
    embeddings: { disabled: boolean; dim: number; lastError: string | null };
  };
  codex: { available: boolean; detail: string };
  queue: { paused: boolean; runningTaskId: string | null };
};

type UpdateCheck = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  url: string | null;
  downloadUrl: string | null;
  assetName: string | null;
  assetSize: number | null;
  digest: string | null;
  downloaded: { ready: boolean; path: string | null; sha256: string | null; size: number } | null;
  name: string | null;
  publishedAt: string | null;
  error?: string;
};

type UpdateStatus = {
  status: 'idle' | 'downloading' | 'ready' | 'failed';
  version: string | null;
  fileName: string | null;
  installerPath: string | null;
  receivedBytes: number;
  totalBytes: number;
  sha256: string | null;
  expectedSha256: string | null;
  backupPath: string | null;
  backupFiles: string[];
  error: string | null;
  updatedAt: string;
};

type BackupRecord = {
  id: string;
  path: string;
  reason: string;
  createdAt: string;
  files: string[];
  restartRequiredForMemoryRestore: boolean;
};

type StorageFile = {
  name: string;
  path: string;
  size: number;
  updatedAt: string;
};

type StorageReport = {
  dataDir: string;
  totalSize: number;
  updates: { path: string; size: number; files: StorageFile[] };
  backups: { path: string; size: number; count: number; items: Array<BackupRecord & { size: number }> };
  logs: { path: string; size: number; currentLogSize: number; bundleSize: number; bundles: StorageFile[] };
  memory: { path: string; size: number; files: StorageFile[] };
};

type WorkspaceSummary = {
  current: string;
  items: Array<{ path: string; label: string; allowed: boolean; exists: boolean; current: boolean }>;
};

type DashboardReport = {
  version: string;
  workspace: string;
  chats: ChatSessionRecord[];
  tasks: TaskRecord[];
  memory: { count: number; embeddings: { ready?: boolean; disabled?: boolean; lastError?: string | null } };
  queue: { paused: boolean; runningTaskId: string | null };
  update: {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    assetName: string | null;
    assetSize: number | null;
    error: string | null;
  };
  storage: { totalSize: number; updatesSize: number; backupsSize: number; logsSize: number; dataDir: string };
  workspaces: WorkspaceSummary;
};

type ReleaseStatus = {
  version: string;
  tag: string;
  releaseDir: string;
  ready: boolean;
  assets: Array<{ name: string; path: string; exists: boolean; size: number; sha256: string | null }>;
  latest: { currentVersion: string; latestVersion: string; updateAvailable: boolean; error: string | null };
};

type PreparedUpdateInstall = {
  ready: boolean;
  version: string | null;
  installerPath: string;
  fileName: string;
  sha256: string;
  expectedSha256: string | null;
  size: number;
  message: string;
};

declare global {
  interface Window {
    jarvisDesktop?: {
      platform: string;
      installUpdate(payload: { installerPath: string; sha256: string; expectedSha256?: string | null; version?: string | null }): Promise<{ scheduled: boolean; message: string }>;
    };
  }
}

const codexModelPresets = [
  { id: 'gpt-5.5', name: 'GPT-5.5', note: 'Latest model', icon: 'sparkles' },
  { id: 'o3-mini', name: 'O3 Mini', note: 'Fast reasoning', icon: 'zap' },
  { id: 'gpt-4o', name: 'GPT-4o', note: 'Full vision', icon: 'brain' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', note: 'Fast & cheap', icon: 'cloud' },
  { id: 'o1-mini', name: 'O1 Mini', note: 'Reasoning', icon: 'cpu' }
];

const opencodeZenModelPresets = [
  { id: 'minimax-m2.5-free', name: 'MiniMax M2.5 Free', note: 'OpenCode hosted', icon: 'zap' },
  { id: 'big-pickle', name: 'Big Pickle', note: 'Free stealth model', icon: 'sparkles' },
  { id: 'ling-2.6-flash', name: 'Ling 2.6 Flash', note: 'Fast routing', icon: 'cloud' }
];

scene.start();
scene.setMemoryPickHandler((memoryId) => selectMemory(memoryId));
renderIcons();
animateBoot();
void boot().catch((error) => renderBootFailure(error));

voiceToggle.addEventListener('click', async () => {
  try {
    voiceToggle.disabled = true;
    if (voiceSession.connected) {
      await voiceSession.stop();
      voiceToggle.textContent = 'Start Dictation';
      return;
    }
    if (!voiceSettings.voiceEnabled) {
      voiceStatus.textContent = 'Voice input is disabled in Settings.';
      setTab('settings');
      return;
    }
    voiceToggle.textContent = 'Starting...';
    await voiceSession.start();
    voiceToggle.textContent = 'Stop Dictation';
  } catch (error) {
    voiceStatus.textContent = error instanceof Error ? error.message : 'Voice failed';
    voiceToggle.textContent = 'Start Dictation';
    setMode('idle');
  } finally {
    voiceToggle.disabled = false;
  }
});

thinkDemo.addEventListener('click', () => {
  setMode('thinking');
  window.clearTimeout(modeResetTimer);
  modeResetTimer = window.setTimeout(() => setMode('idle'), 2400);
});

document.querySelectorAll<HTMLButtonElement>('[data-console-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    setTab(button.dataset.consoleTab ?? 'run');
  });
});

runTask.addEventListener('click', () => {
  void dispatchTask();
});

chatSidebarToggle.addEventListener('click', () => {
  setChatSidebarOpen(app.dataset.chatSidebar !== 'open');
});

chatSidebarClose.addEventListener('click', () => {
  setChatSidebarOpen(false);
});

chatSidebarScrim.addEventListener('click', () => {
  setChatSidebarOpen(false);
});

newChat.addEventListener('click', () => {
  void startNewChat();
});

chatSearch.addEventListener('input', () => {
  renderChatSessions();
});

refreshDashboard.addEventListener('click', () => {
  void loadDashboard();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && app.dataset.chatSidebar === 'open') {
    setChatSidebarOpen(false);
  }
});

taskPrompt.addEventListener('keydown', (event) => {
  if (
    event.key === 'Enter'
    && !event.shiftKey
    && !event.ctrlKey
    && !event.altKey
    && !event.metaKey
    && !event.isComposing
  ) {
    event.preventDefault();
    void dispatchTask();
  }
});

taskPrompt.addEventListener('focus', () => {
  syncTaskPromptHeight();
});

async function dispatchTask() {
  if (taskDispatchInFlight) {
    return;
  }
  const prompt = taskPrompt.value.trim();
  if (!prompt) {
    taskPrompt.focus();
    return;
  }
  window.clearTimeout(voiceSubmitTimer);
  taskDispatchInFlight = true;
  runTask.disabled = true;
  reviewingHistoricalTask = false;
  lastCommandPrompt = prompt;
  lastCommandOutput = '';
  lastCommandPhase = 'queued';
  setMode('executing');
  scene.setResponseActive(true);
  scene.pulseResponse(1.25);
  scene.pulseMemoryGrowth(0.5);

  try {
    const chat = await ensureSelectedChat(prompt);
    taskHud.upsert({
      id: `dispatch-${Date.now()}`,
      chatId: chat.id,
      prompt,
      workspace: taskWorkspace.value,
      status: 'queued',
      phase: 'queued',
      output: '',
      createdAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null
    });
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, workspace: taskWorkspace.value, chatId: chat.id })
    });
    const data = (await response.json()) as { task?: TaskRecord; error?: string };
    if (!response.ok || !data.task) {
      voiceStatus.textContent = data.error ?? 'Codex task failed to start';
      lastCommandPhase = 'dispatch failed';
      lastCommandOutput = data.error ?? 'Codex task failed to start';
      renderCommandChat(true);
      scene.setResponseActive(false);
      setMode('idle');
      return;
    }
    taskPrompt.value = '';
    syncTaskPromptHeight();
    taskPrompt.focus();
    taskHud.upsert(data.task);
    upsertVisibleTask(data.task, true);
    await loadChats();
    scene.pulseResponse(0.9);
    renderCommandChat(true);
    renderIcons();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Codex task failed to start';
    voiceStatus.textContent = message;
    lastCommandPhase = 'dispatch failed';
    lastCommandOutput = message;
    renderCommandChat(true);
    scene.setResponseActive(false);
    setMode('idle');
  } finally {
    taskDispatchInFlight = false;
    runTask.disabled = false;
  }
}

refreshMemory.addEventListener('click', () => {
  void loadMemories(true);
});

memorySearch.addEventListener('input', () => {
  void loadMemories(false);
});

memorySortFilter.addEventListener('change', () => {
  void loadMemories(false);
});

taskPrompt.addEventListener('input', () => {
  syncTaskPromptHeight();
  // Update prompt preview without full re-render to prevent shaking
  const draftPrompt = taskPrompt.value.trim();
  if (draftPrompt && lastCommandPhase === 'ready') {
    const objectiveEl = missionObjective;
    if (objectiveEl && objectiveEl.textContent !== draftPrompt) {
      objectiveEl.textContent = draftPrompt;
    }
  }
});

memoryScopeFilter.addEventListener('change', () => {
  void loadMemories(true);
});

function syncTaskPromptHeight() {
  taskPrompt.style.height = 'auto';
  const maxHeight = window.matchMedia('(min-width: 901px)').matches ? 126 : 154;
  taskPrompt.style.height = `${Math.min(Math.max(taskPrompt.scrollHeight, 50), maxHeight)}px`;
}

memoryKindFilter.addEventListener('change', () => {
  void loadMemories(false);
});

rememberCurrent.addEventListener('click', async () => {
  const content = taskPrompt.value.trim() || selectedTask()?.output.trim() || '';
  if (!content) {
    taskPrompt.focus();
    return;
  }
  await postJson<{ memory?: MemoryRecord; count: number }>('/api/memories', {
    kind: 'fact',
    title: content.slice(0, 72),
    content,
    importance: 4,
    confidence: 1,
    source: 'assistant',
    scope: 'project',
    workspace: taskWorkspace.value
  });
  await loadMemories(true);
});

refreshTasks.addEventListener('click', () => {
  void loadTasks();
});

refreshArtifacts.addEventListener('click', () => {
  void loadTasks();
});

workspaceSwitcher.addEventListener('change', () => {
  if (!workspaceSwitcher.value) {
    return;
  }
  applyWorkspace(workspaceSwitcher.value);
});

saveWorkspace.addEventListener('click', () => {
  addSavedWorkspace(taskWorkspace.value);
  renderWorkspaceSwitcher();
  voiceStatus.textContent = 'Workspace saved.';
});

pauseQueue.addEventListener('click', async () => {
  const data = await postJson<{ queue: { paused: boolean; runningTaskId: string | null } }>('/api/queue/pause', {});
  renderQueueStatus(data.queue);
});

resumeQueue.addEventListener('click', async () => {
  const data = await postJson<{ queue: { paused: boolean; runningTaskId: string | null } }>('/api/queue/resume', {});
  renderQueueStatus(data.queue);
});

refreshDiagnostics.addEventListener('click', () => {
  void loadDiagnostics();
});

updateBannerDetails.addEventListener('click', () => {
  setTab('diagnostics');
});

updateBannerDownload.addEventListener('click', () => {
  void downloadUpdateWithProgress();
});

updateBannerInstall.addEventListener('click', () => {
  void installDownloadedUpdate();
});

settingsModelProvider.addEventListener('change', () => {
  settingsModelEndpoint.value = defaultLocalEndpoint(settingsModelProvider.value);
  settingsLocalModel.innerHTML = providerDefaultModel(localProvider())
    ? `<option value="${providerDefaultModel(localProvider())}">${modelDisplayName(providerDefaultModel(localProvider()))}</option>`
    : '<option value="">Scan to load models</option>';
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
  void scanLocalModels(true);
});

settingsModelEndpoint.addEventListener('change', () => {
  renderModelProfile();
  renderModelInstructions();
  void scanLocalModels(false);
});

settingsLocalModel.addEventListener('change', () => {
  void saveLocalModelSelection();
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
});

refreshLocalModels.addEventListener('click', () => {
  void scanLocalModels(true);
});

saveModelKey.addEventListener('click', () => {
  void saveOpencodeKey();
});

clearModelKey.addEventListener('click', () => {
  void clearOpencodeKey();
});

saveVoiceSettings.addEventListener('click', () => {
  void persistVoiceSettingsFromForm();
});

testVoiceSummary.addEventListener('click', () => {
  if (!voiceSettings.spokenResponses) {
    voiceSettingsMessage.textContent = 'Turn on Spoken summaries, then test voice.';
    return;
  }
  voiceSession.speakSummary('Voice summaries are enabled. I will keep spoken updates short while long code and logs stay on screen.');
});

settingsVoiceName.addEventListener('change', () => {
  void persistVoiceSettingsFromForm();
});

applyModel.addEventListener('click', () => {
  void applySelectedModel();
});

settingsWorkspace.addEventListener('change', () => {
  taskWorkspace.value = settingsWorkspace.value;
});

setupProvider.addEventListener('change', () => {
  setupEndpoint.value = defaultLocalEndpoint(setupProvider.value);
  setupModel.innerHTML = providerDefaultModel(setupProviderValue())
    ? `<option value="${providerDefaultModel(setupProviderValue())}">${modelDisplayName(providerDefaultModel(setupProviderValue()))}</option>`
    : '<option value="">Scan to load models</option>';
  setupStatus.textContent = setupProviderHealthMessage(setupProviderValue());
});

setupScan.addEventListener('click', () => {
  void runSetupScan();
});

setupTest.addEventListener('click', () => {
  void runSetupTest();
});

setupFinish.addEventListener('click', () => {
  completeSetupWizard();
});

resetMemory.addEventListener('click', async () => {
  if (!window.confirm('Reset all visible neural memories?')) {
    return;
  }
  await postJson<{ deleted: number; count: number }>('/api/memories/reset', {});
  animatedMemoryIds.clear();
  selectedMemoryId = null;
  scene.setSelectedMemory(null);
  await loadMemories(true);
});

async function boot() {
  const [loadedConfig, loadedVoiceSettings, session] = await Promise.all([
    fetchJson<AppConfig>('/api/config'),
    fetchJson<VoiceSettings>('/api/voice-settings'),
    fetchJson<SessionRecoveryState>('/api/session')
  ]);
  config = loadedConfig;
  applyVoiceSettings(loadedVoiceSettings);
  setTab('run');
  hydrateSettingsFromConfig();
  hydrateVoiceSettingsForm();
  memoryCount.textContent = formatMemoryCount(config.memoryCount);
  apiKeyStatus.textContent = config.openAiApiKeyPresent ? 'API key ready' : 'Local login';
  hydrateSetupWizard();
  renderWorkspaceSwitcher();
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
  void scanLocalModels(false);
  void refreshCodexStatus();
  void refreshUpdateBanner();
  await loadMemories(true);
  void loadSemanticEdges();
  await loadChats();
  await loadTasks();
  void loadDashboard();
  try {
    await loadDiagnostics();
  } catch (error) {
    voiceStatus.textContent = error instanceof Error ? error.message : 'Diagnostics unavailable';
  }
  renderCommandChat();
  connectEvents();
  renderSessionRecoveryNotice(session);
}

function hydrateSettingsFromConfig() {
  if (!config) {
    return;
  }
  workspaceLabel.textContent = compactPath(config.defaultWorkspace);
  taskWorkspace.value = config.defaultWorkspace;
  addSavedWorkspace(config.defaultWorkspace, false);
  settingsWorkspace.value = config.defaultWorkspace;
  settingsDataDir.value = config.dataDir;
  settingsCodexCommand.value = config.codexCommand;
  settingsReasoning.value = `${config.codexReasoningEffort ?? 'low'}${config.codexEphemeral ? ' / ephemeral' : ''}`;
  settingsModelProvider.value = config.localModel?.provider ?? 'opencode';
  settingsModelEndpoint.value = config.localModel?.endpoint ?? defaultLocalEndpoint(settingsModelProvider.value);
  if (config.localModel?.model) {
    settingsLocalModel.innerHTML = `<option value="${escapeHtml(config.localModel.model)}">${escapeHtml(config.localModel.model)}</option>`;
    settingsLocalModel.value = config.localModel.model;
  }
  const providerDisplay = settingsModelProvider.value === 'codex' ? 'Codex CLI'
    : settingsModelProvider.value === 'opencode' ? 'OpenCode Zen'
      : settingsModelProvider.value === 'ollama' ? 'Ollama'
        : settingsModelProvider.value === 'lmstudio' ? 'LM Studio' : 'Unknown';
  const modelDisplay = config.localModel?.model ?? config.codexModel ?? '';
  voiceStatus.textContent = `${providerDisplay} / ${modelDisplay}`;
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
}

function applyVoiceSettings(settings: VoiceSettings) {
  voiceSettings = {
    voiceEnabled: settings.voiceEnabled !== false,
    spokenResponses: settings.spokenResponses === true,
    selectedVoiceName: settings.selectedVoiceName ?? '',
    autoSendAfterFinalTranscript: settings.autoSendAfterFinalTranscript !== false,
    summaryMaxLength: Math.max(80, Math.min(420, Number(settings.summaryMaxLength ?? 180)))
  };
  voiceSession.configure(voiceSettings);
  voiceToggle.disabled = !voiceSettings.voiceEnabled;
  voiceToggle.querySelector('span')!.textContent = voiceSettings.voiceEnabled ? 'Start Dictation' : 'Voice Disabled';
}

function hydrateVoiceSettingsForm() {
  refreshVoiceList();
  settingsVoiceEnabled.checked = voiceSettings.voiceEnabled;
  settingsSpokenResponses.checked = voiceSettings.spokenResponses;
  settingsVoiceAutoSend.checked = voiceSettings.autoSendAfterFinalTranscript;
  settingsVoiceSummaryLength.value = String(voiceSettings.summaryMaxLength);
  settingsVoiceName.value = voiceSettings.selectedVoiceName;
  voiceSettingsMessage.textContent = voiceCapabilityLabel();
}

function refreshVoiceList() {
  const voices = voiceSession.availableVoices();
  const current = settingsVoiceName.value || voiceSettings.selectedVoiceName;
  settingsVoiceName.innerHTML = '<option value="">Best available voice</option>'
    + voices.map((voice) => `<option value="${escapeHtml(voice.name)}">${escapeHtml(`${voice.name} / ${voice.lang}`)}</option>`).join('');
  settingsVoiceName.value = voices.some((voice) => voice.name === current) ? current : '';
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoiceList();
  };
}

async function persistVoiceSettingsFromForm() {
  const next: VoiceSettings = {
    voiceEnabled: settingsVoiceEnabled.checked,
    spokenResponses: settingsSpokenResponses.checked,
    selectedVoiceName: settingsVoiceName.value,
    autoSendAfterFinalTranscript: settingsVoiceAutoSend.checked,
    summaryMaxLength: Math.max(80, Math.min(420, Number(settingsVoiceSummaryLength.value || 180)))
  };
  voiceSettingsMessage.textContent = 'Saving voice settings...';
  const saved = await postJson<VoiceSettings>('/api/voice-settings', next);
  applyVoiceSettings(saved);
  hydrateVoiceSettingsForm();
  voiceSettingsMessage.textContent = 'Voice settings saved locally.';
}

function renderSessionRecoveryNotice(session: SessionRecoveryState) {
  if (!session.previousCrashed) {
    return;
  }
  const previousStart = session.previous?.startedAt ? formatDateTime(session.previous.startedAt) : 'the previous run';
  voiceStatus.textContent = `Recovered after an unclean shutdown from ${previousStart}.`;
  commandChatFeed.innerHTML = `
    <article class="mission-event mission-event--response mission-event--failed">
      <div class="conversation-header">
        <span>Recovery</span>
        <strong>Previous session did not close cleanly</strong>
      </div>
      <div class="conversation-stream">
        <section class="conversation-message conversation-message--assistant">
          <div class="conversation-message__meta"><span>Jarvis</span><em>Recovery ready</em></div>
          <p>The last app session ended without a clean shutdown. Memories and settings are still stored in the app profile. Open Diagnostics to export logs or use recovery controls.</p>
          <div class="task-actions">
            <button type="button" data-session-open-diagnostics data-icon="activity"><span>Open Diagnostics</span></button>
            <button type="button" data-session-ack-crash data-icon="octagon-x"><span>Dismiss</span></button>
          </div>
        </section>
      </div>
    </article>
  `;
  commandChatFeed.querySelector<HTMLButtonElement>('[data-session-open-diagnostics]')?.addEventListener('click', () => setTab('diagnostics'));
  commandChatFeed.querySelector<HTMLButtonElement>('[data-session-ack-crash]')?.addEventListener('click', (event) => {
    void acknowledgeSessionRecovery(event.currentTarget as HTMLButtonElement);
  });
  renderIcons();
}

async function acknowledgeSessionRecovery(button?: HTMLButtonElement) {
  if (button?.disabled) {
    return;
  }
  if (button) {
    button.disabled = true;
  }
  try {
    await postJson<SessionRecoveryState>('/api/session/acknowledge-crash', {});
    voiceStatus.textContent = 'Recovery notice dismissed.';
    commandChatFeed.innerHTML = '';
    lastCommandPhase = selectedTaskId ? lastCommandPhase : 'ready';
    lastMissionSignature = '';
    renderCommandChat(true);
    if (currentTab === 'diagnostics') {
      await loadDiagnostics();
    }
  } catch (error) {
    voiceStatus.textContent = error instanceof Error ? error.message : 'Unable to dismiss recovery notice.';
    if (button) {
      button.disabled = false;
    }
  } finally {
    renderIcons();
  }
}

function renderBootFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to load the local Jarvis service.';
  voiceStatus.textContent = message;
  modeLabel.textContent = 'Startup issue';
  apiKeyStatus.textContent = 'Service offline';
  queueStatus.textContent = 'Unavailable';
  missionObjective.textContent = 'Local service unavailable';
  missionPhase.textContent = 'Startup issue';
  missionNextAction.textContent = 'Restart the app, then open Diagnostics if the problem continues.';
  commandChatFeed.innerHTML = `
    <article class="mission-entry mission-entry--system">
      <span>Startup</span>
      <strong>Jarvis could not connect to its local service.</strong>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  setTab('run');
  renderIcons();
}

// Debounced fetcher for the semantic-edge endpoint. The backend emits
// memory.edges.updated whenever the embedding graph changes; this is the
// listener that turns those notifications into visible orb structure.
let edgeFetchTimer: number | null = null;
let edgeFetchInFlight = false;

async function loadSemanticEdges() {
  if (edgeFetchInFlight) return;
  edgeFetchInFlight = true;
  try {
    const data = await fetchJson<{
      edges?: Array<{ from: number; to: number; weight: number }>;
      threshold?: number;
      totalCandidates?: number;
    }>('/api/memory/edges?limit=600');
    memoryAnimator.applySemanticEdges(data.edges ?? []);
  } catch (error) {
    console.warn('[orb] failed to load semantic edges', error);
  } finally {
    edgeFetchInFlight = false;
  }
}

function scheduleSemanticEdgeRefresh(delay = 500) {
  if (edgeFetchTimer !== null) {
    window.clearTimeout(edgeFetchTimer);
  }
  edgeFetchTimer = window.setTimeout(() => {
    edgeFetchTimer = null;
    void loadSemanticEdges();
  }, delay);
}

function connectEvents() {
  if (eventsConnected) {
    return;
  }
  eventsConnected = true;
  const events = new EventSource('/api/events');
  events.onopen = () => {
    eventsReconnectAttempts = 0;
    voiceStatus.textContent = 'Live event stream connected.';
  };
  events.onerror = () => {
    events.close();
    eventsConnected = false;
    const waitMs = Math.min(12000, 1000 * 2 ** eventsReconnectAttempts);
    eventsReconnectAttempts += 1;
    voiceStatus.textContent = `Live updates disconnected. Reconnecting in ${Math.round(waitMs / 1000)}s.`;
    window.clearTimeout(eventsReconnectTimer);
    eventsReconnectTimer = window.setTimeout(() => {
      void refreshQueueStatus();
      void loadTasks();
      connectEvents();
    }, waitMs);
  };
  events.addEventListener('memory.created', (event) => {
    const memory = parseEventData<MemoryRecord>(event, 'memory.created');
    if (!memory) return;
    scene.pulseMemoryGrowth(1.25);
    lastCommandPhase = 'memory encoded';
    animateMemory(memory);
    void loadMemories(false);
    renderCommandChat();
  });
  events.addEventListener('memory.updated', () => {
    scene.pulseMemoryGrowth(0.65);
    void loadMemories(true);
  });
  events.addEventListener('memory.deleted', () => {
    void loadMemories(true);
  });
  events.addEventListener('memory.reset', () => {
    animatedMemoryIds.clear();
    selectedMemoryId = null;
    scene.setSelectedMemory(null);
    memoryAnimator.applySemanticEdges([]);
    void loadMemories(true);
    scheduleSemanticEdgeRefresh(900);
  });
  events.addEventListener('memory.recalled', (event) => {
    const payload = parseEventData<{
      ids?: number[];
      mode?: 'semantic' | 'keyword' | 'manual';
      prompt?: string;
    }>(event, 'memory.recalled');
    if (!payload) return;
    const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => Number.isFinite(id)) : [];
    if (ids.length === 0) return;
    const at = new Date().toISOString();
    ids.forEach((id) => lastMemoryRecall.set(id, {
      mode: payload.mode ?? 'semantic',
      prompt: payload.prompt ?? '',
      at
    }));
    memoryAnimator.recall(ids, payload.mode ?? 'semantic');
    renderMemories(visibleMemories);
    renderMemoryDetail();
  });
  events.addEventListener('memory.edges.updated', () => {
    scheduleSemanticEdgeRefresh(350);
  });
  events.addEventListener('task.started', (event) => {
    const task = parseEventData<TaskRecord>(event, 'task.started');
    if (!task) return;
    setMode(modeForTaskPhase(task.phase ?? 'planning'));
    scene.setTaskPhase(task.phase ?? 'planning');
    scene.setResponseActive(true);
    scene.pulseResponse(1.1);
    lastCommandPrompt = task.prompt;
    lastCommandPhase = task.phase ?? task.status;
    lastCommandOutput = '';
    resetStreamOutput(task.id);
    currentRunningTask = task;
    selectedTaskId = task.id;
    selectedChatId = task.chatId ?? selectedChatId;
    persistSelectedChat();
    reviewingHistoricalTask = false;
    clearTaskWatch(task.id);
    renderCommandChat(true);
    taskHud.upsert(task);
    renderIcons();
    renderChatSessions();
    void refreshQueueStatus();
  });
  events.addEventListener('task.queued', (event) => {
    const task = parseEventData<TaskRecord>(event, 'task.queued');
    if (!task) return;
    setMode(modeForTaskPhase(task.phase ?? 'queued'));
    scene.setTaskPhase(task.phase ?? 'queued');
    scene.setResponseActive(true);
    scene.pulseResponse(0.72);
    lastCommandPrompt = task.prompt;
    lastCommandPhase = task.phase ?? task.status;
    currentRunningTask = task;
    selectedTaskId = task.id;
    selectedChatId = task.chatId ?? selectedChatId;
    persistSelectedChat();
    reviewingHistoricalTask = false;
    scheduleQueuedTaskWatch(task);
    renderCommandChat(true);
    renderChatSessions();
    void refreshQueueStatus();
  });
  events.addEventListener('task.output', (event) => {
    const data = parseEventData<{ id: string; output: string; phase?: TaskRecord['phase'] }>(event, 'task.output');
    if (!data) return;
    taskHud.appendOutput(data.id, data.output, data.phase);
    const phase = data.phase ?? 'streaming';
    setMode(modeForTaskPhase(phase));
    scene.setTaskPhase(phase);
    scene.setResponseActive(true);
    pulseLiveStream();
    if (currentRunningTask && currentRunningTask.id === data.id) {
      currentRunningTask = { ...currentRunningTask, output: data.output, phase: data.phase ?? currentRunningTask.phase };
    }
    const isSelectedStream = selectedTaskId === data.id;
    if (isSelectedStream) {
      lastCommandPhase = phase;
      scheduleStreamOutput(data.id, data.output, phase);
    }
    visibleTasks = visibleTasks.map((task) => task.id === data.id
      ? { ...task, output: isSelectedStream ? streamVisibleOutput : data.output, phase: data.phase ?? task.phase }
      : task);
    scheduleStreamChromeRender();
  });
  events.addEventListener('task.updated', (event) => {
    const task = parseEventData<TaskRecord>(event, 'task.updated');
    if (!task) return;
    const wasSelected = selectedTaskId === task.id;
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(task.status)) {
      clearTaskWatch(task.id);
    }
    upsertVisibleTask(task, wasSelected);
    if (wasSelected) {
      lastCommandPhase = task.phase ?? task.status;
      lastCommandOutput = task.output;
      renderCommandChat(true);
    }
  });
  events.addEventListener('task.finished', (event) => {
    const task = parseEventData<TaskRecord>(event, 'task.finished');
    if (!task) return;
    const wasSelected = selectedTaskId === task.id;
    clearTaskWatch(task.id);
    currentRunningTask = null;
    taskHud.upsert(task);
    completeStreamOutput(task.id, task.output);
    scene.setTaskPhase(task.phase ?? task.status);
    scene.pulseResponse(task.status === 'completed' ? 1.35 : 0.72);
    scene.pulseMemoryGrowth(task.status === 'completed' ? 0.82 + (task.createdMemoryIds?.length ?? 0) * 0.28 : 0.18);
    if (wasSelected) {
      lastCommandPrompt = task.prompt;
      lastCommandPhase = task.phase ?? task.status;
      lastCommandOutput = task.output;
      renderCommandChat();
    }
    renderIcons();
    upsertVisibleTask(task, wasSelected);
    if (/requires a newer version of Codex/i.test(task.output)) {
      voiceStatus.textContent = 'Codex CLI update required for gpt-5.5';
    } else if (isRateLimitOutput(task.output)) {
      voiceStatus.textContent = 'OpenCode rate limit hit. Retry later or switch provider/model in Settings.';
    } else if (task.status === 'completed') {
      voiceStatus.textContent = 'Task finished.';
    } else {
      voiceStatus.textContent = `Task ${task.status}.`;
    }
    void loadMemories(false);
    void loadChats();
    void loadTasks();
    void refreshQueueStatus();
    setMode(task.status === 'completed' ? 'learning' : 'idle');
    window.clearTimeout(modeResetTimer);
    modeResetTimer = window.setTimeout(() => {
      scene.setResponseActive(false);
      setMode('idle');
    }, 2600);
  });
  events.addEventListener('queue.changed', (event) => {
    const queue = parseEventData<{ paused: boolean; runningTaskId: string | null }>(event, 'queue.changed');
    if (queue) {
      renderQueueStatus(queue);
    }
  });
}

function parseEventData<T>(event: Event, label: string): T | null {
  try {
    return JSON.parse((event as MessageEvent).data) as T;
  } catch (error) {
    console.warn(`[events] malformed ${label} payload`, error);
    voiceStatus.textContent = `Live update skipped: malformed ${label} event.`;
    return null;
  }
}

async function refreshCodexStatus() {
  try {
    const status = await fetchJson<{ command: string; available: boolean; detail: string }>('/api/codex/status');
    if (!status.available) {
      voiceStatus.textContent = `${status.command} unavailable`;
      return;
    }
    const model = config?.codexModel ? ` / ${config.codexModel}` : '';
    voiceStatus.textContent = `${status.detail}${model}`;
  } catch {
    // Keep the config-based status if the optional command preflight fails.
  }
}

async function loadMemories(hydrate: boolean) {
  const params = new URLSearchParams();
  if (memorySearch.value.trim()) {
    params.set('q', memorySearch.value.trim());
  }
  if (memoryScopeFilter.value) {
    params.set('scope', memoryScopeFilter.value);
  }
  if (taskWorkspace.value.trim()) {
    params.set('workspace', taskWorkspace.value.trim());
  }
  const data = await fetchJson<{ memories: MemoryRecord[]; count: number }>(`/api/memories?${params.toString()}`);
  const kind = memoryKindFilter.value;
  const unique = uniqueMemories(data.memories)
    .filter(isRealMemory)
    .filter((memory) => !kind || memory.kind === kind);
  unique.sort((a, b) => compareMemoriesForView(a, b, unique));
  visibleMemories = unique;
  if (selectedMemoryId !== null && !visibleMemories.some((memory) => memory.id === selectedMemoryId)) {
    selectedMemoryId = null;
    scene.setSelectedMemory(null);
  }
  memoryCount.textContent = formatMemoryCount(unique.length);
  renderMemories(unique);
  renderMemoryDetail();
  renderMemoryGraphLegend();
  renderMemoryReviewQueue();
  renderTaskHistory();
  renderCommandChat();
  if (hydrate) {
    memoryAnimator.hydrate(unique);
  }
}

async function loadTasks() {
  const data = await fetchJson<{ tasks: TaskRecord[] }>('/api/tasks');
  visibleTasks = data.tasks;
  if (selectedTaskId !== null && !visibleTasks.some((task) => task.id === selectedTaskId)) {
    selectedTaskId = null;
    reviewingHistoricalTask = false;
  }
  if (selectedChatId && !visibleChats.some((chat) => chat.id === selectedChatId)) {
    selectedChatId = visibleTasks.find((task) => task.id === selectedTaskId)?.chatId ?? visibleChats[0]?.id ?? null;
    persistSelectedChat();
  }
  if (!selectedChatId && visibleChats.length > 0) {
    selectedChatId = visibleChats[0].id;
    persistSelectedChat();
  }
  if (selectedChatId && !reviewingHistoricalTask) {
    const selectedTaskChatId = visibleTasks.find((task) => task.id === selectedTaskId)?.chatId ?? null;
    if (selectedTaskChatId !== selectedChatId) {
      selectedTaskId = visibleTasks
        .filter((task) => task.chatId === selectedChatId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null;
    }
  }
  renderTaskHistory();
  renderArtifactCatalog();
  renderChatSessions();
  renderCommandChat();
}

function compareMemoriesForView(a: MemoryRecord, b: MemoryRecord, source: MemoryRecord[] = visibleMemories) {
  switch (memorySortFilter.value) {
    case 'importance':
      return (b.importance ?? 0) - (a.importance ?? 0) || b.createdAt.localeCompare(a.createdAt);
    case 'confidence':
      return (b.confidence ?? 0) - (a.confidence ?? 0) || b.createdAt.localeCompare(a.createdAt);
    case 'duplicates':
      return duplicateMemoriesFor(b, source).length - duplicateMemoriesFor(a, source).length || b.createdAt.localeCompare(a.createdAt);
    default:
      return b.createdAt.localeCompare(a.createdAt);
  }
}

function renderMemoryGraphLegend() {
  const counts = visibleMemories.reduce<Record<string, number>>((acc, memory) => {
    acc[memory.kind] = (acc[memory.kind] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `<span><i data-kind="${escapeHtml(kind)}"></i>${escapeHtml(kind)} ${count}</span>`)
    .join('');
  memoryGraphLegend.innerHTML = `
    <div><strong>Graph Legend</strong><p>Nodes sit on the outer shell. Pulses mean recalled context. Brighter rings are pinned or selected memories.</p></div>
    <div class="memory-legend-items">${rows || '<span>No visible memory types</span>'}</div>
  `;
}

function renderMemoryReviewQueue() {
  const duplicateIds = new Set<number>();
  visibleMemories.forEach((memory) => duplicateMemoriesFor(memory).forEach((duplicate) => duplicateIds.add(duplicate.id)));
  const candidates = visibleMemories
    .filter((memory) => duplicateIds.has(memory.id) || (memory.confidence ?? 1) < 0.72 || memory.importance <= 2)
    .slice(0, 5);
  if (candidates.length === 0) {
    memoryReviewQueue.innerHTML = `
      <div class="memory-review-empty">
        <strong>Review Queue Clear</strong>
        <span>No duplicate or low-confidence memories in the current filter.</span>
      </div>
    `;
    return;
  }
  memoryReviewQueue.innerHTML = `
    <div class="memory-review-head">
      <strong>Memory Review Queue</strong>
      <span>${candidates.length} item${candidates.length === 1 ? '' : 's'} need attention</span>
    </div>
    <div class="memory-review-list">
      ${candidates.map((memory) => `
        <article>
          <div>
            <strong>${escapeHtml(memory.title)}</strong>
            <span>${escapeHtml(reviewReason(memory))}</span>
          </div>
          <button class="hud-button" type="button" data-memory-review="${memory.id}" data-icon="network"><span>Review</span></button>
        </article>
      `).join('')}
    </div>
  `;
  memoryReviewQueue.querySelectorAll<HTMLButtonElement>('[data-memory-review]').forEach((button) => {
    button.addEventListener('click', () => {
      const memoryId = Number(button.dataset.memoryReview);
      if (Number.isFinite(memoryId)) {
        selectMemory(memoryId);
      }
    });
  });
  renderIcons();
}

function reviewReason(memory: MemoryRecord) {
  const duplicates = duplicateMemoriesFor(memory).length;
  if (duplicates > 0) return `${duplicates} likely duplicate${duplicates === 1 ? '' : 's'}`;
  if ((memory.confidence ?? 1) < 0.72) return `Low confidence ${Math.round((memory.confidence ?? 0) * 100)}%`;
  return `Low importance ${memory.importance}`;
}

async function loadChats() {
  const data = await fetchJson<{ chats: ChatSessionRecord[] }>('/api/chats');
  visibleChats = data.chats;
  if (selectedChatId && !visibleChats.some((chat) => chat.id === selectedChatId)) {
    selectedChatId = visibleChats[0]?.id ?? null;
    persistSelectedChat();
  }
  if (!selectedChatId && visibleChats.length > 0) {
    selectedChatId = visibleChats[0].id;
    persistSelectedChat();
  }
  renderChatSessions();
  renderWorkspaceSwitcher();
}

async function ensureSelectedChat(prompt = '') {
  const existing = selectedChatId ? visibleChats.find((chat) => chat.id === selectedChatId) : null;
  if (existing && !existing.archived) {
    return existing;
  }
  const created = await postJson<{ chat: ChatSessionRecord }>('/api/chats', {
    title: compactSessionTitle(prompt || 'New Chat'),
    workspace: taskWorkspace.value
  });
  upsertVisibleChat(created.chat, true);
  return created.chat;
}

function upsertVisibleChat(chat: ChatSessionRecord, select: boolean) {
  visibleChats = [chat, ...visibleChats.filter((entry) => entry.id !== chat.id)]
    .filter((entry) => !entry.archived)
    .sort(compareChats)
    .slice(0, 80);
  if (select) {
    selectedChatId = chat.id;
    persistSelectedChat();
  }
  renderChatSessions();
}

async function loadDashboard() {
  try {
    const data = await fetchJson<DashboardReport>('/api/dashboard');
    renderDashboard(data);
    renderWorkspaceSwitcher(data.workspaces);
  } catch (error) {
    dashboardGrid.innerHTML = `<div class="empty-state">Dashboard unavailable: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</div>`;
  }
}

function renderDashboard(data: DashboardReport) {
  const activeTask = data.tasks.find((task) => task.status === 'running' || task.status === 'queued');
  const recentTasks = data.tasks.slice(0, 5).map((task) => `
    <button class="dashboard-list-row" type="button" data-dashboard-task="${escapeHtml(task.id)}">
      <strong>${escapeHtml(compactSessionTitle(task.prompt))}</strong>
      <span>${escapeHtml(task.status)} / ${escapeHtml(formatTime(task.createdAt))}</span>
    </button>
  `).join('') || '<p class="dashboard-empty">No tasks yet.</p>';
  const recentChats = data.chats.slice(0, 5).map((chat) => `
    <button class="dashboard-list-row" type="button" data-dashboard-chat="${escapeHtml(chat.id)}">
      <strong>${chat.pinned ? 'Pinned / ' : ''}${escapeHtml(compactSessionTitle(chat.title))}</strong>
      <span>${chat.taskCount ?? 0} tasks / ${escapeHtml(formatTime(chat.lastTaskAt ?? chat.updatedAt))}</span>
    </button>
  `).join('') || '<p class="dashboard-empty">No chats yet.</p>';
  dashboardGrid.innerHTML = `
    <article class="dashboard-card dashboard-card--wide">
      <span class="micro-label">Readiness</span>
      <strong>${escapeHtml(activeTask ? 'Task active' : 'Ready for work')}</strong>
      <p>${escapeHtml(activeTask ? compactSessionTitle(activeTask.prompt) : `${data.memory.count} memories indexed. ${data.queue.paused ? 'Queue paused.' : 'Queue ready.'}`)}</p>
      <div class="dashboard-actions">
        <button class="hud-button hud-button--primary" type="button" data-dashboard-run data-icon="terminal-square"><span>Run Mission</span></button>
        <button class="hud-button" type="button" data-dashboard-release data-icon="rocket"><span>Release Assistant</span></button>
      </div>
    </article>
    <article class="dashboard-card"><span class="micro-label">Version</span><strong>${escapeHtml(data.version)}</strong><p>${escapeHtml(data.update.updateAvailable ? `Update ${data.update.latestVersion} available` : data.update.error ? `Update check failed: ${data.update.error}` : 'Current release installed')}</p></article>
    <article class="dashboard-card"><span class="micro-label">Storage</span><strong>${escapeHtml(formatBytes(data.storage.totalSize))}</strong><p>${escapeHtml(`Updates ${formatBytes(data.storage.updatesSize)} / backups ${formatBytes(data.storage.backupsSize)} / logs ${formatBytes(data.storage.logsSize)}`)}</p></article>
    <article class="dashboard-card"><span class="micro-label">Workspace</span><strong>${escapeHtml(compactPath(data.workspace))}</strong><p>${escapeHtml(`${data.workspaces.items.length} saved or discovered workspace${data.workspaces.items.length === 1 ? '' : 's'}`)}</p></article>
    <article class="dashboard-card dashboard-card--wide"><span class="micro-label">Recent Chats</span><div class="dashboard-list">${recentChats}</div></article>
    <article class="dashboard-card dashboard-card--wide"><span class="micro-label">Recent Tasks</span><div class="dashboard-list">${recentTasks}</div></article>
  `;
  dashboardGrid.querySelector<HTMLButtonElement>('[data-dashboard-run]')?.addEventListener('click', () => setTab('run'));
  dashboardGrid.querySelector<HTMLButtonElement>('[data-dashboard-release]')?.addEventListener('click', () => {
    setTab('diagnostics');
    void loadReleaseAssistant();
  });
  dashboardGrid.querySelectorAll<HTMLButtonElement>('[data-dashboard-chat]').forEach((button) => {
    button.addEventListener('click', () => {
      const chatId = button.dataset.dashboardChat;
      if (chatId) {
        selectChat(chatId);
        setTab('run');
      }
    });
  });
  dashboardGrid.querySelectorAll<HTMLButtonElement>('[data-dashboard-task]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.dashboardTask;
      if (!taskId) return;
      selectedTaskId = taskId;
      selectedChatId = visibleTasks.find((task) => task.id === taskId)?.chatId ?? selectedChatId;
      persistSelectedChat();
      setTab('history');
      renderTaskHistory();
      renderCommandChat(true);
    });
  });
  renderIcons();
}

function compareChats(a: ChatSessionRecord, b: ChatSessionRecord) {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) {
    return a.pinned ? -1 : 1;
  }
  return (b.lastTaskAt ?? b.updatedAt).localeCompare(a.lastTaskAt ?? a.updatedAt);
}

function renderWorkspaceSwitcher(summary?: WorkspaceSummary) {
  const workspaces = new Set<string>([
    ...(summary?.items.map((item) => item.path) ?? []),
    ...(config?.workspaceAllowlist ?? []),
    config?.defaultWorkspace ?? '',
    ...savedWorkspaces,
    ...visibleChats.map((chat) => chat.workspace),
    ...visibleTasks.map((task) => task.workspace)
  ].filter(Boolean));
  const current = taskWorkspace.value || config?.defaultWorkspace || summary?.current || '';
  workspaceSwitcher.innerHTML = [...workspaces]
    .map((workspacePath) => `<option value="${escapeHtml(workspacePath)}">${escapeHtml(compactPath(workspacePath))}</option>`)
    .join('');
  if (current && !Array.from(workspaceSwitcher.options).some((option) => option.value === current)) {
    workspaceSwitcher.add(new Option(compactPath(current), current));
  }
  workspaceSwitcher.value = current;
}

function applyWorkspace(workspacePath: string) {
  taskWorkspace.value = workspacePath;
  settingsWorkspace.value = workspacePath;
  workspaceLabel.textContent = compactPath(workspacePath);
  addSavedWorkspace(workspacePath);
  void loadMemories(true);
  renderCommandChat(true);
}

function addSavedWorkspace(workspacePath: string, persist = true) {
  const clean = String(workspacePath ?? '').trim();
  if (!clean) return;
  savedWorkspaces = [clean, ...savedWorkspaces.filter((entry) => entry !== clean)].slice(0, 12);
  if (persist) {
    safeStorageSet('jarvis.workspaces', JSON.stringify(savedWorkspaces));
  }
}

function loadSavedWorkspaces() {
  try {
    const parsed = JSON.parse(safeStorageGet('jarvis.workspaces') ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function persistSelectedChat() {
  if (selectedChatId) {
    safeStorageSet('jarvis.chat.selectedId', selectedChatId);
  } else {
    safeStorageRemove('jarvis.chat.selectedId');
  }
}

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[storage] read failed for ${key}`, error);
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[storage] write failed for ${key}`, error);
    return false;
  }
}

function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[storage] remove failed for ${key}`, error);
  }
}

function reportClientIssue(reason: unknown, fallback: string) {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : fallback;
  console.warn('[ui]', reason);
  if (voiceStatus) {
    voiceStatus.textContent = `${fallback}: ${message}`;
  }
}

async function loadDiagnostics() {
  const [data, health, update, updateStatus, backups, logs, storage] = await Promise.all([
    fetchJson<{
      codex: { available: boolean; detail: string };
      localModel: { available: boolean; detail: string; provider: string; endpoint: string; models: string[] };
      providerHealth: ProviderHealth;
      modelKey: ModelKeyStatus;
      voice: { speechRecognition: string; microphone: string; detail: string; settings: VoiceSettings };
      session: SessionRecoveryState;
      config: AppConfig;
      sqlite: { databasePath: string; exists: boolean; memoryCount: number; taskCount: number };
      queue: { paused: boolean; runningTaskId: string | null };
    }>('/api/diagnostics'),
    fetchJson<HealthReport>('/api/health'),
    fetchJson<UpdateCheck>('/api/update-check'),
    fetchJson<UpdateStatus>('/api/update/status'),
    fetchJson<{ backups: BackupRecord[] }>('/api/backups'),
    fetchJson<{ path: string; tail: string }>('/api/logs'),
    fetchJson<StorageReport>('/api/storage')
  ]);
  lastUpdateCheck = update;
  renderUpdateBanner(update, updateStatus);
  const updateDetail = update.error
    ? `Update check failed: ${update.error}`
    : update.updateAvailable
      ? `Version ${update.latestVersion} is ready${update.assetSize ? ` (${formatBytes(update.assetSize)})` : ''}. ${update.digest ? 'Checksum verification available.' : 'Checksum verification unavailable.'}`
      : `Current version ${update.currentVersion} is up to date.`;
  const updateActions = renderUpdateActions(update, updateStatus);
  const embeddingDetail = health.memory.embeddings.disabled
    ? `Keyword fallback active${health.memory.embeddings.lastError ? `: ${health.memory.embeddings.lastError}` : '.'}`
    : `Semantic embeddings ready (${health.memory.embeddings.dim} dimensions).`;
  diagnosticsList.innerHTML = `
    <article><strong>App</strong><span>${escapeHtml(health.app.version)}</span><p>${escapeHtml(health.app.dataDir)}</p></article>
    <article><strong>Backend</strong><span>${health.backend.available ? 'Running' : 'Offline'}</span><p>${escapeHtml(`Started ${formatDateTime(health.backend.startedAt)} on port ${health.backend.port}`)}</p></article>
    <article><strong>Codex</strong><span>${data.codex.available ? 'Available' : 'Unavailable'}</span><p>${escapeHtml(data.codex.detail)}</p></article>
    <article><strong>Model</strong><span>${escapeHtml(data.config.codexModel ?? 'default')}</span><p>${escapeHtml([data.config.codexCommand, data.config.codexReasoningEffort, data.config.codexEphemeral ? 'ephemeral' : 'persistent'].filter(Boolean).join(' / '))}</p></article>
    <article><strong>OpenCode Key</strong><span>${data.modelKey.present ? 'Ready' : 'Missing'}</span><p>${escapeHtml(data.modelKey.present ? `Loaded from ${data.modelKey.source}.` : 'Save a key in Settings to scan hosted models.')}</p></article>
    <article><strong>Model Router</strong><span>${data.localModel.available ? 'Connected' : 'Offline'}</span><p>${escapeHtml(`${data.localModel.provider} / ${data.localModel.endpoint} / ${data.localModel.detail}`)}</p></article>
    <article class="diagnostics-grid__wide"><strong>Provider Health</strong><span>${escapeHtml(providerHealthStatus(data.providerHealth))}</span><p>${escapeHtml(providerHealthDetail(data.providerHealth))}</p>${renderProviderHealthActions(data.providerHealth)}</article>
    <article><strong>Embeddings</strong><span>${health.memory.embeddings.disabled ? 'Fallback' : 'Ready'}</span><p>${escapeHtml(embeddingDetail)}</p></article>
    <article><strong>Updates</strong><span>${updateStatus.status === 'downloading' ? 'Downloading' : update.updateAvailable ? 'Available' : update.error ? 'Check failed' : 'Current'}</span><p>${escapeHtml(updateDetail)}</p>${updateActions}</article>
    <article><strong>Voice</strong><span>${data.voice.settings.voiceEnabled ? 'Enabled' : 'Disabled'}</span><p>${escapeHtml(`${voiceCapabilityLabel()} Spoken summaries ${data.voice.settings.spokenResponses ? 'on' : 'off'}.`)}</p></article>
    <article><strong>SQLite</strong><span>${data.sqlite.exists ? 'Ready' : 'Missing'}</span><p>${escapeHtml(data.sqlite.databasePath)}</p></article>
    <article class="diagnostics-grid__wide"><strong>Fix Common Problems</strong><span>Guided repair</span><p>Use these when the app opens oddly, shortcuts disappear, storage fills up, or model settings are bad.</p>${renderFixCommonProblems(data, storage)}</article>
    <article class="diagnostics-grid__wide"><strong>Update Safety</strong><span>${updateStatus.status}</span><p>${escapeHtml(updateSafetySummary(update, updateStatus))}</p>${renderUpdateSafety(update, updateStatus)}</article>
    <article class="diagnostics-grid__wide"><strong>Storage</strong><span>${escapeHtml(formatBytes(storage.totalSize))}</span><p>${escapeHtml(storageSummary(storage))}</p>${renderStorageManager(storage)}</article>
    <article><strong>Queue</strong><span>${data.queue.paused ? 'Paused' : 'Active'}</span><p>${data.queue.runningTaskId ? `Running ${escapeHtml(data.queue.runningTaskId)}` : 'No active task'}</p></article>
    <article class="diagnostics-grid__wide"><strong>Session Recovery</strong><span>${data.session.previousCrashed ? 'Previous crash detected' : 'Clean'}</span><p>${escapeHtml(sessionRecoveryDetail(data.session))}</p>${renderSessionRecoveryActions(data.session)}</article>
    <article class="diagnostics-grid__wide"><strong>Recovery</strong><span>Safe controls</span><p>Reset bad model settings, repair missing shortcuts, clear saved model secrets, or export a log bundle for bug reports.</p>${renderRecoveryActions()}</article>
    <article class="diagnostics-grid__wide"><strong>Backups</strong><span>${backups.backups.length} saved</span><p>Backups include memory database files, saved provider settings, and local model secrets. Memory database restore requires a restart-safe manual recovery step.</p>${renderBackupManager(backups.backups)}</article>
    <article class="diagnostics-grid__wide"><strong>Local Logs</strong><span>${escapeHtml(logs.path)}</span><pre>${escapeHtml(logs.tail || 'No log output yet.')}</pre></article>
  `;
  wireUpdateActions(update, updateStatus);
  wireSessionRecoveryActions();
  wireRecoveryActions();
  wireProviderHealthActions();
  wireStorageActions();
  wireBackupActions();
  void loadReleaseAssistant();
  renderIcons();
  renderQueueStatus(data.queue);
}

function providerHealthStatus(health: ProviderHealth) {
  if (health.available) {
    return 'Ready';
  }
  return health.failureKind ? titleCase(health.failureKind.replace(/_/g, ' ')) : 'Needs attention';
}

function providerHealthDetail(health: ProviderHealth) {
  const detail = `${providerLabel(health.provider)} / ${health.model || 'default'}: ${health.detail}`;
  return health.available ? detail : `${detail} ${health.failureAction ?? ''}`.trim();
}

function renderProviderHealthActions(health: ProviderHealth) {
  return `
    <div class="update-actions">
      <button class="hud-button" type="button" data-provider-health-refresh data-icon="refresh-cw"><span>Refresh Health</span></button>
      <button class="hud-button" type="button" data-provider-health-settings data-icon="sliders-horizontal"><span>Open Settings</span></button>
      ${health.available ? '' : '<button class="hud-button" type="button" data-provider-health-codex data-icon="terminal-square"><span>Use Codex</span></button>'}
    </div>
  `;
}

function wireProviderHealthActions() {
  diagnosticsList.querySelector<HTMLButtonElement>('[data-provider-health-refresh]')?.addEventListener('click', async () => {
    const health = await fetchJson<ProviderHealth>('/api/provider-health?force=1');
    if (config) {
      config.providerHealth = health;
    }
    voiceStatus.textContent = providerHealthDetail(health);
    await loadDiagnostics();
  });
  diagnosticsList.querySelector<HTMLButtonElement>('[data-provider-health-settings]')?.addEventListener('click', () => {
    setTab('settings');
  });
  diagnosticsList.querySelector<HTMLButtonElement>('[data-provider-health-codex]')?.addEventListener('click', async () => {
    await switchSettingsToCodex();
    setTab('settings');
  });
}

function renderFixCommonProblems(
  data: { codex: { available: boolean }; modelKey: ModelKeyStatus; queue: { paused: boolean } },
  storage: StorageReport
) {
  const recommendations = [
    !data.codex.available ? 'Codex CLI is unavailable. Check Settings or reinstall the CLI.' : '',
    !data.modelKey.present ? 'OpenCode key is missing. Save a key in Settings or use Codex CLI mode.' : '',
    data.queue.paused ? 'Queue is paused. Resume it before starting new work.' : '',
    storage.updates.size > 100 * 1024 * 1024 ? 'Old installers are using storage. Clear installers after a successful update.' : '',
    storage.logs.size > 2 * 1024 * 1024 ? 'Logs are getting large. Trim logs or export a bundle before cleanup.' : ''
  ].filter(Boolean);
  return `
    <div class="fix-grid">
      ${(recommendations.length ? recommendations : ['No urgent repair recommendation.']).map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
    <div class="update-actions">
      <button class="hud-button" type="button" data-recovery-reset-model data-icon="rotate-ccw"><span>Reset Model</span></button>
      <button class="hud-button" type="button" data-recovery-repair-shortcuts data-icon="terminal-square"><span>Repair Shortcuts</span></button>
      <button class="hud-button" type="button" data-storage-cleanup="all" data-icon="trash-2"><span>Recommended Cleanup</span></button>
    </div>
  `;
}

function updateSafetySummary(update: UpdateCheck, status: UpdateStatus) {
  if (status.status === 'ready') {
    return `Installer ${status.fileName ?? ''} verified with SHA256 ${status.sha256 ?? 'unknown'}. Backup ${status.backupPath ?? 'pending'}.`;
  }
  if (status.status === 'downloading') {
    return `Downloading ${formatBytes(status.receivedBytes)} of ${formatBytes(status.totalBytes)}.`;
  }
  if (update.updateAvailable) {
    return `Latest ${update.latestVersion}, current ${update.currentVersion}. ${update.digest ? 'Release digest available.' : 'Release digest missing.'}`;
  }
  return update.error ? `Update check failed: ${update.error}` : `Current version ${update.currentVersion} is installed.`;
}

function renderUpdateSafety(update: UpdateCheck, status: UpdateStatus) {
  return `
    <div class="release-checklist">
      <span class="${update.error ? 'warn' : 'ok'}"><i></i><strong>Version Check</strong><em>${escapeHtml(update.error ?? `${update.currentVersion} -> ${update.latestVersion}`)}</em></span>
      <span class="${update.assetSize ? 'ok' : 'warn'}"><i></i><strong>Installer Size</strong><em>${escapeHtml(update.assetSize ? formatBytes(update.assetSize) : 'Not available')}</em></span>
      <span class="${update.digest || status.sha256 ? 'ok' : 'warn'}"><i></i><strong>Checksum</strong><em>${escapeHtml(status.sha256 ?? update.digest ?? 'Not available')}</em></span>
      <span class="${status.backupPath ? 'ok' : 'warn'}"><i></i><strong>Backup</strong><em>${escapeHtml(status.backupPath ?? 'Created during download')}</em></span>
    </div>
  `;
}

async function loadReleaseAssistant() {
  try {
    const status = await fetchJson<ReleaseStatus>('/api/release/status');
    renderReleaseAssistant(status);
  } catch (error) {
    releaseAssistant.innerHTML = `<div class="empty-state">Release assistant unavailable: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</div>`;
  }
}

function renderReleaseAssistant(status: ReleaseStatus) {
  const checks = [
    { label: 'Version set', ok: /^0\.7\./.test(status.version) || status.version !== '0.6.0', detail: `package.json ${status.version}` },
    { label: 'Installer asset', ok: assetReady(status, `.exe`), detail: assetLabel(status, `.exe`) },
    { label: 'Blockmap asset', ok: assetReady(status, `.blockmap`), detail: assetLabel(status, `.blockmap`) },
    { label: 'latest.yml', ok: assetReady(status, `latest.yml`), detail: assetLabel(status, `latest.yml`) },
    { label: 'GitHub latest check', ok: !status.latest.error, detail: status.latest.error ?? `Latest ${status.latest.latestVersion}` }
  ];
  releaseAssistant.innerHTML = `
    <article class="release-card">
      <div>
        <span class="micro-label">Release Assistant</span>
        <strong>${escapeHtml(status.tag)} ${status.ready ? 'assets ready' : 'assets pending'}</strong>
        <p>${escapeHtml(status.releaseDir)}</p>
      </div>
      <div class="release-checklist">
        ${checks.map((check) => `
          <span class="${check.ok ? 'ok' : 'warn'}"><i></i><strong>${escapeHtml(check.label)}</strong><em>${escapeHtml(check.detail)}</em></span>
        `).join('')}
      </div>
      <div class="update-actions">
        <button class="hud-button" type="button" data-release-copy data-icon="save"><span>Copy Asset Summary</span></button>
      </div>
    </article>
  `;
  releaseAssistant.querySelector<HTMLButtonElement>('[data-release-copy]')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(status.assets.map((asset) => `${asset.name} ${formatBytes(asset.size)} ${asset.sha256 ?? ''}`.trim()).join('\n'));
    voiceStatus.textContent = 'Release asset summary copied.';
  });
  renderIcons();
}

function assetReady(status: ReleaseStatus, suffix: string) {
  return status.assets.some((asset) => asset.name.endsWith(suffix) && asset.exists && asset.size > 0);
}

function assetLabel(status: ReleaseStatus, suffix: string) {
  const asset = status.assets.find((entry) => entry.name.endsWith(suffix));
  if (!asset) return 'Missing';
  return asset.exists ? `${formatBytes(asset.size)}${asset.sha256 ? ` / ${asset.sha256.slice(0, 12)}` : ''}` : 'Missing';
}

function renderUpdateActions(update: UpdateCheck, status?: UpdateStatus) {
  if (update.error) {
    return `
      <div class="update-actions">
        <button class="hud-button" type="button" data-update-download data-icon="download"><span>Retry download</span></button>
        <button class="hud-button" type="button" data-log-export data-icon="save"><span>Export Logs</span></button>
      </div>
    `;
  }
  if (!update.updateAvailable) {
    return update.url ? `<a href="${escapeHtml(update.url)}" target="_blank" rel="noreferrer">View releases</a>` : '';
  }
  const percent = updatePercent(status);
  const downloadLabel = update.downloaded?.ready ? 'Re-download verified installer' : 'Download update';
  const verifiedDetail = update.downloaded?.ready
    ? `<p class="diagnostics-grid__note">Verified installer saved locally: ${escapeHtml(formatBytes(update.downloaded.size))}</p>`
    : '';
  return `
    <div class="update-actions">
      <button class="hud-button" type="button" data-update-download data-icon="download" ${updateActionBusy || status?.status === 'downloading' ? 'disabled' : ''}><span>${status?.status === 'downloading' ? `Downloading ${percent}%` : downloadLabel}</span></button>
      ${(update.downloaded?.ready || status?.status === 'ready') ? `<button class="hud-button hud-button--primary" type="button" data-update-install data-icon="play" ${updateActionBusy ? 'disabled' : ''}><span>Install update</span></button>` : ''}
      ${update.downloadUrl ? `<a href="${escapeHtml(update.downloadUrl)}" target="_blank" rel="noreferrer">Manual download</a>` : ''}
    </div>
    ${status?.status === 'downloading' ? `<div class="update-progress update-progress--inline"><span style="width: ${percent}%"></span></div>` : ''}
    ${status?.status === 'failed' ? `<p class="diagnostics-grid__note">Download failed: ${escapeHtml(status.error ?? 'unknown error')}</p><div class="update-actions"><button class="hud-button" type="button" data-log-export data-icon="save"><span>Export Logs</span></button></div>` : ''}
    ${verifiedDetail}
  `;
}

function sessionRecoveryDetail(session: SessionRecoveryState) {
  if (!session.previousCrashed) {
    return `Current session started ${formatDateTime(session.startedAt)}. Previous session closed cleanly or has already been acknowledged.`;
  }
  const previousStart = session.previous?.startedAt ? formatDateTime(session.previous.startedAt) : 'unknown start time';
  return `The previous session from ${previousStart} ended without a clean shutdown. Export logs if the app froze or closed unexpectedly.`;
}

function renderSessionRecoveryActions(session: SessionRecoveryState) {
  if (!session.previousCrashed) {
    return '';
  }
  return `
    <div class="update-actions">
      <button class="hud-button hud-button--primary" type="button" data-log-export data-icon="save"><span>Export Logs</span></button>
      <button class="hud-button" type="button" data-session-ack-crash data-icon="octagon-x"><span>Dismiss Notice</span></button>
    </div>
  `;
}

function wireSessionRecoveryActions() {
  diagnosticsList.querySelector<HTMLButtonElement>('[data-session-ack-crash]')?.addEventListener('click', (event) => {
    void acknowledgeSessionRecovery(event.currentTarget as HTMLButtonElement);
  });
}

function wireUpdateActions(_update: UpdateCheck, _status?: UpdateStatus) {
  diagnosticsList.querySelector<HTMLButtonElement>('[data-update-download]')?.addEventListener('click', async () => {
    await downloadUpdateWithProgress();
  });
  diagnosticsList.querySelector<HTMLButtonElement>('[data-update-install]')?.addEventListener('click', async () => {
    await installDownloadedUpdate();
  });
}

async function refreshUpdateBanner() {
  try {
    const [update, status] = await Promise.all([
      fetchJson<UpdateCheck>('/api/update-check'),
      fetchJson<UpdateStatus>('/api/update/status')
    ]);
    lastUpdateCheck = update;
    renderUpdateBanner(update, status);
  } catch {
    updateBanner.classList.add('hidden');
  }
}

function renderUpdateBanner(update: UpdateCheck, status?: UpdateStatus) {
  const show = update.updateAvailable || status?.status === 'downloading' || status?.status === 'ready' || status?.status === 'failed';
  updateBanner.classList.toggle('hidden', !show);
  if (!show) {
    return;
  }
  const percent = updatePercent(status);
  updateBannerTitle.textContent = status?.status === 'ready'
    ? `Update ${status.version ?? update.latestVersion} verified`
    : status?.status === 'downloading'
      ? `Downloading ${status.version ?? update.latestVersion}`
      : status?.status === 'failed'
        ? 'Update download failed'
        : `Update ${update.latestVersion} available`;
  updateBannerDetail.textContent = status?.status === 'ready'
    ? `Installer verified. Backup saved at ${status.backupPath ?? 'the app profile'}.`
    : status?.status === 'downloading'
      ? `${formatBytes(status.receivedBytes)} / ${formatBytes(status.totalBytes)}`
      : status?.status === 'failed'
        ? status.error ?? 'Try the download again.'
        : `${update.assetName ?? 'Windows installer'}${update.assetSize ? ` / ${formatBytes(update.assetSize)}` : ''}`;
  updateProgress.classList.toggle('hidden', status?.status !== 'downloading');
  updateProgressFill.style.width = `${percent}%`;
  updateBannerDownload.disabled = updateActionBusy || status?.status === 'downloading';
  updateBannerDownload.querySelector('span')!.textContent = status?.status === 'downloading' ? `${percent}%` : status?.status === 'failed' ? 'Retry' : 'Download';
  updateBannerInstall.classList.toggle('hidden', status?.status !== 'ready' && !update.downloaded?.ready);
}

async function downloadUpdateWithProgress() {
  if (updateActionBusy) {
    return;
  }
  updateActionBusy = true;
  try {
    await postJson<UpdateStatus>('/api/update/download', {});
    const status = await pollUpdateDownload();
    if (status.status !== 'ready') {
      throw new Error(status.error ?? 'Update download did not finish.');
    }
    window.alert(`Update ${status.version} downloaded and verified.\n\nBackup: ${status.backupPath}\nSHA256: ${status.sha256}`);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to download update.');
  } finally {
    updateActionBusy = false;
    await loadDiagnostics();
  }
}

async function pollUpdateDownload() {
  let status = await fetchJson<UpdateStatus>('/api/update/status');
  const startedAt = Date.now();
  while (status.status === 'downloading' && Date.now() - startedAt < 10 * 60 * 1000) {
    if (lastUpdateCheck) {
      renderUpdateBanner(lastUpdateCheck, status);
    }
    await delay(500);
    status = await fetchJson<UpdateStatus>('/api/update/status');
  }
  if (lastUpdateCheck) {
    renderUpdateBanner(lastUpdateCheck, status);
  }
  return status;
}

async function installDownloadedUpdate() {
  if (updateActionBusy) {
    return;
  }
  if (!window.confirm('Install the verified update now? Jarvis will close, install after the app exits, then reopen. Your memories and settings stay in the app profile.')) {
    return;
  }
  updateActionBusy = true;
  try {
    const prepared = await postJson<PreparedUpdateInstall>('/api/update/prepare-install', {});
    if (!window.jarvisDesktop?.installUpdate) {
      window.alert(`Update verified, but this window is not running inside the desktop app.\n\nInstaller:\n${prepared.installerPath}`);
      return;
    }
    const result = await window.jarvisDesktop.installUpdate({
      installerPath: prepared.installerPath,
      sha256: prepared.sha256,
      expectedSha256: prepared.expectedSha256,
      version: prepared.version
    });
    window.alert(result.message);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to prepare update install.');
  } finally {
    updateActionBusy = false;
    await loadDiagnostics();
  }
}

function updatePercent(status?: UpdateStatus) {
  if (!status || status.totalBytes <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((status.receivedBytes / status.totalBytes) * 100)));
}

function renderRecoveryActions() {
  return `
    <div class="update-actions">
      <button class="hud-button" type="button" data-recovery-reset-model data-icon="rotate-ccw"><span>Reset Model</span></button>
      <button class="hud-button" type="button" data-recovery-repair-shortcuts data-icon="terminal-square"><span>Repair Shortcuts</span></button>
      <button class="hud-button" type="button" data-recovery-clear-secrets data-icon="trash-2"><span>Clear Secrets</span></button>
      <button class="hud-button" type="button" data-log-export data-icon="save"><span>Export Logs</span></button>
    </div>
  `;
}

function renderBackupManager(backups: BackupRecord[]) {
  const rows = backups.length === 0
    ? '<p class="diagnostics-grid__note">No backups yet.</p>'
    : backups.slice(0, 8).map((backup) => `
      <article class="backup-row">
        <div>
          <strong>${escapeHtml(formatDateTime(backup.createdAt))}</strong>
          <span>${escapeHtml(backup.reason)} / ${backup.files.length} files</span>
          <p>${escapeHtml(backup.path)}</p>
        </div>
        <button class="hud-button" type="button" data-backup-restore-settings="${escapeHtml(backup.id)}" data-icon="rotate-ccw"><span>Restore Settings</span></button>
      </article>
    `).join('');
  return `
    <div class="update-actions">
      <button class="hud-button hud-button--primary" type="button" data-backup-create data-icon="save"><span>Create Backup</span></button>
    </div>
    <div class="backup-list">${rows}</div>
  `;
}

function storageSummary(storage: StorageReport) {
  return [
    `Updates ${formatBytes(storage.updates.size)}`,
    `backups ${formatBytes(storage.backups.size)}`,
    `logs ${formatBytes(storage.logs.size)}`,
    `memory ${formatBytes(storage.memory.size)}`
  ].join(' / ');
}

function renderStorageManager(storage: StorageReport) {
  return `
    <div class="storage-meter-grid">
      ${renderStorageMeter('Updates', storage.updates.size, storage.totalSize, `${storage.updates.files.length} files`)}
      ${renderStorageMeter('Backups', storage.backups.size, storage.totalSize, `${storage.backups.count} saved`)}
      ${renderStorageMeter('Logs', storage.logs.size, storage.totalSize, `${storage.logs.bundles.length} bundles`)}
      ${renderStorageMeter('Memory DB', storage.memory.size, storage.totalSize, `${storage.memory.files.length} files`)}
    </div>
    <div class="update-actions">
      <button class="hud-button" type="button" data-storage-cleanup="updates" data-icon="trash-2"><span>Clear Installers</span></button>
      <button class="hud-button" type="button" data-storage-cleanup="logs" data-icon="trash-2"><span>Trim Logs</span></button>
      <button class="hud-button" type="button" data-storage-cleanup="backups" data-icon="trash-2"><span>Prune Backups</span></button>
    </div>
    <p class="diagnostics-grid__note">${escapeHtml(storage.dataDir)}</p>
  `;
}

function renderStorageMeter(label: string, size: number, total: number, detail: string) {
  const percent = total > 0 ? Math.min(100, Math.round((size / total) * 100)) : 0;
  return `
    <div class="storage-meter">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatBytes(size))}</strong>
      <div class="update-progress"><span style="width: ${percent}%"></span></div>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function wireRecoveryActions() {
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-recovery-reset-model]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Reset model provider, endpoint, and model to safe defaults?')) return;
      const result = await postJson<{ message: string; localModel: AppConfig['localModel'] }>('/api/recovery/reset-model', {});
      window.alert(result.message);
      config = await fetchJson<AppConfig>('/api/config');
      hydrateSettingsFromConfig();
      await loadDiagnostics();
    });
  });
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-recovery-clear-secrets]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Clear saved model secrets from this app profile?')) return;
      const result = await postJson<{ message: string; modelKey: ModelKeyStatus }>('/api/recovery/clear-secrets', {});
      window.alert(result.message);
      updateModelKeyStatus(result.modelKey);
      await loadDiagnostics();
    });
  });
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-recovery-repair-shortcuts]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await postJson<{ message: string; repaired: string[] }>('/api/recovery/repair-shortcuts', {});
      window.alert(result.repaired.length ? `${result.message}\n\n${result.repaired.join('\n')}` : result.message);
    });
  });
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-log-export]').forEach((button) => {
    button.addEventListener('click', async () => {
      const result = await fetchJson<{ path: string; size: number }>('/api/logs/export');
      window.alert(`Log bundle exported:\n${result.path}`);
    });
  });
}

function wireStorageActions() {
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-storage-cleanup]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = button.dataset.storageCleanup;
      if (!target) {
        return;
      }
      const label = button.textContent?.trim() || 'clean storage';
      if (!window.confirm(`${label}? Memories and settings will be left alone.`)) {
        return;
      }
      const result = await postJson<{ removedCount: number }>(`/api/storage/cleanup`, { target });
      voiceStatus.textContent = `Storage cleanup removed ${result.removedCount} item${result.removedCount === 1 ? '' : 's'}.`;
      await loadDiagnostics();
    });
  });
}

function wireBackupActions() {
  diagnosticsList.querySelector<HTMLButtonElement>('[data-backup-create]')?.addEventListener('click', async () => {
    const backup = await postJson<BackupRecord>('/api/backups/create', {});
    window.alert(`Backup created:\n${backup.path}`);
    await loadDiagnostics();
  });
  diagnosticsList.querySelectorAll<HTMLButtonElement>('[data-backup-restore-settings]').forEach((button) => {
    button.addEventListener('click', async () => {
      const backupId = button.dataset.backupRestoreSettings;
      if (!backupId || !window.confirm('Restore model settings and saved model secrets from this backup? Memory database restore is intentionally not hot-swapped while the app is running.')) {
        return;
      }
      const result = await postJson<{ restored: string[]; localModel: AppConfig['localModel']; modelKey: ModelKeyStatus }>(`/api/backups/${encodeURIComponent(backupId)}/restore-settings`, {});
      updateModelKeyStatus(result.modelKey);
      config = await fetchJson<AppConfig>('/api/config');
      window.alert(`Restored: ${result.restored.length ? result.restored.join(', ') : 'No settings files found in backup.'}`);
      hydrateSettingsFromConfig();
      await loadDiagnostics();
    });
  });
}

async function refreshQueueStatus() {
  const data = await fetchJson<{ queue: { paused: boolean; runningTaskId: string | null } }>('/api/queue');
  renderQueueStatus(data.queue);
}

async function scanLocalModels(showScanning: boolean, persistSelection = showScanning) {
  const provider = localProvider();
  const endpoint = settingsModelEndpoint.value.trim() || defaultLocalEndpoint(provider);
  settingsModelEndpoint.value = endpoint;
  if (showScanning) {
    modelConnectionStatus.value = provider === 'opencode' && !config?.modelKey?.present ? 'Missing key' : 'Scanning...';
  }
  const previous = settingsLocalModel.value || config?.localModel?.model || '';
  const params = new URLSearchParams({ provider, endpoint });
  let data: LocalModelScanResult;
  try {
    data = await fetchJson<LocalModelScanResult>(`/api/local-models?${params.toString()}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to scan models.';
    data = {
      provider,
      endpoint,
      available: false,
      models: provider === 'opencode' ? opencodeZenModelPresets.map((preset) => preset.id) : [],
      detail
    };
  }
  modelConnectionStatus.value = modelConnectionLabel(data.available, data.detail);
  if (data.models.length === 0) {
    settingsLocalModel.innerHTML = '<option value="">No models detected</option>';
  } else {
    settingsLocalModel.innerHTML = data.models
      .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(modelDisplayName(model))}</option>`)
      .join('');
    settingsLocalModel.value = data.models.includes(previous) ? previous : data.models[0];
  }
  if (persistSelection) {
    await saveLocalModelSelection();
  }
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
}

async function saveOpencodeKey() {
  const apiKey = settingsModelApiKey.value.trim();
  if (!apiKey) {
    modelKeyMessage.textContent = 'Paste a key before saving.';
    settingsModelApiKey.focus();
    return;
  }
  modelKeyMessage.textContent = 'Saving key...';
  const status = await postJson<ModelKeyStatus>('/api/model-key', { apiKey });
  settingsModelApiKey.value = '';
  updateModelKeyStatus(status);
  modelKeyMessage.textContent = 'Key saved locally for this app.';
  await scanLocalModels(true);
  await loadDiagnostics();
}

async function clearOpencodeKey() {
  if (!window.confirm('Clear the saved OpenCode key from this app?')) {
    return;
  }
  const response = await fetch('/api/model-key', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(await readError(response, 'Unable to clear OpenCode key'));
  }
  const status = await response.json() as ModelKeyStatus;
  updateModelKeyStatus(status);
  modelKeyMessage.textContent = 'Saved key cleared.';
  await scanLocalModels(true);
  await loadDiagnostics();
}

function updateModelKeyStatus(status: ModelKeyStatus) {
  if (config) {
    config.modelKey = status;
    config.modelApiKeyPresent = status.present;
  }
  renderModelProfile();
  renderModelInstructions();
}

async function saveLocalModelSelection() {
  const provider = localProvider();
  const endpoint = settingsModelEndpoint.value.trim() || defaultLocalEndpoint(provider);
  const model = settingsLocalModel.value;
  const data = await postJson<{ localModel: AppConfig['localModel'] }>('/api/local-model-selection', {
    provider,
    endpoint,
    model
  });
  if (config && data.localModel) {
    config.localModel = data.localModel;
  }
}

async function switchSettingsToCodex() {
  settingsModelProvider.value = 'codex';
  settingsModelEndpoint.value = '';
  settingsLocalModel.innerHTML = '<option value="gpt-5.5">GPT-5.5</option>';
  settingsLocalModel.value = 'gpt-5.5';
  await saveLocalModelSelection();
  config = await fetchJson<AppConfig>('/api/config');
  modelKeyMessage.textContent = 'Switched to Codex CLI fallback.';
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
}

async function applySelectedModel() {
  const model = settingsLocalModel.value || providerDefaultModel(localProvider());
  if (!model) {
    modelKeyMessage.textContent = 'No model selected.';
    return;
  }
  modelKeyMessage.textContent = 'Applying model...';
  await saveLocalModelSelection();
  modelKeyMessage.textContent = `Applied: ${modelDisplayName(model)}`;
  config = await fetchJson<AppConfig>('/api/config');
  const providerDisplay = settingsModelProvider.value === 'codex' ? 'Codex CLI' : 
                     settingsModelProvider.value === 'opencode' ? 'OpenCode Zen' : 
                     settingsModelProvider.value === 'ollama' ? 'Ollama' : 
                     settingsModelProvider.value === 'lmstudio' ? 'LM Studio' : 'Unknown';
  const modelDisplay = config.localModel?.model ?? config.codexModel ?? '';
  voiceStatus.textContent = `${providerDisplay} / ${modelDisplay}`;
  renderModelProfile();
  void loadDiagnostics();
}

function hydrateSetupWizard() {
  const provider = config?.localModel?.provider ?? 'opencode';
  setupProvider.value = provider;
  setupEndpoint.value = config?.localModel?.endpoint ?? defaultLocalEndpoint(provider);
  if (config?.localModel?.model) {
    setupModel.innerHTML = `<option value="${escapeHtml(config.localModel.model)}">${escapeHtml(modelDisplayName(config.localModel.model))}</option>`;
    setupModel.value = config.localModel.model;
  }
  const needsSetup = safeStorageGet('jarvis.setup.v1.complete') !== 'true'
    || (provider === 'opencode' && !config?.modelKey?.present && !config?.modelApiKeyPresent);
  setupWizard.classList.toggle('hidden', !needsSetup);
  setupStatus.textContent = needsSetup
    ? setupProviderHealthMessage(provider)
    : 'Setup complete.';
}

async function runSetupScan() {
  setupScan.disabled = true;
  setupStatus.textContent = `Scanning ${providerLabel(setupProviderValue())}...`;
  try {
    const provider = setupProviderValue();
    const apiKey = setupApiKey.value.trim();
    if (provider === 'opencode' && apiKey) {
      const status = await postJson<ModelKeyStatus>('/api/model-key', { apiKey });
      setupApiKey.value = '';
      updateModelKeyStatus(status);
    }
    const endpoint = setupEndpoint.value.trim() || defaultLocalEndpoint(provider);
    const scan = await fetchJson<LocalModelScanResult>(`/api/local-models?${new URLSearchParams({ provider, endpoint })}`);
    const models = scan.models.length > 0
      ? scan.models
      : provider === 'opencode' ? opencodeZenModelPresets.map((preset) => preset.id) : [];
    setupModel.innerHTML = models.length > 0
      ? models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(modelDisplayName(model))}</option>`).join('')
      : '<option value="">No models detected</option>';
    const selected = models.includes(config?.localModel?.model ?? '') ? config?.localModel?.model ?? '' : models[0] ?? '';
    setupModel.value = selected;
    await postJson<{ localModel: AppConfig['localModel'] }>('/api/local-model-selection', {
      provider,
      endpoint,
      model: selected
    });
    config = await fetchJson<AppConfig>('/api/config');
    settingsModelProvider.value = provider;
    settingsModelEndpoint.value = endpoint;
    settingsLocalModel.innerHTML = setupModel.innerHTML;
    settingsLocalModel.value = selected;
    setupStatus.textContent = scan.available
      ? `${providerLabel(provider)} connected. ${scan.detail} Send the setup test to finish.`
      : `${providerLabel(provider)} needs attention. ${modelConnectionLabel(false, scan.detail)}`;
    renderModelPresets();
    renderModelProfile();
    renderModelInstructions();
  } catch (error) {
    setupStatus.textContent = error instanceof Error ? error.message : 'Unable to scan models.';
  } finally {
    setupScan.disabled = false;
    renderIcons();
  }
}

async function runSetupTest() {
  setupTest.disabled = true;
  setupStatus.textContent = `Sending setup test through ${providerLabel(setupProviderValue())}...`;
  try {
    const provider = setupProviderValue();
    const endpoint = setupEndpoint.value.trim() || defaultLocalEndpoint(provider);
    const apiKey = setupApiKey.value.trim();
    if (provider === 'opencode' && apiKey) {
      const status = await postJson<ModelKeyStatus>('/api/model-key', { apiKey });
      setupApiKey.value = '';
      updateModelKeyStatus(status);
    }
    const model = setupModel.value || providerDefaultModel(provider);
    await postJson<{ localModel: AppConfig['localModel'] }>('/api/local-model-selection', {
      provider,
      endpoint,
      model
    });
    config = await fetchJson<AppConfig>('/api/config');
    const response = await postJson<{ task?: TaskRecord; error?: string }>('/api/tasks', {
      prompt: 'Reply with exactly: Jarvis setup test complete.',
      workspace: taskWorkspace.value
    });
    if (!response.task?.id) {
      throw new Error(response.error ?? 'Setup test did not start.');
    }
    const task = await waitForTaskTerminal(response.task.id, 45000);
    if (task.status !== 'completed') {
      throw new Error(`Setup test ended with status ${task.status}. ${task.failureAction ?? providerFailureAction(task.failureKind)}`);
    }
    lastCommandPrompt = task.prompt;
    lastCommandPhase = task.phase ?? task.status;
    lastCommandOutput = task.output;
    upsertVisibleTask(task, true);
    renderCommandChat(true);
    completeSetupWizard();
    setupStatus.textContent = 'Setup test complete. Jarvis is ready.';
  } catch (error) {
    setupStatus.textContent = error instanceof Error ? error.message : 'Setup test failed.';
    config = await fetchJson<AppConfig>('/api/config').catch(() => config);
    renderModelPresets();
  } finally {
    setupTest.disabled = false;
    renderIcons();
  }
}

function completeSetupWizard() {
  safeStorageSet('jarvis.setup.v1.complete', 'true');
  setupWizard.classList.add('hidden');
  setTab('run');
}

async function waitForTaskTerminal(taskId: string, timeoutMs: number) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await fetchJson<{ task: TaskRecord }>(`/api/tasks/${encodeURIComponent(taskId)}`);
    if (['completed', 'failed', 'timed_out', 'cancelled'].includes(data.task.status)) {
      return data.task;
    }
    await delay(250);
  }
  throw new Error('Setup test timed out.');
}

function setupProviderValue(): ModelProvider {
  if (setupProvider.value === 'ollama') return 'ollama';
  if (setupProvider.value === 'lmstudio') return 'lmstudio';
  if (setupProvider.value === 'codex') return 'codex';
  return 'opencode';
}

function setupProviderHealthMessage(provider: ModelProvider) {
  if (provider === 'opencode') {
    return 'OpenCode Zen uses the saved local key. Paste a key if needed, scan models, then send the setup test.';
  }
  if (provider === 'lmstudio') {
    return 'Start the LM Studio local server, scan models, then send the setup test.';
  }
  if (provider === 'ollama') {
    return 'Start Ollama, pull a chat model, scan models, then send the setup test.';
  }
  return 'Codex CLI uses your local Codex login and selected model. Send the setup test to confirm it works.';
}

function renderModelInstructions() {
  const provider = localProvider();
  const endpoint = settingsModelEndpoint.value.trim() || defaultLocalEndpoint(provider);
  const model = settingsLocalModel.value || 'selected model';
  renderModelProfile();
  if (provider === 'opencode') {
    modelConnectInstructions.innerHTML = `
      <strong>OpenCode Zen routing for ${escapeHtml(modelDisplayName(model))}</strong>
      <ol>
        <li>Jarvis scans <code>${escapeHtml(endpoint)}/models</code> with the local <code>OPENCODE_API_KEY</code>.</li>
        <li>The default model is <code>minimax-m2.5-free</code>; other free Zen lanes stay one click away.</li>
        <li>OpenCode uses <code>opencode/${escapeHtml(model)}</code> inside OpenCode configs; the raw API model id is shown here.</li>
        <li>The desktop app stores the key in its local profile; the key is never returned to the browser.</li>
      </ol>
    `;
    return;
  }
  const isOllama = provider === 'ollama';
  modelConnectInstructions.innerHTML = isOllama
    ? `
      <strong>Ollama connection for ${escapeHtml(model)}</strong>
      <ol>
        <li>Install Ollama and start it normally. The app scans <code>${escapeHtml(endpoint)}</code>.</li>
        <li>Download any model with <code>ollama pull model-name</code>, then press Scan Models.</li>
        <li>Select the model from the list. Every model returned by <code>/api/tags</code> appears here.</li>
        <li>Keep Ollama running while Jarvis Neural Command Interface is open.</li>
      </ol>
    `
    : `
      <strong>LM Studio connection for ${escapeHtml(model)}</strong>
      <ol>
        <li>Open LM Studio, download any chat or instruct model, then load it.</li>
        <li>Start the Local Server with the OpenAI-compatible endpoint enabled at <code>${escapeHtml(endpoint)}</code>.</li>
        <li>Press Scan Models. Every model returned by <code>/v1/models</code> appears here.</li>
        <li>Keep the LM Studio server running while Jarvis Neural Command Interface is open.</li>
      </ol>
    `;
}

function defaultLocalEndpoint(provider: string) {
  if (provider === 'ollama') {
    return 'http://127.0.0.1:11434';
  }
  if (provider === 'lmstudio') {
    return 'http://127.0.0.1:1234/v1';
  }
  if (provider === 'codex') {
    return '';
  }
  return 'https://opencode.ai/zen/v1';
}

function localProvider(): ModelProvider {
  if (settingsModelProvider.value === 'ollama') {
    return 'ollama';
  }
  if (settingsModelProvider.value === 'lmstudio') {
    return 'lmstudio';
  }
  if (settingsModelProvider.value === 'codex') {
    return 'codex';
  }
  return 'opencode';
}

function providerDefaultModel(provider: ModelProvider) {
  if (provider === 'codex') return 'gpt-5.5';
  if (provider === 'opencode') return 'minimax-m2.5-free';
  return '';
}

function renderModelPresets() {
  const provider = localProvider();
  if (provider === 'ollama' || provider === 'lmstudio') {
    modelPresetGrid.innerHTML = `
      <button type="button" class="model-preset-card selected" data-provider-preset="${provider}" data-icon="${provider === 'ollama' ? 'cpu' : 'terminal-square'}">
        <span>${escapeHtml(providerLabel(provider))}</span>
        <strong>${provider === 'ollama' ? 'Local daemon' : 'Local server'}</strong>
      </button>
    `;
    bindModelPresetCards();
    renderIcons();
    return;
  }

  if (provider === 'codex') {
    const selected = settingsLocalModel.value || providerDefaultModel(provider);
    modelPresetGrid.innerHTML = codexModelPresets
      .map((preset) => `
        <button type="button" class="model-preset-card ${preset.id === selected ? 'selected' : ''}" data-model-preset="${escapeHtml(preset.id)}" data-icon="${preset.icon}">
          <span>${escapeHtml(preset.name)}</span>
          <strong>${escapeHtml(preset.note)}</strong>
        </button>
      `)
      .join('');
    bindModelPresetCards();
    renderIcons();
    return;
  }

  const selected = settingsLocalModel.value || providerDefaultModel(provider);
  const unhealthyModel = config?.providerHealth?.available === false && config.providerHealth.provider === 'opencode'
    ? config.providerHealth.model
    : '';
  modelPresetGrid.innerHTML = opencodeZenModelPresets
    .map((preset) => {
      const blocked = preset.id === unhealthyModel;
      return `
      <button type="button" class="model-preset-card ${preset.id === selected ? 'selected' : ''} ${blocked ? 'is-unavailable' : ''}" data-model-preset="${escapeHtml(preset.id)}" data-icon="${blocked ? 'octagon-x' : preset.icon}">
        <span>${escapeHtml(preset.name)}</span>
        <strong>${escapeHtml(blocked ? `Unavailable: ${config?.providerHealth?.failureKind ?? 'check failed'}` : preset.note)}</strong>
      </button>
    `;
    })
    .join('');
  bindModelPresetCards();
  renderIcons();
}

function bindModelPresetCards() {
  modelPresetGrid.querySelectorAll<HTMLButtonElement>('[data-model-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = button.dataset.modelPreset ?? '';
      if (!model) {
        return;
      }
      if (!Array.from(settingsLocalModel.options).some((option) => option.value === model)) {
        settingsLocalModel.add(new Option(modelDisplayName(model), model));
      }
      settingsLocalModel.value = model;
      void saveLocalModelSelection();
      modelKeyMessage.textContent = `Applied: ${modelDisplayName(model)}`;
      renderModelPresets();
      renderModelProfile();
      renderModelInstructions();
    });
  });
}

function renderModelProfile() {
  const provider = localProvider();
  const model = settingsLocalModel.value || providerDefaultModel(provider) || 'No model selected';
  const key = config?.modelKey ?? {
    present: Boolean(config?.modelApiKeyPresent),
    source: config?.modelApiKeyPresent ? 'environment' : 'missing'
  };
  modelKeyStatus.textContent = provider === 'opencode'
    ? key.present ? `Ready (${key.source})` : 'Missing key'
    : 'Not required';
  modelKeyMessage.textContent = key.present
    ? `OpenCode key is stored in ${key.source === 'userData' ? 'this desktop app profile' : 'the environment'}.`
    : 'Save a key to enable live OpenCode Zen model scans.';
  settingsModelApiKey.disabled = provider !== 'opencode';
  saveModelKey.disabled = provider !== 'opencode';
  clearModelKey.disabled = provider !== 'opencode' || !key.present || key.source !== 'userData';
  modelProfileSummary.textContent = `${providerLabel(provider)} / ${modelDisplayName(model)}`;
}

function modelConnectionLabel(available: boolean, detail: string) {
  if (available) {
    return detail;
  }
  if (/missing opencode api key/i.test(detail)) {
    return 'Missing key';
  }
  if (/429|too many requests|rate limit/i.test(detail)) {
    return 'Rate limited. Wait before retrying or switch provider/model.';
  }
  if (/unauthorized|401|forbidden|403|api key/i.test(detail)) {
    return `Scan failed: ${detail}`;
  }
  return `Offline: ${detail}`;
}

function voiceCapabilityLabel() {
  const speech = Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
  const mic = Boolean(navigator.mediaDevices?.getUserMedia);
  if (speech && mic) {
    return 'Speech recognition and microphone APIs are available.';
  }
  if (!speech && !mic) {
    return 'Speech recognition and microphone APIs are unavailable in this webview.';
  }
  return speech ? 'Speech recognition is available; microphone access is unavailable.' : 'Microphone access is available; speech recognition is unavailable.';
}

function providerLabel(provider: ModelProvider) {
  if (provider === 'ollama') {
    return 'Ollama';
  }
  if (provider === 'lmstudio') {
    return 'LM Studio';
  }
  if (provider === 'codex') {
    return 'Codex CLI';
  }
  return 'OpenCode Zen';
}

function modelDisplayName(model: string) {
  const preset = codexModelPresets.find((entry) => entry.id === model);
  if (preset) return preset.name;
  const opencodePreset = opencodeZenModelPresets.find((entry) => entry.id === model);
  return opencodePreset?.name ?? model;
}

function renderMemories(memories: MemoryRecord[]) {
  if (memories.length === 0) {
    memoryList.innerHTML = '<div class="empty-state">No persistent memories yet.</div>';
    renderIcons();
    return;
  }

  memoryList.innerHTML = memories
    .slice(0, 24)
    .map((memory) => {
      const confidence = Math.round((memory.confidence ?? 1) * 100);
      const recall = recallReasonForMemory(memory);
      const duplicates = duplicateMemoriesFor(memory);
      return `
       <article class="data-node memory-node-card ${memory.id === selectedMemoryId ? 'selected crystal-active' : ''}" data-memory-id="${memory.id}" data-memory-kind="${escapeHtml(memory.kind)}">
         <span class="memory-node-card__pulse" aria-hidden="true"></span>
         <div class="data-node__meta memory-node-card__meta">
           <strong>${escapeHtml(memory.title)}</strong>
           <span>${escapeHtml(memory.kind)} / ${escapeHtml(memory.scope ?? 'project')}${duplicates.length ? ` / ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'}` : ''}</span>
         </div>
         <p>${escapeHtml(memory.content)}</p>
         <small class="memory-node-card__reason">${escapeHtml(recall)}</small>
         <div class="memory-node-card__footer">
           <span>Importance ${memory.importance} / Signal ${confidence}%</span>
           <button class="hud-button" type="button" data-icon="octagon-x" data-ignore-memory="${memory.id}"><span>Ignore</span></button>
           <button class="hud-button" type="button" data-icon="trash-2" data-delete-memory="${memory.id}"><span>Delete</span></button>
         </div>
       </article>
     `;
    })
    .join('');

  memoryList.querySelectorAll<HTMLButtonElement>('[data-delete-memory]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await fetch(`/api/memories/${button.dataset.deleteMemory}`, { method: 'DELETE' });
      await loadMemories(true);
    });
  });
  memoryList.querySelectorAll<HTMLElement>('[data-memory-id]').forEach((item) => {
    item.addEventListener('click', () => {
      const memoryId = Number(item.dataset.memoryId);
      if (Number.isFinite(memoryId)) {
        selectMemory(memoryId);
      }
    });
  });
  memoryList.querySelectorAll<HTMLButtonElement>('[data-ignore-memory]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await putJson<{ memory: MemoryRecord; count: number }>(`/api/memories/${button.dataset.ignoreMemory}`, { archived: true });
      await loadMemories(true);
    });
  });
  renderIcons();
}

function animateMemory(memory: MemoryRecord) {
  if (!isRealMemory(memory)) {
    return;
  }
  if (animatedMemoryIds.has(memory.id)) {
    return;
  }
  animatedMemoryIds.add(memory.id);
  setMode('learning');
  memoryAnimator.learn(memory);
  window.clearTimeout(modeResetTimer);
  modeResetTimer = window.setTimeout(() => setMode('idle'), 2800);
}

function isRealMemory(memory: MemoryRecord) {
  return memory.kind !== 'demo' && memory.kind !== 'manual' && memory.source !== 'ui-demo' && memory.source !== 'manual';
}

function uniqueMemories(memories: MemoryRecord[]) {
  const seen = new Set<string>();
  const unique: MemoryRecord[] = [];
  for (const memory of memories) {
    const key = `${memory.kind}\n${memory.title}\n${memory.content}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(memory);
  }
  return unique;
}

function recallReasonForMemory(memory: MemoryRecord) {
  const recall = lastMemoryRecall.get(memory.id);
  if (recall) {
    const prompt = recall.prompt ? ` for "${compactSessionTitle(recall.prompt)}"` : '';
    return `Recalled by ${recall.mode} search${prompt}`;
  }
  const selected = selectedTask();
  if (selected?.rememberedMemoryIds?.includes(memory.id)) {
    return `Used as context for ${compactSessionTitle(selected.prompt)}`;
  }
  if (Number(memory.pinned)) {
    return 'Pinned anchor memory';
  }
  return memoryReason(memory);
}

function duplicateMemoriesFor(memory: MemoryRecord, source: MemoryRecord[] = visibleMemories) {
  const key = memoryFingerprint(memory);
  return source
    .filter((entry) => entry.id !== memory.id && memoryFingerprint(entry) === key)
    .slice(0, 5);
}

function memoryFingerprint(memory: MemoryRecord) {
  return `${memory.kind}\n${memory.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function rememberText(text: string, source: string) {
  const response = await fetch('/api/remember', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source })
  });
  if (response.ok) {
    scene.pulseMemoryGrowth(0.72);
    await loadMemories(false);
  }
}

async function cancelTask(taskId: string) {
  const data = await postJson<{ task?: TaskRecord; error?: string }>(`/api/tasks/${taskId}/cancel`, {});
  if (data.task) {
    taskHud.upsert(data.task);
    scene.pulseResponse(0.62);
    scene.setResponseActive(false);
    currentRunningTask = currentRunningTask?.id === data.task.id ? null : currentRunningTask;
    streamingActive = false;
    pendingStreamUpdate = null;
    lastCommandPhase = data.task.phase ?? data.task.status;
    lastCommandOutput = data.task.output;
    voiceStatus.textContent = 'Task stopped.';
    upsertVisibleTask(data.task, true);
    renderCommandChat(true);
    void refreshQueueStatus();
  }
}

function upsertVisibleTask(task: TaskRecord, select: boolean) {
  visibleTasks = [task, ...visibleTasks.filter((entry) => entry.id !== task.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
  if (select) {
    selectedTaskId = task.id;
    selectedChatId = task.chatId ?? selectedChatId;
    persistSelectedChat();
  }
  renderTaskHistory();
  renderArtifactCatalog();
  renderChatSessions();
}

function renderTaskHistory() {
  if (visibleTasks.length === 0) {
    taskHistoryList.innerHTML = '<div class="empty-state">No task history yet.</div>';
    taskHistoryDetail.classList.add('hidden');
    taskHistoryDetail.innerHTML = '';
    commandReviewPanel.innerHTML = '';
    renderIcons();
    return;
  }

  taskHistoryList.innerHTML = visibleTasks
    .slice(0, 12)
    .map((task) => `
      <article class="data-node ${task.id === selectedTaskId ? 'selected' : ''}" data-task-id="${escapeHtml(task.id)}">
        <div class="data-node__meta">
          <strong>${escapeHtml(task.prompt)}</strong>
          <span>${escapeHtml(task.phase ?? task.status)} / ${formatTime(task.createdAt)}</span>
        </div>
        <p>${escapeHtml(task.output.trim() || 'Waiting for Codex output')}</p>
      </article>
    `)
    .join('');

  taskHistoryList.querySelectorAll<HTMLElement>('[data-task-id]').forEach((item) => {
    item.addEventListener('click', () => {
      const taskId = item.dataset.taskId;
      if (taskId) {
        selectedTaskId = taskId;
        selectedChatId = visibleTasks.find((task) => task.id === taskId)?.chatId ?? selectedChatId;
        persistSelectedChat();
        renderTaskHistory();
        renderCommandReviewPanel();
        renderChatSessions();
        renderCommandChat(true);
      }
    });
  });

  renderTaskDetail();
  renderCommandReviewPanel();
  renderIcons();
}

function renderTaskDetail() {
  const task = selectedTask();
  if (!task) {
    taskHistoryDetail.classList.add('hidden');
    taskHistoryDetail.innerHTML = '<div class="empty-state">Select a task to inspect its output.</div>';
    return;
  }
  const createdMemories = task.createdMemoryIds ?? [];
  const skipped = task.memorySkipped ?? [];
  const remembered = task.rememberedMemoryIds ?? [];
  taskHistoryDetail.classList.remove('hidden');
  taskHistoryDetail.innerHTML = `
    <span>${escapeHtml(task.status)}${task.exitCode !== null ? ` / exit ${task.exitCode}` : ''}</span>
    <strong>${escapeHtml(task.prompt)}</strong>
    <p>${escapeHtml(task.output.trim() || 'No output captured yet.')}</p>
    <div class="task-actions">
      ${task.status === 'running' || task.status === 'queued' ? `<button type="button" data-icon="octagon-x" data-cancel-task-detail="${escapeHtml(task.id)}"><span>Cancel</span></button>` : ''}
      ${task.status !== 'running' && task.status !== 'queued' ? `<button type="button" data-icon="rotate-cw" data-retry-task="${escapeHtml(task.id)}"><span>Retry</span></button>` : ''}
    </div>
    <div class="task-memory-activity">
      <span>Memory Activity</span>
      ${createdMemories.length > 0 ? `<p>Saved ${createdMemories.map((id) => memoryLabel(id)).join(', ')}</p>` : ''}
      ${skipped.length > 0 ? skipped.slice(0, 3).map((entry) => `<p>${escapeHtml(entry.reason)}</p>`).join('') : ''}
      ${createdMemories.length === 0 && skipped.length === 0 ? '<p>Memory extraction pending.</p>' : ''}
      ${remembered.length > 0 ? `<p>Context used ${remembered.map((id) => memoryLabel(id)).join(', ')}</p>` : ''}
    </div>
    <div class="task-memory-activity">
      <span>Artifacts</span>
      ${renderArtifactList('Files', task.filesChanged, task.workspace)}
      ${renderArtifactList('Commands', task.commandsRun)}
      ${renderArtifactList('Tests', task.testsRun)}
      ${task.logs?.trim() ? `<details><summary>Full logs</summary><pre>${escapeHtml(task.logs.slice(-6000))}</pre></details>` : ''}
    </div>
  `;
  taskHistoryDetail.querySelector<HTMLButtonElement>('[data-cancel-task-detail]')?.addEventListener('click', () => {
    void cancelTask(task.id);
  });
  taskHistoryDetail.querySelector<HTMLButtonElement>('[data-retry-task]')?.addEventListener('click', async () => {
    const data = await postJson<{ task: TaskRecord }>(`/api/tasks/${task.id}/retry`, {});
    upsertVisibleTask(data.task, true);
    setTab('run');
  });
  wireArtifactOpenButtons(taskHistoryDetail);
  renderIcons();
}

function renderCommandReviewPanel() {
  const task = selectedTask();
  if (!task) {
    commandReviewPanel.innerHTML = '';
    return;
  }
  const commands = task.commandsRun ?? [];
  const files = task.filesChanged ?? [];
  const tests = task.testsRun ?? [];
  commandReviewPanel.innerHTML = `
    <article>
      <span class="micro-label">Command Review</span>
      <strong>${escapeHtml(commandReviewStatus(task))}</strong>
      <p>${escapeHtml(`Files ${files.length} / commands ${commands.length} / tests ${tests.length}`)}</p>
      <div class="command-review-grid">
        ${renderReviewBucket('Files', files, task.workspace, true)}
        ${renderReviewBucket('Commands', commands)}
        ${renderReviewBucket('Tests', tests)}
      </div>
      <div class="task-actions task-actions--inline">
        ${commands.length ? `<button type="button" data-copy-review-commands data-icon="terminal-square"><span>Copy Commands</span></button>` : ''}
        ${files.length ? `<button type="button" data-copy-review-files data-icon="save"><span>Copy Files</span></button>` : ''}
      </div>
    </article>
  `;
  commandReviewPanel.querySelector<HTMLButtonElement>('[data-copy-review-commands]')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(commands.join('\n'));
    voiceStatus.textContent = 'Reviewed commands copied.';
  });
  commandReviewPanel.querySelector<HTMLButtonElement>('[data-copy-review-files]')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(files.join('\n'));
    voiceStatus.textContent = 'Reviewed files copied.';
  });
  wireArtifactOpenButtons(commandReviewPanel);
  renderIcons();
}

function renderReviewBucket(label: string, values: string[] = [], workspace = '', openable = false) {
  return `
    <section>
      <strong>${escapeHtml(label)}</strong>
      ${values.length ? values.slice(0, 8).map((value) => openable
        ? `<button type="button" class="artifact-file" data-open-artifact="${escapeHtml(value)}" data-workspace="${escapeHtml(workspace)}"><code>${escapeHtml(value)}</code></button>`
        : `<code>${escapeHtml(value)}</code>`).join('')
        : '<span>None captured</span>'}
    </section>
  `;
}

function commandReviewStatus(task: TaskRecord) {
  if (task.status === 'completed' && (task.testsRun?.length ?? 0) > 0) return 'Verified task';
  if (task.status === 'completed') return 'Completed without captured tests';
  if (task.status === 'failed') return 'Failed task review';
  return `${task.status} task`;
}

function selectMemory(memoryId: number) {
  selectedMemoryId = memoryId;
  scene.setSelectedMemory(memoryId);
  renderMemories(visibleMemories);
  renderMemoryDetail();
  renderCommandChat(true);
}

function renderMemoryDetail() {
  const memory = visibleMemories.find((entry) => entry.id === selectedMemoryId);
  if (!memory) {
    memoryDetail.classList.add('hidden');
    memoryDetail.innerHTML = '';
    return;
  }
  memoryDetail.classList.remove('hidden');
  const confidence = Math.round((memory.confidence ?? 1) * 100);
  const duplicates = duplicateMemoriesFor(memory);
  const recall = recallReasonForMemory(memory);
  memoryDetail.innerHTML = `
    <div class="memory-detail-shell__head">
      <span class="memory-detail-shell__node" aria-hidden="true"></span>
      <div>
        <span>${escapeHtml(memory.kind)} / ${escapeHtml(memory.scope ?? 'project')}</span>
        <strong>${escapeHtml(memory.title)}</strong>
      </div>
      <em>${confidence}%</em>
    </div>
    <div class="memory-detail-shell__insight">
      <strong>${escapeHtml(recall)}</strong>
      <span>${duplicates.length ? `${duplicates.length} likely duplicate${duplicates.length === 1 ? '' : 's'} found` : 'No close duplicate in this filter'}</span>
    </div>
    <input id="memory-edit-title" value="${escapeHtml(memory.title)}" />
    <textarea id="memory-edit-content">${escapeHtml(memory.content)}</textarea>
    <div class="memory-edit-row">
      <select id="memory-edit-scope">
        <option value="project" ${memory.scope !== 'global' ? 'selected' : ''}>Project</option>
        <option value="global" ${memory.scope === 'global' ? 'selected' : ''}>Global</option>
      </select>
      <button type="button" id="pin-memory" data-icon="pin"><span>${Number(memory.pinned) ? 'Unpin' : 'Pin'}</span></button>
      <button type="button" id="ignore-memory" data-icon="octagon-x"><span>Ignore</span></button>
      ${duplicates.length ? '<button type="button" id="archive-duplicates" data-icon="trash-2"><span>Archive Duplicates</span></button>' : ''}
      <button type="button" id="save-memory" data-icon="save"><span>Save</span></button>
    </div>
  `;
  required<HTMLButtonElement>('#save-memory').addEventListener('click', async () => {
    await putJson<{ memory: MemoryRecord; count: number }>(`/api/memories/${memory.id}`, {
      title: required<HTMLInputElement>('#memory-edit-title').value,
      content: required<HTMLTextAreaElement>('#memory-edit-content').value,
      scope: required<HTMLSelectElement>('#memory-edit-scope').value,
      workspace: taskWorkspace.value
    });
    await loadMemories(true);
  });
  required<HTMLButtonElement>('#pin-memory').addEventListener('click', async () => {
    await putJson<{ memory: MemoryRecord; count: number }>(`/api/memories/${memory.id}`, { pinned: !Number(memory.pinned) });
    await loadMemories(true);
  });
  required<HTMLButtonElement>('#ignore-memory').addEventListener('click', async () => {
    await putJson<{ memory: MemoryRecord; count: number }>(`/api/memories/${memory.id}`, { archived: true });
    selectedMemoryId = null;
    scene.setSelectedMemory(null);
    await loadMemories(true);
  });
  memoryDetail.querySelector<HTMLButtonElement>('#archive-duplicates')?.addEventListener('click', async () => {
    await Promise.all(duplicates.map((duplicate) => putJson<{ memory: MemoryRecord; count: number }>(`/api/memories/${duplicate.id}`, { archived: true })));
    await loadMemories(true);
  });
  renderIcons();
}

function memoryLabel(id: number) {
  const memory = visibleMemories.find((entry) => entry.id === id);
  return escapeHtml(memory ? `#${id} ${memory.title}` : `#${id}`);
}

function setMode(mode: AssistantMode) {
  const changed = app.dataset.mode !== mode;
  scene.setMode(mode);
  app.dataset.mode = mode;
  modeLabel.textContent = mode[0].toUpperCase() + mode.slice(1);
  if (changed) {
    renderCommandChat();
  }
}

function modeForTaskPhase(phase: string): AssistantMode {
  if (phase === 'queued' || phase === 'planning' || phase === 'thinking') {
    return 'thinking';
  }
  if (phase === 'streaming' || phase === 'editing' || phase === 'testing') {
    return 'executing';
  }
  if (phase === 'done' || phase === 'completed') {
    return 'learning';
  }
  return 'idle';
}

function resetStreamOutput(taskId: string) {
  streamingActive = false;
  streamTaskId = taskId;
  streamVisibleOutput = '';
  streamElement = null;
  streamScrollContainer = null;
  pendingStreamUpdate = null;
  if (streamUpdateFrame) {
    cancelAnimationFrame(streamUpdateFrame);
    streamUpdateFrame = 0;
  }
}

function scheduleStreamOutput(taskId: string, output: string, phase: TaskRecord['phase'] = 'streaming') {
  pendingStreamUpdate = { id: taskId, output, phase };
  if (streamUpdateFrame) {
    return;
  }
  streamUpdateFrame = requestAnimationFrame(() => {
    streamUpdateFrame = 0;
    const update = pendingStreamUpdate;
    pendingStreamUpdate = null;
    if (update) {
      startStreamOutput(update.id, update.output, update.phase);
    }
  });
}

function startStreamOutput(taskId: string, output: string, phase: TaskRecord['phase'] = 'streaming') {
  if (streamTaskId !== taskId) {
    resetStreamOutput(taskId);
  }
  streamVisibleOutput = output;
  streamingActive = true;
  lastCommandOutput = output;
  lastCommandPhase = phase;

  if (selectedTaskId !== taskId) {
    return;
  }
  if (!streamElement && !commandChatFeed.querySelector(`[data-stream-task="${taskId}"]`)) {
    renderCommandChat(true);
  }
  if (!streamElement || !document.body.contains(streamElement)) {
    streamElement = commandChatFeed.querySelector<HTMLElement>(`[data-stream-task="${taskId}"] .mission-output-stream`);
  }
  if (!streamScrollContainer || !document.body.contains(streamScrollContainer)) {
    streamScrollContainer = commandChatFeed.querySelector<HTMLElement>(`[data-stream-task="${taskId}"]`);
  }
  if (streamElement) {
    streamElement.textContent = output;
  }
  if (streamScrollContainer) {
    streamScrollContainer.scrollTop = streamScrollContainer.scrollHeight;
  }
}

function completeStreamOutput(taskId: string, output: string) {
  streamingActive = false;
  streamTaskId = null;
  streamVisibleOutput = output;
  lastCommandOutput = output;
  pendingStreamUpdate = null;
  if (streamUpdateFrame) {
    cancelAnimationFrame(streamUpdateFrame);
    streamUpdateFrame = 0;
  }
  streamElement = null;
  streamScrollContainer = null;
  // Do a single clean re-render now that streaming is done
  if (selectedTaskId === taskId) {
    renderCommandChat(true);
  }
}

async function startNewChat() {
  const created = await postJson<{ chat: ChatSessionRecord }>('/api/chats', {
    title: 'New Chat',
    workspace: taskWorkspace.value
  });
  upsertVisibleChat(created.chat, true);
  selectedTaskId = null;
  reviewingHistoricalTask = false;
  currentRunningTask = null;
  streamTaskId = null;
  streamingActive = false;
  pendingStreamUpdate = null;
  if (streamUpdateFrame) {
    cancelAnimationFrame(streamUpdateFrame);
    streamUpdateFrame = 0;
  }
  lastCommandPrompt = '';
  lastCommandOutput = '';
  lastCommandPhase = 'ready';
  streamElement = null;
  streamScrollContainer = null;
  lastMissionSignature = '';
  renderTaskHistory();
  renderChatSessions();
  renderCommandChat(true);
  setChatSidebarOpen(false);
  voiceStatus.textContent = 'New chat started.';
  taskPrompt.focus();
}

function selectChat(chatId: string) {
  const chat = visibleChats.find((entry) => entry.id === chatId);
  if (!chat) {
    return;
  }
  selectedChatId = chat.id;
  persistSelectedChat();
  reviewingHistoricalTask = false;
  const newestTask = visibleTasks
    .filter((task) => task.chatId === chat.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  selectedTaskId = newestTask?.id ?? null;
  lastCommandPrompt = newestTask?.prompt ?? '';
  lastCommandOutput = newestTask?.output ?? '';
  lastCommandPhase = newestTask?.phase ?? newestTask?.status ?? 'ready';
  streamElement = null;
  streamScrollContainer = null;
  lastMissionSignature = '';
  renderTaskHistory();
  renderChatSessions();
  renderCommandChat(true);
  setChatSidebarOpen(false);
}

function setChatSidebarOpen(open: boolean) {
  app.dataset.chatSidebar = open ? 'open' : 'closed';
  chatSidebarToggle.setAttribute('aria-expanded', String(open));
}

function renderChatSessions() {
  newChat.classList.toggle('active', Boolean(selectedChatId && !visibleTasks.some((task) => task.chatId === selectedChatId)));
  const query = chatSearch.value.trim().toLowerCase();
  const chats = visibleChats
    .filter((chat) => !query
      || chat.title.toLowerCase().includes(query)
      || (chat.lastPrompt ?? '').toLowerCase().includes(query)
      || chat.workspace.toLowerCase().includes(query))
    .sort(compareChats);
  if (chats.length === 0) {
    chatSessionList.innerHTML = '<div class="chat-session-empty">No saved chats yet.</div>';
    return;
  }

  chatSessionList.innerHTML = chats
    .slice(0, 30)
    .map(renderChatSessionButton)
    .join('');

  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-chat-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const chatId = button.dataset.chatSelect;
      if (chatId) {
        selectChat(chatId);
      }
    });
  });
  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-chat-rename]').forEach((button) => {
    button.addEventListener('click', async () => {
      const chatId = button.dataset.chatRename;
      const chat = visibleChats.find((entry) => entry.id === chatId);
      if (!chat) return;
      const title = window.prompt('Rename chat', chat.title)?.trim();
      if (!title || title === chat.title) return;
      const updated = await putJson<{ chat: ChatSessionRecord }>(`/api/chats/${encodeURIComponent(chat.id)}`, { title });
      upsertVisibleChat(updated.chat, selectedChatId === chat.id);
      renderCommandChat(true);
    });
  });
  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-chat-archive]').forEach((button) => {
    button.addEventListener('click', async () => {
      const chatId = button.dataset.chatArchive;
      if (!chatId || !window.confirm('Archive this chat? Task history stays available in Archive.')) return;
      await fetch(`/api/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
      visibleChats = visibleChats.filter((chat) => chat.id !== chatId);
      if (selectedChatId === chatId) {
        selectedChatId = visibleChats[0]?.id ?? null;
        selectedTaskId = visibleTasks.find((task) => task.chatId === selectedChatId)?.id ?? null;
        persistSelectedChat();
      }
      renderChatSessions();
      renderCommandChat(true);
    });
  });
  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-chat-pin]').forEach((button) => {
    button.addEventListener('click', async () => {
      const chatId = button.dataset.chatPin;
      const chat = visibleChats.find((entry) => entry.id === chatId);
      if (!chat) return;
      const updated = await putJson<{ chat: ChatSessionRecord }>(`/api/chats/${encodeURIComponent(chat.id)}`, { pinned: !chat.pinned });
      upsertVisibleChat(updated.chat, selectedChatId === chat.id);
    });
  });
  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-chat-clear]').forEach((button) => {
    button.addEventListener('click', async () => {
      const chatId = button.dataset.chatClear;
      if (!chatId || !window.confirm('Clear this chat transcript from the Run view? Task history stays in Archive.')) return;
      const updated = await postJson<{ chat: ChatSessionRecord }>(`/api/chats/${encodeURIComponent(chatId)}/clear`, {});
      upsertVisibleChat(updated.chat, selectedChatId === chatId);
      if (selectedChatId === chatId) {
        selectedTaskId = null;
        lastCommandOutput = '';
        lastCommandPhase = 'ready';
        renderCommandChat(true);
      }
      await loadTasks();
    });
  });
  renderIcons();
}

function pulseLiveStream() {
  const now = performance.now();
  if (now - lastStreamPulseAt < 160) {
    return;
  }
  lastStreamPulseAt = now;
  scene.pulseResponse(0.62);
  scene.pulseMemoryGrowth(0.12);
}

function scheduleStreamChromeRender() {
  const now = performance.now();
  if (now - lastStreamChromeRenderAt < 700) {
    return;
  }
  lastStreamChromeRenderAt = now;
  requestAnimationFrame(() => {
    renderChatSessions();
  });
}

function renderChatSessionButton(chat: ChatSessionRecord) {
  const active = chat.id === selectedChatId;
  const live = chat.lastStatus === 'running' || chat.lastStatus === 'queued';
  const preview = chat.lastPrompt || (chat.taskCount ? 'No prompt captured yet.' : 'Empty chat ready for a mission.');
  return `
    <article class="chat-session ${active ? 'active' : ''} ${live ? 'is-live' : ''}">
      <button class="chat-session__main" type="button" data-chat-select="${escapeHtml(chat.id)}">
        <span class="chat-session__status">${chat.pinned ? 'Pinned' : escapeHtml(sessionStatusLabel(chat.lastStatus ?? null))}</span>
        <strong>${escapeHtml(compactSessionTitle(chat.title))}</strong>
        <em>${escapeHtml(formatTime(chat.lastTaskAt ?? chat.updatedAt))} / ${chat.taskCount ?? 0} task${chat.taskCount === 1 ? '' : 's'}</em>
        <p>${escapeHtml(preview)}</p>
      </button>
      <div class="chat-session__actions">
        <button type="button" class="hud-button hud-button--icon" data-icon="pin" data-chat-pin="${escapeHtml(chat.id)}" aria-label="${chat.pinned ? 'Unpin chat' : 'Pin chat'}" title="${chat.pinned ? 'Unpin chat' : 'Pin chat'}"><span>${chat.pinned ? 'Unpin' : 'Pin'}</span></button>
        <button type="button" class="hud-button hud-button--icon" data-icon="save" data-chat-rename="${escapeHtml(chat.id)}" aria-label="Rename chat" title="Rename chat"><span>Rename</span></button>
        <button type="button" class="hud-button hud-button--icon" data-icon="rotate-ccw" data-chat-clear="${escapeHtml(chat.id)}" aria-label="Clear chat transcript" title="Clear chat transcript"><span>Clear</span></button>
        <button type="button" class="hud-button hud-button--icon" data-icon="trash-2" data-chat-archive="${escapeHtml(chat.id)}" aria-label="Archive chat" title="Archive chat"><span>Archive</span></button>
      </div>
    </article>
  `;
}

function sessionStatusLabel(status: TaskRecord['status'] | null) {
  if (status === 'running') return 'Live';
  if (status === 'queued') return 'Queued';
  if (status === 'completed') return 'Done';
  if (status === 'cancelled') return 'Stopped';
  if (!status) return 'Draft';
  return 'Review';
}

function compactSessionTitle(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean || 'Untitled chat';
}

function isNearBottom(el: HTMLElement, threshold = 56) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function renderCommandChat(immediate = false) {
  const now = performance.now();
  const throttleMs = lastCommandPhase === 'streaming' || lastCommandPhase === 'editing' || lastCommandPhase === 'testing' ? 200 : 90;
  if (!immediate && now - lastMissionRenderAt < throttleMs) {
    if (!missionRenderFrame) {
      missionRenderFrame = requestAnimationFrame(() => {
        missionRenderFrame = 0;
        renderCommandChat(true);
      });
    }
    return;
  }

  lastMissionRenderAt = now;
  const draftPrompt = taskPrompt.value.trim();
  const latestTask = selectedTask();
  const conversationTasks = currentChatTasks(latestTask);
  const prompt = latestTask?.prompt || lastCommandPrompt || draftPrompt;
  const phase = latestTask ? latestTask.phase ?? latestTask.status : lastCommandPhase;
  const taskOutput = latestTask && streamTaskId === latestTask.id
    ? streamVisibleOutput || latestTask.output
    : latestTask?.output ?? '';
  const output = (latestTask ? taskOutput : lastCommandOutput).trim();
  const memoryLine = `${visibleMemories.length} ${visibleMemories.length === 1 ? 'memory' : 'memories'} indexed`;
  const statusText = modeLabel.textContent?.trim() || 'Idle';
  const promptPreview = prompt || draftPrompt || 'Standing by.';
  const provider = providerLabel(localProvider());
  const model = settingsLocalModel.value || providerDefaultModel(localProvider()) || config?.codexModel || 'default';
  const createdMemoryCount = latestTask?.createdMemoryIds?.length ?? 0;
  const rememberedMemoryCount = latestTask?.rememberedMemoryIds?.length ?? 0;
  const artifactCount = artifactCountForTask(latestTask);
  const progress = missionProgressFor(latestTask, phase);
  const nextAction = missionNextActionFor(latestTask, output);
  const objective = latestTask?.prompt || promptPreview;
  const timeline = renderMissionTimeline(latestTask, conversationTasks, output, promptPreview, statusText, phase);
  const memoryContext = renderMissionMemoryContext(latestTask);
  const artifactMarkup = renderMissionArtifacts(latestTask);
  const signature = JSON.stringify({
    objective,
    statusText,
    phase,
    progress,
    nextAction,
    outputTail: output.slice(-900),
    memoryIds: latestTask?.rememberedMemoryIds ?? [],
    createdIds: latestTask?.createdMemoryIds ?? [],
    artifactCount,
    selectedMemoryId,
    selectedTaskId,
    reviewingHistoricalTask,
    selectedChatId,
    conversationIds: conversationTasks.map((task) => `${task.id}:${task.status}:${task.phase}:${task.output.length}`),
    taskCount: visibleTasks.length,
    visibleMemories: visibleMemories.length,
    promptPreview,
    missionQueueLabel,
    provider,
    model
  });

  if (signature === lastMissionSignature) {
    return;
  }
  lastMissionSignature = signature;
  renderChatSessions();

  // NEVER replace timeline DOM while streaming is active - it destroys the live element
  if (streamingActive && streamTaskId === latestTask?.id) {
    // Only update non-timeline elements
    missionObjective.textContent = objective;
    missionPhase.textContent = missionPhaseLabel(latestTask, phase);
    missionProgressFill.style.width = `${progress}%`;
    missionNextAction.textContent = nextAction;
    missionVitals.innerHTML = `
      <span><b>${escapeHtml(provider)}</b><em>${escapeHtml(modelDisplayName(model))}</em></span>
      <span><b>${escapeHtml(memoryLine)}</b><em>${escapeHtml(missionQueueLabel)}</em></span>
      <span><b>${visibleTasks.length} tasks</b><em>${escapeHtml(compactPath(taskWorkspace.value || config?.defaultWorkspace || ''))}</em></span>
    `;
    missionMemorySummary.textContent = rememberedMemoryCount > 0
      ? `${rememberedMemoryCount} recalled / ${createdMemoryCount} saved`
      : createdMemoryCount > 0
        ? `${createdMemoryCount} saved`
        : 'No active recall';
    missionMemoryContext.innerHTML = memoryContext;
    missionArtifactSummary.textContent = artifactCount > 0 ? `${artifactCount} captured` : 'No outputs yet';
    missionArtifacts.innerHTML = artifactMarkup;
    return;
  }

  // Save scroll positions before re-rendering
  const scrollPositions = new Map<string, { top: number; atBottom: boolean }>();
  const existingStreams = commandChatFeed.querySelectorAll('.conversation-stream');
  existingStreams.forEach((stream) => {
    const el = stream as HTMLElement;
    const key = el.dataset.streamTask ?? 'default';
    scrollPositions.set(key, {
      top: el.scrollTop,
      atBottom: isNearBottom(el)
    });
  });

  missionObjective.textContent = objective;
  missionPhase.textContent = missionPhaseLabel(latestTask, phase);
  missionProgressFill.style.width = `${progress}%`;
  missionNextAction.textContent = nextAction;
  missionVitals.innerHTML = `
    <span><b>${escapeHtml(provider)}</b><em>${escapeHtml(modelDisplayName(model))}</em></span>
    <span><b>${escapeHtml(memoryLine)}</b><em>${escapeHtml(missionQueueLabel)}</em></span>
    <span><b>${visibleTasks.length} tasks</b><em>${escapeHtml(compactPath(taskWorkspace.value || config?.defaultWorkspace || ''))}</em></span>
  `;
  missionMemorySummary.textContent = rememberedMemoryCount > 0
    ? `${rememberedMemoryCount} recalled / ${createdMemoryCount} saved`
    : createdMemoryCount > 0
      ? `${createdMemoryCount} saved`
      : 'No active recall';
  missionMemoryContext.innerHTML = memoryContext;
  missionArtifactSummary.textContent = artifactCount > 0 ? `${artifactCount} captured` : 'No outputs yet';
  missionArtifacts.innerHTML = artifactMarkup;
  commandChatFeed.innerHTML = timeline;
  wireActiveTaskActions();

  missionMemoryContext.querySelectorAll<HTMLButtonElement>('[data-memory-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      const memoryId = Number(button.dataset.memoryJump);
      if (Number.isFinite(memoryId)) {
        selectMemory(memoryId);
      }
    });
  });
  wireArtifactOpenButtons(missionArtifacts);

  // Restore scroll positions after re-render. If the user was already following
  // the bottom of the transcript, keep the final recovery/result controls visible.
  const conversationStreams = commandChatFeed.querySelectorAll('.conversation-stream');
  conversationStreams.forEach((stream) => {
    const el = stream as HTMLElement;
    const key = el.dataset.streamTask ?? 'default';
    const saved = scrollPositions.get(key);
    if (saved?.atBottom ?? true) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    } else if (saved) {
      el.scrollTop = saved.top;
    }
  });
}

function renderMissionTimeline(
  task: TaskRecord | null,
  conversationTasks: TaskRecord[],
  output: string,
  promptPreview: string,
  statusText: string,
  phase: string
) {
  const taskStatus = task?.status ?? 'idle';
  const live = task?.status === 'running' || task?.status === 'queued';
  const conversation = renderMissionConversation(task, conversationTasks, output, promptPreview, statusText, phase);

  return `
    <article class="mission-event mission-event--response mission-event--${escapeHtml(taskStatus)} ${live ? 'is-live' : ''}" ${task ? `data-task-id="${escapeHtml(task.id)}"` : ''}>
      <div class="conversation-header">
        <span>${escapeHtml(statusText)} / ${escapeHtml(phase)}</span>
        <strong>${escapeHtml(task ? statusTitle(task.status) : 'Awaiting mission')}</strong>
      </div>
      ${renderTaskPhaseStepper(task, phase)}
      <div class="conversation-stream ${live ? 'is-live' : ''}" ${task ? `data-stream-task="${escapeHtml(task.id)}"` : ''}>
        ${conversation}
      </div>
      ${renderActiveTaskActions(task, output)}
    </article>
  `;
}

function renderActiveTaskActions(task: TaskRecord | null, output: string) {
  if (!task) {
    return '';
  }
  const live = task.status === 'running' || task.status === 'queued';
  if (!live && (task.status === 'failed' || task.status === 'timed_out')) {
    return '';
  }
  return `
    <div class="task-actions task-actions--inline">
      ${live ? `<button type="button" data-icon="octagon-x" data-cancel-active-task="${escapeHtml(task.id)}"><span>Stop</span></button>` : ''}
      ${!live ? `<button type="button" data-icon="rotate-cw" data-retry-active-task="${escapeHtml(task.id)}"><span>Retry</span></button>` : ''}
      ${output.trim() ? `<button type="button" data-icon="save" data-copy-task-summary="${escapeHtml(task.id)}"><span>Copy summary</span></button>` : ''}
      ${(task.commandsRun?.length ?? 0) > 0 ? `<button type="button" data-icon="terminal-square" data-copy-task-commands="${escapeHtml(task.id)}"><span>Copy commands</span></button>` : ''}
    </div>
  `;
}

function renderTaskPhaseStepper(task: TaskRecord | null, phase: string) {
  const steps = [
    ['queued', 'Queued'],
    ['planning', 'Plan'],
    ['editing', 'Edit'],
    ['testing', 'Verify'],
    ['done', 'Done']
  ] as const;
  const normalized = phase === 'thinking' || phase === 'streaming' ? 'planning' : phase;
  const activeIndex = task ? Math.max(0, steps.findIndex(([key]) => key === normalized)) : -1;
  return `
    <div class="mission-stepper" aria-label="Task lifecycle">
      ${steps.map(([, label], index) => `
        <span class="${index < activeIndex ? 'complete' : index === activeIndex ? 'active' : ''}">
          <i></i>${escapeHtml(label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderMissionConversation(
  task: TaskRecord | null,
  conversationTasks: TaskRecord[],
  output: string,
  promptPreview: string,
  statusText: string,
  phase: string
) {
  const messages: string[] = [];

  if (conversationTasks.length > 0) {
    for (const entry of conversationTasks) {
      const active = task?.id === entry.id;
      const entryStatus = active ? task?.status ?? entry.status : entry.status;
      const activeOutput = active ? output || entry.output || '' : entry.output || '';
      const entryPhase = active ? phase : entry.phase ?? entry.status;
      messages.push(renderConversationMessage('user', entry.prompt, active ? 'You' : 'You', formatTime(entry.createdAt), false));
      if (active && (entryStatus === 'queued' || entryStatus === 'running')) {
        messages.push(renderThinkingSignal(
          activeOutput ? activeSignalLabel(entryPhase) : 'Thinking through the mission',
          entryPhase,
          Boolean(activeOutput)
        ));
      }
      const cleanOutput = stripUiArtifactBlocks(activeOutput).trim();
      const assistantBody = cleanOutput
        ? cleanOutput.slice(entryStatus === 'running' ? -3600 : -1400)
        : entryStatus === 'queued'
          ? 'Queued for the local agent.'
          : entryStatus === 'running'
            ? ''
            : 'No response captured for this run.';
      messages.push(renderConversationMessage('assistant', assistantBody, 'Jarvis', entryPhase, active && entryStatus === 'running'));
      if (entryStatus === 'failed' || entryStatus === 'timed_out') {
        messages.push(renderRunRecoveryCard(entry));
      }
    }
  } else if (promptPreview && promptPreview !== 'Standing by.') {
    messages.push(renderConversationMessage('user', promptPreview, 'Draft command', 'Not sent yet', false));
  }

  if (messages.length === 0) {
    messages.push(renderConversationMessage(
      'assistant',
      `${providerLabel(localProvider())} standing by. Send a mission to start a persistent run transcript.`,
      statusText,
      phase,
      false
    ));
  }

  return messages.join('');
}

function renderRunRecoveryCard(task: TaskRecord) {
  const kind = task.failureKind ?? (isRateLimitOutput(task.output) ? 'rate_limit' : task.status === 'timed_out' ? 'timeout' : 'unknown');
  const action = task.failureAction ?? providerFailureAction(kind);
  const canRetryCodex = config?.providerHealth?.provider !== 'codex' && config?.codexStatus?.available === true;
  return `
    <section class="run-recovery-card">
      <div>
        <span>${escapeHtml(titleCase(kind.replace(/_/g, ' ')))}</span>
        <strong>Run recovery</strong>
        <p>${escapeHtml(action)}</p>
      </div>
      <div class="run-recovery-actions">
        <button type="button" data-icon="rotate-cw" data-retry-active-task="${escapeHtml(task.id)}"><span>Retry</span></button>
        ${canRetryCodex ? `<button type="button" data-icon="terminal-square" data-retry-task-codex="${escapeHtml(task.id)}"><span>Retry with Codex</span></button>` : ''}
        <button type="button" data-icon="sliders-horizontal" data-open-settings-from-task="${escapeHtml(task.id)}"><span>Open Settings</span></button>
        <button type="button" data-icon="activity" data-open-diagnostics-from-task="${escapeHtml(task.id)}"><span>Open Diagnostics</span></button>
        <button type="button" data-icon="save" data-copy-task-error="${escapeHtml(task.id)}"><span>Copy Error</span></button>
      </div>
    </section>
  `;
}

function wireActiveTaskActions() {
  commandChatFeed.querySelector<HTMLButtonElement>('[data-cancel-active-task]')?.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.cancelActiveTask;
    if (taskId) {
      await cancelTask(taskId);
    }
  });
  commandChatFeed.querySelectorAll<HTMLButtonElement>('[data-retry-active-task]').forEach((button) => button.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.retryActiveTask;
    if (!taskId) {
      return;
    }
    const data = await postJson<{ task: TaskRecord }>(`/api/tasks/${taskId}/retry`, {});
    upsertVisibleTask(data.task, true);
    setTab('run');
  }));
  commandChatFeed.querySelectorAll<HTMLButtonElement>('[data-retry-task-codex]').forEach((button) => button.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.retryTaskCodex;
    if (!taskId) {
      return;
    }
    const data = await postJson<{ task: TaskRecord }>(`/api/tasks/${taskId}/retry`, { provider: 'codex' });
    upsertVisibleTask(data.task, true);
    setTab('run');
  }));
  commandChatFeed.querySelectorAll<HTMLButtonElement>('[data-open-settings-from-task]').forEach((button) => button.addEventListener('click', () => {
    setTab('settings');
  }));
  commandChatFeed.querySelectorAll<HTMLButtonElement>('[data-open-diagnostics-from-task]').forEach((button) => button.addEventListener('click', () => {
    setTab('diagnostics');
  }));
  commandChatFeed.querySelectorAll<HTMLButtonElement>('[data-copy-task-error]').forEach((button) => button.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.copyTaskError;
    const task = taskId ? visibleTasks.find((entry) => entry.id === taskId) ?? selectedTask() : selectedTask();
    if (!task) {
      return;
    }
    await navigator.clipboard.writeText(providerErrorForCopy(task));
    voiceStatus.textContent = 'Task error copied.';
  }));
  commandChatFeed.querySelector<HTMLButtonElement>('[data-copy-task-summary]')?.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.copyTaskSummary;
    const task = taskId ? visibleTasks.find((entry) => entry.id === taskId) ?? selectedTask() : selectedTask();
    if (!task) {
      return;
    }
    const summary = summarizeTaskForCopy(task);
    await navigator.clipboard.writeText(summary);
    voiceStatus.textContent = 'Task summary copied.';
  });
  commandChatFeed.querySelector<HTMLButtonElement>('[data-copy-task-commands]')?.addEventListener('click', async (event) => {
    const taskId = (event.currentTarget as HTMLButtonElement).dataset.copyTaskCommands;
    const task = taskId ? visibleTasks.find((entry) => entry.id === taskId) ?? selectedTask() : selectedTask();
    const commands = task?.commandsRun ?? [];
    if (commands.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(commands.join('\n'));
    voiceStatus.textContent = 'Task commands copied.';
  });
}

function summarizeTaskForCopy(task: TaskRecord) {
  const output = stripUiArtifactBlocks(task.output || '').replace(/\s+/g, ' ').trim();
  const shortOutput = output.length > 600 ? `${output.slice(0, 597).trim()}...` : output || 'No response captured.';
  return [
    `Prompt: ${task.prompt}`,
    `Status: ${task.status}${task.phase ? ` / ${task.phase}` : ''}`,
    `Summary: ${shortOutput}`
  ].join('\n');
}

function renderConversationMessage(
  role: 'user' | 'assistant',
  body: string,
  label: string,
  meta: string,
  live: boolean
) {
  const displayText = body.trim() || (live ? '' : 'No content yet.');
  const block = role === 'assistant'
    ? `<pre class="mission-output-stream ${live ? 'is-typing' : ''}">${escapeHtml(displayText)}</pre>`
    : `<p>${escapeHtml(displayText)}</p>`;
  return `
    <section class="conversation-message conversation-message--${role} ${live ? 'is-live' : ''}">
      <div class="conversation-message__meta">
        <span>${escapeHtml(label)}</span>
        <em>${escapeHtml(meta)}</em>
      </div>
      ${block}
    </section>
  `;
}

function renderThinkingSignal(label: string, phase = 'thinking', typing = false) {
  return `
    <div class="thinking-signal thinking-signal--${escapeHtml(phase)} ${typing ? 'is-typing' : ''}" aria-label="${escapeHtml(label)}">
      <span class="thinking-orbit"><i></i><i></i><i></i></span>
      <span class="thinking-copy"><b>${escapeHtml(label)}</b><em>${escapeHtml(phaseSignalDetail(phase))}</em></span>
    </div>
  `;
}

function activeSignalLabel(phase: string) {
  switch (phase) {
    case 'planning':
    case 'thinking':
      return 'Building the approach';
    case 'streaming':
      return 'Typing live response';
    case 'editing':
      return 'Materializing files';
    case 'testing':
      return 'Checking the result';
    default:
      return 'Working the mission';
  }
}

function phaseSignalDetail(phase: string) {
  switch (phase) {
    case 'queued':
      return 'queued in local task bus';
    case 'planning':
    case 'thinking':
      return 'cortex planning pulse';
    case 'streaming':
      return 'token stream active';
    case 'editing':
      return 'artifact field active';
    case 'testing':
      return 'verification sweep';
    default:
      return 'live cognition signal';
  }
}

function renderMissionMemoryContext(task: TaskRecord | null) {
  const remembered = task?.rememberedMemoryIds ?? [];
  const created = task?.createdMemoryIds ?? [];
  const ids = [...new Set([...remembered, ...created])].slice(0, 4);
  if (ids.length === 0) {
    const pinned = visibleMemories.filter((memory) => Number(memory.pinned)).slice(0, 3);
    if (pinned.length === 0) {
      return '<p class="mission-empty">No task-linked memory yet.</p>';
    }
    return pinned.map((memory) => renderMissionMemoryChip(memory, 'Pinned anchor')).join('');
  }
  return ids.map((id) => {
    const memory = visibleMemories.find((entry) => entry.id === id);
    if (!memory) {
      return `<button class="memory-chip memory-chip--missing" type="button" data-memory-jump="${id}">#${id}<span>Stored outside current filter</span></button>`;
    }
    const wasCreated = created.includes(id);
    const relation = wasCreated ? 'Saved after task' : memoryReason(memory);
    return renderMissionMemoryChip(memory, relation, wasCreated);
  }).join('');
}

function renderMissionMemoryChip(memory: MemoryRecord, reason: string, created = false) {
  return `
    <button class="memory-chip ${memory.id === selectedMemoryId ? 'selected' : ''} ${created ? 'memory-chip--created' : ''}" type="button" data-memory-jump="${memory.id}">
      <strong>${escapeHtml(memory.title)}</strong>
      <span>${escapeHtml(memory.kind)} / ${escapeHtml(memory.scope ?? 'project')} / ${Math.round((memory.confidence ?? 1) * 100)}%</span>
      <em>${escapeHtml(reason)}</em>
    </button>
  `;
}

function renderMissionArtifacts(task: TaskRecord | null) {
  if (!task) {
    return '<p class="mission-empty">No artifact stream yet.</p>';
  }
  const sections = [
    renderMissionArtifactGroup('Files', task.filesChanged, task.workspace),
    renderMissionArtifactGroup('Commands', task.commandsRun),
    renderMissionArtifactGroup('Tests', task.testsRun)
  ].filter(Boolean);
  if (sections.length === 0) {
    return `<p class="mission-empty">${task.status === 'running' || task.status === 'queued' ? 'Artifact detection is waiting on agent output.' : 'No files, commands, or tests were captured.'}</p>`;
  }
  return sections.join('');
}

function renderArtifactCatalog() {
  const items = buildArtifactCatalog();
  if (items.length === 0) {
    artifactCatalog.innerHTML = `
      <article class="artifact-empty">
        <span class="micro-label">No artifacts</span>
        <strong>Generated files will appear here</strong>
        <p>Ask Jarvis to build a game, app, page, script, or package and the created files will be grouped by task.</p>
      </article>
    `;
    return;
  }

  const groups = groupBy(items, (item) => item.type);
  artifactCatalog.innerHTML = [...groups.entries()].map(([type, groupItems]) => `
    <section class="artifact-category">
      <header>
        <span class="micro-label">${escapeHtml(type)}</span>
        <strong>${groupItems.length} ${groupItems.length === 1 ? 'artifact' : 'artifacts'}</strong>
      </header>
      <div class="artifact-card-grid">
        ${groupItems.map(renderArtifactCatalogCard).join('')}
      </div>
    </section>
  `).join('');
  wireArtifactOpenButtons(artifactCatalog);
  artifactCatalog.querySelectorAll<HTMLButtonElement>('[data-artifact-continue]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.artifactContinue;
      const item = items.find((entry) => entry.task.id === taskId);
      if (!item) {
        return;
      }
      appendPromptText(`Continue improving ${item.name}. Use the existing artifact files in ${artifactRootForFiles(item.files)}.`);
      setTab('run');
    });
  });
  renderIcons();
}

function buildArtifactCatalog(): ArtifactCatalogItem[] {
  return visibleTasks
    .filter((task) => task.filesChanged?.length)
    .map((task) => {
      const files = task.filesChanged ?? [];
      return {
        task,
        files,
        type: classifyArtifact(task, files),
        name: artifactNameFor(task, files)
      };
    });
}

function renderArtifactCatalogCard(item: ArtifactCatalogItem) {
  return `
    <article class="artifact-card">
      <div class="artifact-card__head">
        <span>${escapeHtml(formatTime(item.task.finishedAt ?? item.task.createdAt))}</span>
        <strong>${escapeHtml(item.name)}</strong>
        <em>${escapeHtml(compactPath(item.task.workspace))}</em>
      </div>
      <div class="artifact-card__files">
        ${item.files.slice(0, 7).map((file) => renderArtifactValue('Files', file, item.task.workspace)).join('')}
        ${item.files.length > 7 ? `<code>+${item.files.length - 7} more</code>` : ''}
      </div>
      <div class="artifact-card__actions">
        <button class="hud-button" type="button" data-artifact-continue="${escapeHtml(item.task.id)}" data-icon="sparkles"><span>Continue</span></button>
      </div>
    </article>
  `;
}

function classifyArtifact(task: TaskRecord, files: string[]) {
  const prompt = task.prompt.toLowerCase();
  const extensions = files.map((file) => file.split('.').pop()?.toLowerCase() ?? '');
  if (extensions.some((ext) => ['exe', 'msi', 'app', 'dmg', 'zip'].includes(ext))) {
    return 'Executable / App Package';
  }
  if (extensions.includes('html') && /\b(game|clone|slither|snake|play)\b/i.test(prompt)) {
    return 'Web Game';
  }
  if (extensions.includes('html')) {
    return 'Web App / Page';
  }
  if (extensions.some((ext) => ['ts', 'tsx', 'js', 'mjs', 'cjs', 'css', 'json'].includes(ext))) {
    return 'Code Project';
  }
  if (extensions.some((ext) => ['md', 'txt', 'csv', 'json', 'yaml', 'yml'].includes(ext))) {
    return 'Docs / Data';
  }
  return 'Unknown';
}

function artifactNameFor(task: TaskRecord, files: string[]) {
  const root = artifactRootForFiles(files);
  if (root && root !== '.') {
    return root.split(/[\\/]/).pop()?.replace(/-/g, ' ') || task.prompt.slice(0, 72);
  }
  return task.prompt.slice(0, 72);
}

function artifactRootForFiles(files: string[]) {
  const first = files[0] ?? '';
  const parts = first.split(/[\\/]/);
  if (parts.length >= 2) {
    return parts.slice(0, -1).join('\\');
  }
  return '.';
}

function renderMissionArtifactGroup(label: string, values: string[] | undefined, workspace?: string) {
  if (!values?.length) {
    return '';
  }
  return `
    <div class="artifact-group">
      <span>${escapeHtml(label)}</span>
      ${values.slice(0, 4).map((value) => renderArtifactValue(label, value, workspace)).join('')}
    </div>
  `;
}

function artifactCountForTask(task: TaskRecord | null) {
  if (!task) {
    return 0;
  }
  return (task.filesChanged?.length ?? 0) + (task.commandsRun?.length ?? 0) + (task.testsRun?.length ?? 0);
}

function missionPhaseLabel(task: TaskRecord | null, phase: string) {
  if (!task) {
    return phase === 'ready' ? 'Ready' : titleCase(phase);
  }
  return `${titleCase(task.status)} / ${titleCase(phase)}`;
}

function missionProgressFor(task: TaskRecord | null, phase: string) {
  if (!task) {
    return phase === 'ready' ? 8 : 18;
  }
  if (task.status === 'completed') return 100;
  if (task.status === 'failed' || task.status === 'timed_out' || task.status === 'cancelled') return 100;
  const progressByPhase: Record<string, number> = {
    queued: 12,
    planning: 34,
    editing: 58,
    testing: 78,
    streaming: 66,
    done: 100
  };
  return progressByPhase[phase] ?? (task.status === 'running' ? 44 : 18);
}

function missionNextActionFor(task: TaskRecord | null, output: string) {
  if (!task) {
    return taskPrompt.value.trim() ? 'Command drafted. Run when ready.' : 'Awaiting operator command.';
  }
  if (isRateLimitOutput(task.output || output)) {
    return 'OpenCode rate-limited this request. Wait, retry, or switch to LM Studio, Ollama, or Codex in Settings.';
  }
  if (task.status === 'queued') {
    return 'Queued. Jarvis will launch when the lane is clear.';
  }
  if (task.status === 'running') {
    return output ? 'Streaming response. Watch artifacts and memory recall.' : 'Agent online. Waiting for first output.';
  }
  if (task.status === 'completed') {
    return task.createdMemoryIds?.length ? 'Task complete. New memory encoded into the cortex.' : 'Task complete. Review artifacts or continue the mission.';
  }
  if (task.status === 'cancelled') {
    return 'Task cancelled. Adjust the prompt or retry from history.';
  }
  if (task.status === 'timed_out') {
    return 'Task timed out. Retry with a smaller objective or check diagnostics.';
  }
  return 'Task needs attention. Review output, provider status, then retry.';
}

function isRateLimitOutput(value: string) {
  return /429|too many requests|rate limit|usage limit/i.test(value);
}

function providerFailureAction(kind: ProviderFailureKind | string | null | undefined) {
  switch (kind) {
    case 'auth':
      return 'Save a valid provider key or retry with Codex CLI.';
    case 'rate_limit':
      return 'Wait for the provider limit to reset or retry with Codex CLI.';
    case 'offline':
      return 'Start the local provider or switch to Codex CLI.';
    case 'model_missing':
      return 'Choose a model reported by provider scan.';
    case 'timeout':
      return 'Retry with a smaller request or switch providers.';
    default:
      return 'Open Diagnostics, copy the error, then retry with another provider.';
  }
}

function providerErrorForCopy(task: TaskRecord) {
  return [
    `Task: ${task.id}`,
    `Prompt: ${task.prompt}`,
    `Status: ${task.status}${task.phase ? ` / ${task.phase}` : ''}`,
    `Provider: ${task.providerUsed ?? config?.localModel?.provider ?? 'unknown'}`,
    `Failure: ${task.failureKind ?? 'unknown'}`,
    `Action: ${task.failureAction ?? providerFailureAction(task.failureKind)}`,
    '',
    stripUiArtifactBlocks(task.output || task.logs || 'No error output captured.')
  ].join('\n');
}

function memoryReason(memory: MemoryRecord) {
  if (Number(memory.pinned)) {
    return 'Pinned high-priority context';
  }
  if (memory.kind === 'preference' || memory.kind === 'constraint') {
    return 'Behavior constraint matched';
  }
  if (memory.scope === 'global') {
    return 'Global recall matched';
  }
  if (memory.importance >= 4) {
    return 'High-importance project memory';
  }
  return 'Relevant project recall';
}

function compactArtifact(value: string) {
  return value
    .replace(taskWorkspace.value, '.')
    .replace(/^D:\\jarvis-neural-command-interface\\/i, '.\\')
    .slice(0, 120);
}

function stripUiArtifactBlocks(value: string) {
  return value
    .replace(/<<FILE:[^>\r\n]+>>\s*[\s\S]*?\s*<<END_FILE>>/gi, '[artifact file]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function statusTitle(status: TaskRecord['status']) {
  const titles: Record<TaskRecord['status'], string> = {
    queued: 'Queued for Codex',
    running: 'Live execution stream',
    completed: 'Mission complete',
    failed: 'Mission needs attention',
    timed_out: 'Mission timed out',
    cancelled: 'Mission cancelled'
  };
  return titles[status];
}

function setTab(tab: string) {
  currentTab = tab;
  document.querySelectorAll<HTMLButtonElement>('[data-console-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.consoleTab === currentTab);
  });
  document.querySelectorAll<HTMLElement>('.console-view').forEach((panel) => {
    const active = panel.dataset.view === currentTab;
    panel.hidden = !active;
    panel.classList.toggle('hidden', !active);
    panel.classList.toggle('active-view', active);
    if (active) {
      gsap.fromTo(panel, { y: 10, opacity: 0, scale: 0.992 }, { y: 0, opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' });
    }
  });
  // Hide task HUD and chat sidebar elements when not on Run tab
  const isRun = tab === 'run';
  document.querySelectorAll('#task-hud, #chat-sidebar-toggle, #chat-session-rail, .workspace-switcher').forEach((el) => {
    (el as HTMLElement).hidden = !isRun;
  });
  if (tab === 'diagnostics') {
    void loadDiagnostics();
    void loadReleaseAssistant();
  }
  if (tab === 'dashboard') {
    void loadDashboard();
  }
  if (tab === 'artifacts') {
    renderArtifactCatalog();
  }
  renderIcons();
}

function animateBoot() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  gsap.from('.command-mast, .voice-dock, .radial-nav', {
    y: 10,
    opacity: 0,
    duration: 0.28,
    stagger: 0.035,
    ease: 'power2.out'
  });
}

function renderIcons() {
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((element) => {
    element.querySelector('svg[data-jarvis-icon]')?.remove();
    const iconName = element.dataset.icon;
    if (!iconName) {
      return;
    }
    const holder = document.createElement('i');
    holder.setAttribute('data-lucide', iconName);
    element.prepend(holder);
  });
  createIcons({
    icons: jarvisIcons,
    attrs: {
      'data-jarvis-icon': 'true',
      'aria-hidden': 'true'
    }
  });
}

function selectedTask() {
  if (reviewingHistoricalTask) {
    return visibleTasks.find((entry) => entry.id === selectedTaskId) ?? null;
  }
  return currentRunningTask ?? visibleTasks.find((entry) => entry.id === selectedTaskId) ?? null;
}

function currentChatTasks(activeTask: TaskRecord | null) {
  if (reviewingHistoricalTask) {
    if (!activeTask?.chatId) {
      return activeTask ? [activeTask] : [];
    }
  }
  const chatId = activeTask?.chatId ?? selectedChatId;
  const tasks = visibleTasks
    .map((task) => activeTask && task.id === activeTask.id ? activeTask : task)
    .filter((task) => chatId ? task.chatId === chatId : false)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (activeTask && !tasks.some((task) => task.id === activeTask.id)) {
    tasks.push(activeTask);
  }
  return tasks.slice(-8);
}

function renderQueueStatus(queue: { paused: boolean; runningTaskId: string | null }) {
  missionQueueLabel = queue.paused ? 'Queue paused' : queue.runningTaskId ? `Running ${shortId(queue.runningTaskId)}` : 'Queue ready';
  queueStatus.textContent = missionQueueLabel;
  renderCommandChat();
}

function scheduleQueuedTaskWatch(task: TaskRecord) {
  clearTaskWatch(task.id);
  queuedWatchTimers.set(task.id, window.setTimeout(async () => {
    queuedWatchTimers.delete(task.id);
    try {
      const data = await fetchJson<{ task: TaskRecord }>(`/api/tasks/${encodeURIComponent(task.id)}`);
      if ((data.task.status === 'queued' || data.task.status === 'running') && !data.task.output.trim()) {
        voiceStatus.textContent = data.task.status === 'queued'
          ? 'Task is still queued. Open Diagnostics if it does not start soon.'
          : 'Task is running but has not streamed output yet.';
        upsertVisibleTask(data.task, selectedTaskId === data.task.id);
        renderCommandChat(true);
      }
    } catch {
      voiceStatus.textContent = 'Task status check failed. Reconnecting live updates.';
      connectEvents();
    }
  }, 30000));
}

function clearTaskWatch(taskId: string) {
  const timer = queuedWatchTimers.get(taskId);
  if (timer) {
    window.clearTimeout(timer);
    queuedWatchTimers.delete(taskId);
  }
}

function renderArtifactList(label: string, values: string[] | undefined, workspace?: string) {
  if (!values?.length) {
    return '';
  }
  return `<p>${label}: ${values.slice(0, 5).map((value) => renderArtifactValue(label, value, workspace)).join(' ')}</p>`;
}

function renderArtifactValue(label: string, value: string, workspace?: string) {
  if (label === 'Files' && workspace) {
    return `
      <button class="artifact-file" type="button" data-artifact-open="${escapeHtml(value)}" data-artifact-workspace="${escapeHtml(workspace)}">
        <code>${escapeHtml(compactArtifact(value))}</code>
        <span>Open</span>
      </button>
    `;
  }
  return `<code>${escapeHtml(compactArtifact(value))}</code>`;
}

function wireArtifactOpenButtons(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('[data-artifact-open]').forEach((button) => {
    button.addEventListener('click', async () => {
      const artifactPath = button.dataset.artifactOpen;
      const workspace = button.dataset.artifactWorkspace || taskWorkspace.value || config?.defaultWorkspace;
      if (!artifactPath || !workspace) {
        return;
      }
      const originalText = button.querySelector('span')?.textContent ?? 'Open';
      button.disabled = true;
      const label = button.querySelector('span');
      if (label) {
        label.textContent = 'Opening';
      }
      try {
        await postJson('/api/artifacts/open', { path: artifactPath, workspace });
        if (label) {
          label.textContent = 'Opened';
        }
      } catch (error) {
        if (label) {
          label.textContent = 'Error';
        }
        voiceStatus.textContent = error instanceof Error ? error.message : 'Unable to open artifact';
      } finally {
        window.setTimeout(() => {
          button.disabled = false;
          if (label) {
            label.textContent = originalText;
          }
        }, 1400);
      }
    });
  });
}

function appendPromptText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  const separator = taskPrompt.value.trim() ? '\n' : '';
  taskPrompt.value = `${taskPrompt.value.trimEnd()}${separator}${trimmed}`;
  taskPrompt.focus();
}

function scheduleVoiceAutoSend(transcript: string) {
  window.clearTimeout(voiceSubmitTimer);
  if (!voiceSettings.autoSendAfterFinalTranscript || !voiceSettings.voiceEnabled) {
    voiceStatus.textContent = 'Voice captured. Review the prompt, then send.';
    return;
  }
  voiceStatus.textContent = 'Voice captured. Sending in one second.';
  voiceSubmitTimer = window.setTimeout(() => {
    if (taskDispatchInFlight || !taskPrompt.value.trim()) {
      return;
    }
    const current = taskPrompt.value.trim().toLowerCase();
    if (!current.includes(transcript.trim().toLowerCase().slice(0, 24))) {
      return;
    }
    void dispatchTask();
  }, 1000);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readError(response, `${url} returned ${response.status}`));
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readError(response, `${url} returned ${response.status}`));
  }
  return response.json() as Promise<T>;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readError(response, `${url} returned ${response.status}`));
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json() as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function compactPath(value: string) {
  return value.replace(/^C:\\Users\\[^\\]+\\/, '~\\');
}

function formatMemoryCount(count: number) {
  return `${count} ${count === 1 ? 'memory' : 'memories'}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function shortId(id: string) {
  return id.split('-')[0] ?? id;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (match) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[match];
  });
}
