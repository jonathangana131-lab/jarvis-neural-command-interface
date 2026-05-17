import './style.css';
import gsap from 'gsap';
import {
  Activity,
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
  Zap,
  createIcons
} from 'lucide';
import { JarvisScene } from './JarvisScene';
import { MemoryAnimator } from './MemoryAnimator';
import { TaskHud } from './TaskHud';
import { VoiceSession } from './VoiceSession';
import type { AppConfig, AssistantMode, MemoryRecord, ModelKeyStatus, TaskRecord } from './types';

const jarvisIcons = {
  Activity,
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
const chatSessionList = required<HTMLElement>('#chat-session-list');
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
const memoryList = required<HTMLElement>('#memory-list');
const refreshMemory = required<HTMLButtonElement>('#refresh-memory');
const resetMemory = required<HTMLButtonElement>('#reset-memory');
const rememberCurrent = required<HTMLButtonElement>('#remember-current');
const memorySearch = required<HTMLInputElement>('#memory-search');
const memoryScopeFilter = required<HTMLSelectElement>('#memory-scope-filter');
const memoryDetail = required<HTMLElement>('#memory-detail');
const refreshTasks = required<HTMLButtonElement>('#refresh-tasks');
const taskHistoryList = required<HTMLElement>('#task-history-list');
const taskHistoryDetail = required<HTMLElement>('#task-history-detail');
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
const applyModel = required<HTMLButtonElement>('#apply-model');
const refreshDiagnostics = required<HTMLButtonElement>('#refresh-diagnostics');
const diagnosticsList = required<HTMLElement>('#diagnostics-list');
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
    void rememberText(text, 'voice');
  }
});

let config: AppConfig | null = null;
let modeResetTimer = 0;
const animatedMemoryIds = new Set<number>();
let visibleMemories: MemoryRecord[] = [];
let visibleTasks: TaskRecord[] = [];
let selectedMemoryId: number | null = null;
let selectedTaskId: string | null = null;
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
let lastStreamChromeRenderAt = 0;
let lastStreamPulseAt = 0;
let currentRunningTask: TaskRecord | null = null;
let lastMissionSignature = '';
let missionRenderFrame = 0;
let lastMissionRenderAt = 0;
let missionQueueLabel = 'Queue ready';
let taskDispatchInFlight = false;

type ModelProvider = NonNullable<AppConfig['localModel']>['provider'];
type ArtifactCatalogItem = {
  task: TaskRecord;
  type: string;
  name: string;
  files: string[];
};

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
void boot();

voiceToggle.addEventListener('click', async () => {
  try {
    voiceToggle.disabled = true;
    if (voiceSession.connected) {
      await voiceSession.stop();
      voiceToggle.textContent = 'Start Dictation';
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
  startNewChat();
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

async function dispatchTask() {
  if (taskDispatchInFlight) {
    return;
  }
  const prompt = taskPrompt.value.trim();
  if (!prompt) {
    taskPrompt.focus();
    return;
  }
  taskDispatchInFlight = true;
  runTask.disabled = true;
  lastCommandPrompt = prompt;
  lastCommandOutput = '';
  lastCommandPhase = 'queued';
  setMode('executing');
  scene.setResponseActive(true);
  scene.pulseResponse(1.25);
  scene.pulseMemoryGrowth(0.5);
  taskHud.upsert({
    id: `dispatch-${Date.now()}`,
    prompt,
    workspace: taskWorkspace.value,
    status: 'queued',
    phase: 'queued',
    output: '',
    createdAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null
  });

  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, workspace: taskWorkspace.value })
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
    taskPrompt.focus();
    taskHud.upsert(data.task);
    upsertVisibleTask(data.task, true);
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

taskPrompt.addEventListener('input', () => {
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

applyModel.addEventListener('click', () => {
  void applySelectedModel();
});

settingsWorkspace.addEventListener('change', () => {
  taskWorkspace.value = settingsWorkspace.value;
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
  config = await fetchJson<AppConfig>('/api/config');
  setTab('run');
  workspaceLabel.textContent = compactPath(config.defaultWorkspace);
  taskWorkspace.value = config.defaultWorkspace;
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
  memoryCount.textContent = formatMemoryCount(config.memoryCount);
  apiKeyStatus.textContent = config.openAiApiKeyPresent ? 'API key ready' : 'Local login';
  const providerDisplay = settingsModelProvider.value === 'codex' ? 'Codex CLI' : 
                     settingsModelProvider.value === 'opencode' ? 'OpenCode Zen' : 
                     settingsModelProvider.value === 'ollama' ? 'Ollama' : 
                     settingsModelProvider.value === 'lmstudio' ? 'LM Studio' : 'Unknown';
  const modelDisplay = config.localModel?.model ?? config.codexModel ?? '';
  voiceStatus.textContent = `${providerDisplay} / ${modelDisplay}`;
  renderModelPresets();
  renderModelProfile();
  renderModelInstructions();
  void scanLocalModels(false);
  void refreshCodexStatus();
  await loadMemories(true);
  void loadSemanticEdges();
  await loadTasks();
  try {
    await loadDiagnostics();
  } catch (error) {
    voiceStatus.textContent = error instanceof Error ? error.message : 'Diagnostics unavailable';
  }
  renderCommandChat();
  connectEvents();
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
  const events = new EventSource('/api/events');
  events.addEventListener('memory.created', (event) => {
    const memory = JSON.parse((event as MessageEvent).data) as MemoryRecord;
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
    try {
      const payload = JSON.parse((event as MessageEvent).data) as {
        ids?: number[];
        mode?: 'semantic' | 'keyword' | 'manual';
        prompt?: string;
      };
      const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => Number.isFinite(id)) : [];
      if (ids.length === 0) return;
      memoryAnimator.recall(ids, payload.mode ?? 'semantic');
    } catch (error) {
      console.warn('[orb] malformed memory.recalled payload', error);
    }
  });
  events.addEventListener('memory.edges.updated', () => {
    scheduleSemanticEdgeRefresh(350);
  });
  events.addEventListener('task.started', (event) => {
    const task = JSON.parse((event as MessageEvent).data) as TaskRecord;
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
    renderCommandChat(true);
    taskHud.upsert(task);
    renderIcons();
    renderChatSessions();
    void refreshQueueStatus();
  });
  events.addEventListener('task.queued', (event) => {
    const task = JSON.parse((event as MessageEvent).data) as TaskRecord;
    setMode(modeForTaskPhase(task.phase ?? 'queued'));
    scene.setTaskPhase(task.phase ?? 'queued');
    scene.setResponseActive(true);
    scene.pulseResponse(0.72);
    lastCommandPrompt = task.prompt;
    lastCommandPhase = task.phase ?? task.status;
    currentRunningTask = task;
    selectedTaskId = task.id;
    renderCommandChat(true);
    renderChatSessions();
    void refreshQueueStatus();
  });
  events.addEventListener('task.output', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { id: string; output: string; phase?: TaskRecord['phase'] };
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
    const task = JSON.parse((event as MessageEvent).data) as TaskRecord;
    const wasSelected = selectedTaskId === task.id;
    upsertVisibleTask(task, wasSelected);
    if (wasSelected) {
      lastCommandPhase = task.phase ?? task.status;
      lastCommandOutput = task.output;
      renderCommandChat(true);
    }
  });
  events.addEventListener('task.finished', (event) => {
    const task = JSON.parse((event as MessageEvent).data) as TaskRecord;
    const wasSelected = selectedTaskId === task.id;
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
    } else if (/usage limit/i.test(task.output)) {
      voiceStatus.textContent = 'Codex usage limit reached; retry after the reset time.';
    }
    void loadMemories(false);
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
    renderQueueStatus(JSON.parse((event as MessageEvent).data) as { paused: boolean; runningTaskId: string | null });
  });
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
  const unique = uniqueMemories(data.memories).filter(isRealMemory);
  visibleMemories = unique;
  if (selectedMemoryId !== null && !visibleMemories.some((memory) => memory.id === selectedMemoryId)) {
    selectedMemoryId = null;
    scene.setSelectedMemory(null);
  }
  memoryCount.textContent = formatMemoryCount(unique.length);
  renderMemories(unique);
  renderMemoryDetail();
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
  }
  renderTaskHistory();
  renderArtifactCatalog();
  renderChatSessions();
  renderCommandChat();
}

async function loadDiagnostics() {
  const data = await fetchJson<{
    codex: { available: boolean; detail: string };
    localModel: { available: boolean; detail: string; provider: string; endpoint: string; models: string[] };
    modelKey: ModelKeyStatus;
    voice: { speechRecognition: string; microphone: string; detail: string };
    config: AppConfig;
    sqlite: { databasePath: string; exists: boolean; memoryCount: number; taskCount: number };
    queue: { paused: boolean; runningTaskId: string | null };
  }>('/api/diagnostics');
  diagnosticsList.innerHTML = `
    <article><strong>Codex</strong><span>${data.codex.available ? 'Available' : 'Unavailable'}</span><p>${escapeHtml(data.codex.detail)}</p></article>
    <article><strong>Model</strong><span>${escapeHtml(data.config.codexModel ?? 'default')}</span><p>${escapeHtml([data.config.codexCommand, data.config.codexReasoningEffort, data.config.codexEphemeral ? 'ephemeral' : 'persistent'].filter(Boolean).join(' / '))}</p></article>
    <article><strong>OpenCode Key</strong><span>${data.modelKey.present ? 'Ready' : 'Missing'}</span><p>${escapeHtml(data.modelKey.present ? `Loaded from ${data.modelKey.source}.` : 'Save a key in Settings to scan hosted models.')}</p></article>
    <article><strong>Model Router</strong><span>${data.localModel.available ? 'Connected' : 'Offline'}</span><p>${escapeHtml(`${data.localModel.provider} / ${data.localModel.endpoint} / ${data.localModel.detail}`)}</p></article>
    <article><strong>Voice</strong><span>Browser scoped</span><p>${escapeHtml(voiceCapabilityLabel())}</p></article>
    <article><strong>SQLite</strong><span>${data.sqlite.exists ? 'Ready' : 'Missing'}</span><p>${escapeHtml(data.sqlite.databasePath)}</p></article>
    <article><strong>Queue</strong><span>${data.queue.paused ? 'Paused' : 'Active'}</span><p>${data.queue.runningTaskId ? `Running ${escapeHtml(data.queue.runningTaskId)}` : 'No active task'}</p></article>
  `;
  renderIcons();
  renderQueueStatus(data.queue);
}

async function refreshQueueStatus() {
  const data = await fetchJson<{ queue: { paused: boolean; runningTaskId: string | null } }>('/api/queue');
  renderQueueStatus(data.queue);
}

async function scanLocalModels(showScanning: boolean) {
  const provider = localProvider();
  const endpoint = settingsModelEndpoint.value.trim() || defaultLocalEndpoint(provider);
  settingsModelEndpoint.value = endpoint;
  if (showScanning) {
    modelConnectionStatus.value = provider === 'opencode' && !config?.modelKey?.present ? 'Missing key' : 'Scanning...';
  }
  const previous = settingsLocalModel.value || config?.localModel?.model || '';
  const params = new URLSearchParams({ provider, endpoint });
  const data = await fetchJson<{
    provider: ModelProvider;
    endpoint: string;
    available: boolean;
    models: string[];
    detail: string;
  }>(`/api/local-models?${params.toString()}`);
  modelConnectionStatus.value = modelConnectionLabel(data.available, data.detail);
  if (data.models.length === 0) {
    settingsLocalModel.innerHTML = '<option value="">No models detected</option>';
  } else {
    settingsLocalModel.innerHTML = data.models
      .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(modelDisplayName(model))}</option>`)
      .join('');
    settingsLocalModel.value = data.models.includes(previous) ? previous : data.models[0];
  }
  await saveLocalModelSelection();
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
  modelPresetGrid.innerHTML = opencodeZenModelPresets
    .map((preset) => `
      <button type="button" class="model-preset-card ${preset.id === selected ? 'selected' : ''}" data-model-preset="${escapeHtml(preset.id)}" data-icon="${preset.icon}">
        <span>${escapeHtml(preset.name)}</span>
        <strong>${escapeHtml(preset.note)}</strong>
      </button>
    `)
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
     .map((memory) => `
       <article class="data-node ${memory.id === selectedMemoryId ? 'selected crystal-active' : ''}">
         <div class="data-node__meta">
           <strong>${escapeHtml(memory.title)}</strong>
           <span>${escapeHtml(memory.kind)} / ${memory.importance}${memory.confidence ? ` / ${Math.round(memory.confidence * 100)}%` : ''}</span>
         </div>
         <p>${escapeHtml(memory.content)}</p>
         <button class="hud-button" type="button" data-icon="trash-2" data-delete-memory="${memory.id}"><span>Delete</span></button>
       </article>
     `)
    .join('');

  memoryList.querySelectorAll<HTMLButtonElement>('[data-delete-memory]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      await fetch(`/api/memories/${button.dataset.deleteMemory}`, { method: 'DELETE' });
      await loadMemories(true);
    });
  });
  memoryList.querySelectorAll<HTMLElement>('.data-node').forEach((item, index) => {
    item.addEventListener('click', () => selectMemory(memories[index].id));
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
    upsertVisibleTask(data.task, true);
  }
}

function upsertVisibleTask(task: TaskRecord, select: boolean) {
  visibleTasks = [task, ...visibleTasks.filter((entry) => entry.id !== task.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
  if (select) {
    selectedTaskId = task.id;
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
        renderTaskHistory();
        renderChatSessions();
        renderCommandChat(true);
      }
    });
  });

  renderTaskDetail();
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
  memoryDetail.innerHTML = `
    <span>${escapeHtml(memory.kind)} / ${escapeHtml(memory.scope ?? 'project')} / ${memory.importance}${memory.confidence ? ` / ${Math.round(memory.confidence * 100)}%` : ''}</span>
    <input id="memory-edit-title" value="${escapeHtml(memory.title)}" />
    <textarea id="memory-edit-content">${escapeHtml(memory.content)}</textarea>
    <div class="memory-edit-row">
      <select id="memory-edit-scope">
        <option value="project" ${memory.scope !== 'global' ? 'selected' : ''}>Project</option>
        <option value="global" ${memory.scope === 'global' ? 'selected' : ''}>Global</option>
      </select>
      <button type="button" id="pin-memory" data-icon="pin"><span>${Number(memory.pinned) ? 'Unpin' : 'Pin'}</span></button>
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

function startNewChat() {
  selectedTaskId = null;
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
  taskPrompt.focus();
}

function selectRunChat(taskId: string) {
  if (!visibleTasks.some((task) => task.id === taskId)) {
    return;
  }
  selectedTaskId = taskId;
  const task = selectedTask();
  lastCommandPrompt = task?.prompt ?? '';
  lastCommandOutput = streamTaskId === taskId ? streamVisibleOutput : task?.output ?? '';
  lastCommandPhase = task?.phase ?? task?.status ?? 'ready';
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
  newChat.classList.toggle('active', selectedTaskId === null);
  const completedTasks = visibleTasks.filter((t) => t.status !== 'running' && t.status !== 'queued');
  if (completedTasks.length === 0) {
    chatSessionList.innerHTML = '<div class="chat-session-empty">No saved chats yet.</div>';
    return;
  }

  chatSessionList.innerHTML = completedTasks
    .slice(0, 18)
    .map(renderChatSessionButton)
    .join('');

  chatSessionList.querySelectorAll<HTMLButtonElement>('[data-run-chat-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.runChatId;
      if (taskId) {
        selectRunChat(taskId);
      }
    });
  });
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

function renderChatSessionButton(task: TaskRecord) {
  const active = task.id === selectedTaskId;
  const live = task.status === 'running' || task.status === 'queued';
  const output = stripUiArtifactBlocks(task.output || '').trim();
  const preview = output || (live ? 'Waiting for the first live response.' : 'No response captured yet.');
  return `
    <button class="chat-session ${active ? 'active' : ''} ${live ? 'is-live' : ''}" type="button" data-run-chat-id="${escapeHtml(task.id)}">
      <span class="chat-session__status">${escapeHtml(sessionStatusLabel(task))}</span>
      <strong>${escapeHtml(compactSessionTitle(task.prompt))}</strong>
      <em>${escapeHtml(formatTime(task.createdAt))} / ${escapeHtml(task.phase ?? task.status)}</em>
      <p>${escapeHtml(preview)}</p>
    </button>
  `;
}

function sessionStatusLabel(task: TaskRecord) {
  if (task.status === 'running') return 'Live';
  if (task.status === 'queued') return 'Queued';
  if (task.status === 'completed') return 'Done';
  if (task.status === 'cancelled') return 'Stopped';
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
  const timeline = renderMissionTimeline(latestTask, output, promptPreview, statusText, phase);
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

  missionMemoryContext.querySelectorAll<HTMLButtonElement>('[data-memory-jump]').forEach((button) => {
    button.addEventListener('click', () => {
      const memoryId = Number(button.dataset.memoryJump);
      if (Number.isFinite(memoryId)) {
        selectMemory(memoryId);
      }
    });
  });
  wireArtifactOpenButtons(missionArtifacts);

  // Restore scroll positions after re-render, auto-scroll to bottom when task is live
  const isTaskLive = latestTask?.status === 'running' || latestTask?.status === 'queued';
  const conversationStreams = commandChatFeed.querySelectorAll('.conversation-stream');
  conversationStreams.forEach((stream) => {
    const el = stream as HTMLElement;
    const key = el.dataset.streamTask ?? 'default';
    const saved = scrollPositions.get(key);
    if (isTaskLive && (saved?.atBottom ?? true)) {
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
  output: string,
  promptPreview: string,
  statusText: string,
  phase: string
) {
  const taskStatus = task?.status ?? 'idle';
  const live = task?.status === 'running' || task?.status === 'queued';
  const conversation = renderMissionConversation(task, output, promptPreview, statusText, phase);

  return `
    <article class="mission-event mission-event--response mission-event--${escapeHtml(taskStatus)} ${live ? 'is-live' : ''}" ${task ? `data-task-id="${escapeHtml(task.id)}"` : ''}>
      <div class="conversation-header">
        <span>${escapeHtml(statusText)} / ${escapeHtml(phase)}</span>
        <strong>${escapeHtml(task ? statusTitle(task.status) : 'Awaiting mission')}</strong>
      </div>
      <div class="conversation-stream ${live ? 'is-live' : ''}" ${task ? `data-stream-task="${escapeHtml(task.id)}"` : ''}>
        ${conversation}
      </div>
    </article>
  `;
}

function renderMissionConversation(
  task: TaskRecord | null,
  output: string,
  promptPreview: string,
  statusText: string,
  phase: string
) {
  const messages: string[] = [];

  if (task) {
    // Only show the current active task's conversation
    const activeOutput = output || task.output || '';
    messages.push(renderConversationMessage('user', task.prompt, 'You', formatTime(task.createdAt), false));
    if (task.status === 'queued' || task.status === 'running') {
      messages.push(renderThinkingSignal(
        activeOutput ? activeSignalLabel(phase) : 'Thinking through the mission',
        phase,
        Boolean(activeOutput)
      ));
    }
    const cleanOutput = stripUiArtifactBlocks(activeOutput).trim();
    const assistantBody = cleanOutput
      ? cleanOutput.slice(task.status === 'running' ? -3600 : -1400)
      : task.status === 'queued'
        ? 'Queued for the local agent.'
        : task.status === 'running'
          ? ''
          : 'No response captured for this run.';
    messages.push(renderConversationMessage('assistant', assistantBody, 'Jarvis', task.phase ?? task.status, task.status === 'running'));
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
  document.querySelectorAll('#task-hud, #chat-sidebar-toggle, #chat-session-rail').forEach((el) => {
    (el as HTMLElement).hidden = !isRun;
  });
  if (tab === 'diagnostics') {
    void loadDiagnostics();
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
  return currentRunningTask ?? visibleTasks.find((entry) => entry.id === selectedTaskId) ?? null;
}

function renderQueueStatus(queue: { paused: boolean; runningTaskId: string | null }) {
  missionQueueLabel = queue.paused ? 'Queue paused' : queue.runningTaskId ? `Running ${shortId(queue.runningTaskId)}` : 'Queue ready';
  queueStatus.textContent = missionQueueLabel;
  renderCommandChat();
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
