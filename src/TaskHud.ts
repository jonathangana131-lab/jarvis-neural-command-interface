import type { TaskRecord } from './types';

export class TaskHud {
  private tasks = new Map<string, TaskRecord>();
  private pendingRender = 0;
  private lastRenderedAt = 0;

  constructor(
    private readonly element: HTMLElement,
    private readonly onCancel?: (taskId: string) => void,
    private readonly onRender?: () => void
  ) {
    this.render();
  }

  upsert(task: TaskRecord) {
    if (!task.id.startsWith('dispatch-')) {
      for (const id of this.tasks.keys()) {
        if (id.startsWith('dispatch-')) {
          this.tasks.delete(id);
        }
      }
    }
    if (task.status === 'running' && !this.tasks.has(task.id)) {
      this.tasks.clear();
    }
    this.tasks.set(task.id, task);
    this.render();
  }

  appendOutput(id: string, output: string, phase?: TaskRecord['phase']) {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    task.output = output;
    if (phase) {
      task.phase = phase;
    }
    this.scheduleRender();
  }

  render() {
    this.lastRenderedAt = performance.now();
    const tasks = [...this.tasks.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 1);

    if (tasks.length === 0) {
      this.element.classList.add('hidden');
      this.element.innerHTML = '';
      this.onRender?.();
      return;
    }

    this.element.classList.remove('hidden');
    this.element.innerHTML = tasks
      .map((task) => task.output.trim().length === 0 ? renderThinking(task) : renderResponse(task))
      .join('');
    this.element.querySelectorAll<HTMLButtonElement>('[data-cancel-task]').forEach((button) => {
      button.addEventListener('click', () => {
        const taskId = button.dataset.cancelTask;
        if (taskId) {
          this.onCancel?.(taskId);
        }
      });
    });
    this.onRender?.();
  }

  private scheduleRender() {
    const now = performance.now();
    if (now - this.lastRenderedAt > 140) {
      this.render();
      return;
    }
    if (this.pendingRender) {
      return;
    }
    this.pendingRender = requestAnimationFrame(() => {
      this.pendingRender = 0;
      this.render();
    });
  }
}

function renderThinking(task: TaskRecord) {
  const active = task.status === 'queued' || task.status === 'running';
  return `
    <article class="operation-card operation-card--thinking ${task.status}" aria-live="polite">
      <div class="operation-card__head">
        <span>Operation channel</span>
        <span class="operation-card__id">${escapeHtml(shortId(task.id))}</span>
      </div>
      <strong class="operation-card__title">${escapeHtml(active ? 'Starting local agent' : statusTitle(task.status))}</strong>
      <p class="operation-card__phase">${escapeHtml(task.phase ?? task.status)}</p>
      <p class="operation-card__prompt">${escapeHtml(task.prompt)}</p>
      ${active ? `<div class="signal-bars" aria-label="Codex is starting">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>` : '<pre class="operation-card__output">No output captured.</pre>'}
      ${active ? `<button type="button" data-icon="octagon-x" data-cancel-task="${escapeHtml(task.id)}"><span>Cancel</span></button>` : ''}
    </article>
  `;
}

function renderResponse(task: TaskRecord) {
  return `
    <article class="operation-card operation-card--response ${task.status}" aria-live="polite">
      <div class="operation-card__head">
        <span>Live response stream</span>
        <span class="operation-card__id">${escapeHtml(shortId(task.id))}</span>
      </div>
      <strong class="operation-card__title">${escapeHtml(statusTitle(task.status))}</strong>
      <p class="operation-card__phase">${escapeHtml(task.phase ?? task.status)}</p>
      <p class="operation-card__prompt">${escapeHtml(task.prompt)}</p>
      <pre class="operation-card__output">${escapeHtml(task.output.slice(-5000))}</pre>
      ${task.status === 'running' ? `<button type="button" data-icon="octagon-x" data-cancel-task="${escapeHtml(task.id)}"><span>Cancel</span></button>` : ''}
    </article>
  `;
}

function statusTitle(status: TaskRecord['status']) {
  const titles: Record<TaskRecord['status'], string> = {
    queued: 'Queued for Codex',
    running: 'Signal receiving',
    completed: 'Task complete',
    failed: 'Task needs attention',
    timed_out: 'Task timed out',
    cancelled: 'Task cancelled'
  };
  return titles[status];
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
