import { compactPath, escapeHtml, formatBytes, formatTime } from '../core/format';
import type { ChatSessionRecord, TaskRecord, TaskMode, WorkspaceIntelligence } from '../types';

export type WorkspaceSummaryReport = {
  current: string;
  items: Array<{ path: string; label: string; allowed: boolean; exists: boolean; current: boolean }>;
};

export type WorkspaceIntelDashboardReport = {
  version: string;
  workspace: string;
  chats: ChatSessionRecord[];
  tasks: TaskRecord[];
  memory: { count: number; embeddings: { ready?: boolean; disabled?: boolean; lastError?: string | null } };
  queue: { paused: boolean; runningTaskId: string | null; queuedCount?: number; reason?: string };
  update: { currentVersion: string; latestVersion: string; updateAvailable: boolean; error?: string | null };
  storage: { totalSize: number; updatesSize: number; backupsSize: number; logsSize: number; dataDir: string };
  workspaces: WorkspaceSummaryReport;
  intelligence: WorkspaceIntelligence;
};

type WorkspaceIntelligenceViewOptions = {
  root: HTMLElement;
  onRun: () => void;
  onRelease: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenTask: (taskId: string) => void;
  onCompose: (prompt: string, mode?: TaskMode) => void;
  onRescan: () => void;
  onRendered?: () => void;
};

export class WorkspaceIntelligenceView {
  #options: WorkspaceIntelligenceViewOptions;

  constructor(options: WorkspaceIntelligenceViewOptions) {
    this.#options = options;
  }

  render(data: WorkspaceIntelDashboardReport) {
    const intel = data.intelligence;
    const activeTask = data.tasks.find((task) => task.status === 'running' || task.status === 'queued');
    const dominantLanguage = intel.languages[0];
    const stack = intel.stack.map((entry) => `
      <span class="stack-chip" title="${escapeHtml(`${entry.kind} / ${entry.source}`)}">
        <i></i>${escapeHtml(entry.name)}<small>${escapeHtml(entry.kind)}</small>
      </span>
    `).join('') || '<p class="dashboard-empty">No framework signals detected yet.</p>';
    const languages = intel.languages.slice(0, 7).map((language) => `
      <li>
        <span><i style="--language-color:${escapeHtml(language.color)}"></i>${escapeHtml(language.name)}</span>
        <div><b style="width:${Math.max(3, language.percent)}%;--language-color:${escapeHtml(language.color)}"></b></div>
        <em>${language.percent}%</em>
      </li>
    `).join('') || '<li class="dashboard-empty">No source languages detected.</li>';
    const signals = intel.signals.map((signal) => `
      <li data-level="${escapeHtml(signal.level)}">
        <i></i><div><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.detail)}</p></div>
      </li>
    `).join('');
    const scripts = intel.scripts.slice(0, 7).map((script) => `
      <button type="button" data-intel-script="${escapeHtml(script.command)}">
        <span>${escapeHtml(script.name)}</span><code>${escapeHtml(script.command)}</code><i>↗</i>
      </button>
    `).join('') || '<p class="dashboard-empty">No runnable project scripts detected.</p>';
    const recentFiles = intel.recentFiles.slice(0, 6).map((file) => `
      <li><span>${escapeHtml(file.path)}</span><em>${escapeHtml(file.language ?? formatBytes(file.size))} / ${escapeHtml(formatTime(file.updatedAt))}</em></li>
    `).join('') || '<li class="dashboard-empty">No recent project files detected.</li>';
    const recentOperations = data.tasks.slice(0, 4).map((task) => `
      <button type="button" data-dashboard-task="${escapeHtml(task.id)}">
        <i data-status="${escapeHtml(task.status)}"></i>
        <span><strong>${escapeHtml(compactTitle(task.prompt))}</strong><small>${escapeHtml(task.taskMode ?? 'standard')} / ${escapeHtml(formatTime(task.createdAt))}</small></span>
      </button>
    `).join('') || '<p class="dashboard-empty">No missions recorded yet.</p>';
    const gitSummary = intel.git.available
      ? `${intel.git.dirty ? `${intel.metrics.dirtyFiles} local changes` : 'Clean worktree'}${intel.git.ahead ? ` / ${intel.git.ahead} ahead` : ''}${intel.git.behind ? ` / ${intel.git.behind} behind` : ''}`
      : 'No Git repository detected';

    this.#options.root.innerHTML = `
      <article class="intel-hero dashboard-card">
        <div class="intel-hero__identity">
          <span class="micro-label">Workspace Intelligence / ${escapeHtml(data.version)}</span>
          <strong>${escapeHtml(intel.identity.name)}</strong>
          <p>${escapeHtml(intel.identity.description)}</p>
          <div class="intel-hero__chips">
            <span>${escapeHtml(intel.identity.kind)}</span>
            <span>${escapeHtml(intel.git.branch ?? 'Local workspace')}</span>
            <span>${escapeHtml(dominantLanguage?.name ?? 'Mixed stack')}</span>
          </div>
          <div class="dashboard-actions">
            <button class="hud-button hud-button--primary" type="button" data-dashboard-run data-icon="terminal-square"><span>Launch Mission</span></button>
            <button class="hud-button" type="button" data-intel-rescan data-icon="scan-line"><span>Rescan Workspace</span></button>
            <button class="hud-button" type="button" data-intel-audit data-icon="brain"><span>Plan Deep Audit</span></button>
          </div>
        </div>
        <div class="readiness-orbit" style="--readiness:${intel.score * 3.6}deg" data-grade="${readinessGrade(intel.score)}">
          <div><strong>${intel.score}</strong><span>Mission ready</span></div>
        </div>
        <div class="intel-hero__telemetry">
          <span><b>${intel.metrics.files.toLocaleString()}</b>Files mapped</span>
          <span><b>${intel.metrics.testFiles.toLocaleString()}</b>Tests detected</span>
          <span><b>${intel.metrics.todoCount.toLocaleString()}</b>Code markers</span>
          <span><b>${intel.metrics.dirtyFiles.toLocaleString()}</b>Git changes</span>
        </div>
      </article>

      <article class="operator-card dashboard-card">
        <div class="dashboard-card__head"><span class="micro-label">Operator State</span><i class="live-indicator"></i></div>
        <strong>${escapeHtml(activeTask ? 'Mission in flight' : data.queue.paused ? 'Queue paused' : 'Core standing by')}</strong>
        <p>${escapeHtml(activeTask ? compactTitle(activeTask.prompt) : `${data.memory.count} memory nodes online / ${data.queue.queuedCount ?? 0} missions waiting`)}</p>
        <dl class="operator-vitals">
          <div><dt>Neural memory</dt><dd>${data.memory.count}</dd></div>
          <div><dt>Storage</dt><dd>${escapeHtml(formatBytes(data.storage.totalSize))}</dd></div>
          <div><dt>Release</dt><dd>${escapeHtml(data.update.updateAvailable ? data.update.latestVersion : 'Current')}</dd></div>
        </dl>
        <button class="text-action" type="button" data-dashboard-release>Open release systems <span>→</span></button>
      </article>

      <article class="language-card dashboard-card dashboard-card--wide">
        <div class="dashboard-card__head"><div><span class="micro-label">Source Topology</span><strong>Language distribution</strong></div><em>${intel.metrics.sourceFiles} source files</em></div>
        <ul class="language-spectrum">${languages}</ul>
      </article>

      <article class="stack-card dashboard-card">
        <div class="dashboard-card__head"><div><span class="micro-label">System Map</span><strong>Detected stack</strong></div><em>${intel.stack.length} signals</em></div>
        <div class="stack-cloud">${stack}</div>
      </article>

      <article class="signals-card dashboard-card dashboard-card--wide">
        <div class="dashboard-card__head"><div><span class="micro-label">Readiness Analysis</span><strong>Mission signals</strong></div><em>${intel.scan.durationMs} ms scan</em></div>
        <ul class="readiness-signals">${signals}</ul>
      </article>

      <article class="scripts-card dashboard-card">
        <div class="dashboard-card__head"><div><span class="micro-label">Execution Surface</span><strong>Project commands</strong></div><em>Click to compose</em></div>
        <div class="script-launcher">${scripts}</div>
      </article>

      <article class="git-card dashboard-card">
        <div class="dashboard-card__head"><div><span class="micro-label">Version Control</span><strong>${escapeHtml(intel.git.branch ?? 'Untracked')}</strong></div><em>${intel.git.dirty ? 'Modified' : 'Synced'}</em></div>
        <p>${escapeHtml(gitSummary)}</p>
        ${intel.git.lastCommit ? `<div class="last-commit"><code>${escapeHtml(intel.git.lastCommit.hash)}</code><span>${escapeHtml(intel.git.lastCommit.subject)}</span></div>` : ''}
        <div class="git-matrix"><span><b>${intel.git.staged}</b>Staged</span><span><b>${intel.git.changed}</b>Changed</span><span><b>${intel.git.untracked}</b>Untracked</span></div>
      </article>

      <article class="recent-files-card dashboard-card">
        <div class="dashboard-card__head"><div><span class="micro-label">Workspace Pulse</span><strong>Recent files</strong></div><em>${escapeHtml(compactPath(data.workspace))}</em></div>
        <ul class="recent-files">${recentFiles}</ul>
      </article>

      <article class="operations-card dashboard-card dashboard-card--wide">
        <div class="dashboard-card__head"><div><span class="micro-label">Mission History</span><strong>Recent operations</strong></div><em>${data.chats.length} active chats</em></div>
        <div class="recent-operations">${recentOperations}</div>
      </article>
    `;

    this.#bindEvents();
    this.#options.onRendered?.();
  }

  #bindEvents() {
    const root = this.#options.root;
    root.querySelector('[data-dashboard-run]')?.addEventListener('click', this.#options.onRun);
    root.querySelector('[data-dashboard-release]')?.addEventListener('click', this.#options.onRelease);
    root.querySelector('[data-intel-rescan]')?.addEventListener('click', this.#options.onRescan);
    root.querySelector('[data-intel-audit]')?.addEventListener('click', () => {
      this.#options.onCompose('Audit this entire workspace. Find the highest-impact architecture, reliability, performance, and product-quality improvements; implement the strongest fixes and verify the full result.', 'deep');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-dashboard-task]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.dashboardTask) this.#options.onOpenTask(button.dataset.dashboardTask);
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-dashboard-chat]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.dashboardChat) this.#options.onOpenChat(button.dataset.dashboardChat);
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-intel-script]').forEach((button) => {
      button.addEventListener('click', () => {
        const command = button.dataset.intelScript;
        if (command) this.#options.onCompose(`Run ${command}, resolve any failures, and summarize the verification evidence.`, /package|test|build/.test(command) ? 'standard' : 'quick');
      });
    });
  }
}

function compactTitle(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 72 ? `${clean.slice(0, 69).trim()}…` : clean;
}

function readinessGrade(score: number) {
  return score >= 85 ? 'prime' : score >= 65 ? 'watch' : 'risk';
}
