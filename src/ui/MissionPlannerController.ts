import { postJson } from '../core/http';
import { escapeHtml } from '../core/format';
import type { MissionBrief, TaskMode } from '../types';

type MissionPlannerOptions = {
  prompt: HTMLTextAreaElement;
  workspace: HTMLInputElement;
  briefRoot: HTMLElement;
  modeRoot: HTMLElement;
  quickCompatibilityInput?: HTMLInputElement;
  onModeChange?: (mode: TaskMode) => void;
};

const STORAGE_KEY = 'jarvis.execution.mode.v1';

export class MissionPlannerController {
  #prompt: HTMLTextAreaElement;
  #workspace: HTMLInputElement;
  #briefRoot: HTMLElement;
  #modeRoot: HTMLElement;
  #quickCompatibilityInput?: HTMLInputElement;
  #onModeChange?: (mode: TaskMode) => void;
  #mode: TaskMode;
  #timer = 0;
  #requestId = 0;
  #lastSignature = '';
  #brief: MissionBrief | null = null;

  constructor(options: MissionPlannerOptions) {
    this.#prompt = options.prompt;
    this.#workspace = options.workspace;
    this.#briefRoot = options.briefRoot;
    this.#modeRoot = options.modeRoot;
    this.#quickCompatibilityInput = options.quickCompatibilityInput;
    this.#onModeChange = options.onModeChange;
    this.#mode = normalizeMode(localStorage.getItem(STORAGE_KEY));

    this.#modeRoot.querySelectorAll<HTMLButtonElement>('[data-task-mode]').forEach((button) => {
      button.addEventListener('click', () => this.setMode(normalizeMode(button.dataset.taskMode)));
    });
    this.#briefRoot.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const apply = target.closest<HTMLButtonElement>('[data-apply-mission-mode]');
      if (apply) this.setMode(normalizeMode(apply.dataset.applyMissionMode));
      if (target.closest('[data-refresh-mission-brief]')) void this.plan({ force: true });
    });
    this.#prompt.addEventListener('input', () => this.schedule());
    this.#workspace.addEventListener('change', () => this.schedule({ immediate: true }));
    this.#workspace.addEventListener('blur', () => this.schedule({ immediate: true }));

    this.#syncModeControls();
    this.renderIdle();
  }

  get mode() {
    return this.#mode;
  }

  get brief() {
    return this.#brief;
  }

  setMode(mode: TaskMode, { replan = true }: { replan?: boolean } = {}) {
    this.#mode = normalizeMode(mode);
    localStorage.setItem(STORAGE_KEY, this.#mode);
    this.#syncModeControls();
    this.#onModeChange?.(this.#mode);
    if (replan) this.schedule({ immediate: true });
  }

  syncTaskMode(mode: string | null | undefined) {
    this.setMode(normalizeMode(mode), { replan: true });
  }

  schedule({ immediate = false }: { immediate?: boolean } = {}) {
    window.clearTimeout(this.#timer);
    if (this.#prompt.value.trim().length < 8) {
      this.#requestId += 1;
      this.#lastSignature = '';
      this.#brief = null;
      this.renderIdle();
      return;
    }
    this.#timer = window.setTimeout(() => void this.plan(), immediate ? 0 : 520);
  }

  async plan({ force = false }: { force?: boolean } = {}) {
    const prompt = this.#prompt.value.trim();
    const workspace = this.#workspace.value.trim();
    if (prompt.length < 8 || !workspace) {
      this.renderIdle();
      return;
    }
    const signature = `${this.#mode}\n${workspace}\n${prompt}`;
    if (!force && signature === this.#lastSignature && this.#brief) return;
    const requestId = ++this.#requestId;
    this.renderLoading();
    try {
      const data = await postJson<{ brief: MissionBrief }>('/api/mission/brief', {
        prompt,
        workspace,
        mode: this.#mode
      });
      if (requestId !== this.#requestId) return;
      this.#lastSignature = signature;
      this.#brief = data.brief;
      this.renderBrief(data.brief);
    } catch (error) {
      if (requestId !== this.#requestId) return;
      this.renderError(error instanceof Error ? error.message : 'Mission planning unavailable.');
    }
  }

  renderIdle() {
    this.#briefRoot.dataset.state = 'idle';
    this.#briefRoot.innerHTML = `
      <div class="mission-brief__head">
        <div><span class="micro-label">Neural Preflight</span><strong>Mission brief</strong></div>
        <span class="mission-brief__state"><i></i> Standing by</span>
      </div>
      <p class="mission-brief__empty">Describe a mission and Jarvis will map scope, execution phases, workspace signals, and safety rails before launch.</p>
      <div class="mission-brief__skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
    `;
  }

  renderLoading() {
    this.#briefRoot.dataset.state = 'loading';
    this.#briefRoot.innerHTML = `
      <div class="mission-brief__head">
        <div><span class="micro-label">Neural Preflight</span><strong>Mapping mission</strong></div>
        <span class="mission-brief__state"><i></i> Analyzing</span>
      </div>
      <p class="mission-brief__empty">Reading workspace structure and calculating a safe execution route.</p>
      <div class="mission-brief__skeleton" aria-hidden="true"><i></i><i></i><i></i></div>
    `;
  }

  renderBrief(brief: MissionBrief) {
    this.#briefRoot.dataset.state = 'ready';
    const recommendation = brief.recommendedMode !== brief.selectedMode
      ? `<button type="button" class="mission-mode-recommendation" data-apply-mission-mode="${escapeHtml(brief.recommendedMode)}">Use ${escapeHtml(capitalize(brief.recommendedMode))}</button>`
      : '<span class="mission-mode-recommendation mission-mode-recommendation--active">Profile aligned</span>';
    const phases = brief.phases.map((phase) => `
      <li>
        <span>${String(phase.index).padStart(2, '0')}</span>
        <div><strong>${escapeHtml(phase.title)}</strong><p>${escapeHtml(phase.detail)}</p></div>
      </li>
    `).join('');
    const signals = brief.workspaceSignals.map((signal) => `
      <span class="mission-signal" data-tone="${escapeHtml(signal.tone)}"><b>${escapeHtml(signal.label)}</b>${escapeHtml(signal.value)}</span>
    `).join('');

    this.#briefRoot.innerHTML = `
      <div class="mission-brief__head">
        <div><span class="micro-label">Neural Preflight</span><strong>${escapeHtml(brief.intent.label)}</strong></div>
        <span class="complexity-badge" data-level="${escapeHtml(brief.complexity.level)}">${brief.complexity.score} / 100</span>
      </div>
      <p class="mission-brief__objective">${escapeHtml(brief.objective)}</p>
      <div class="mission-brief__signals">${signals}</div>
      <ol class="mission-brief__phases">${phases}</ol>
      <div class="mission-brief__foot">
        <span>${escapeHtml(brief.estimatedScope.scale)} / ${escapeHtml(brief.estimatedScope.verification)}</span>
        ${recommendation}
        <button type="button" class="mission-brief__refresh" data-refresh-mission-brief aria-label="Refresh mission brief">↻</button>
      </div>
    `;
  }

  renderError(message: string) {
    this.#briefRoot.dataset.state = 'error';
    this.#briefRoot.innerHTML = `
      <div class="mission-brief__head">
        <div><span class="micro-label">Neural Preflight</span><strong>Planning interrupted</strong></div>
        <button type="button" class="mission-brief__refresh" data-refresh-mission-brief>Retry</button>
      </div>
      <p class="mission-brief__empty">${escapeHtml(message)}</p>
    `;
  }

  #syncModeControls() {
    this.#modeRoot.querySelectorAll<HTMLButtonElement>('[data-task-mode]').forEach((button) => {
      const active = button.dataset.taskMode === this.#mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (this.#quickCompatibilityInput) this.#quickCompatibilityInput.checked = this.#mode === 'quick';
    this.#modeRoot.dataset.mode = this.#mode;
  }
}

function normalizeMode(mode: string | null | undefined): TaskMode {
  return mode === 'quick' || mode === 'deep' ? mode : 'standard';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
