type ShellControllerOptions = {
  root: HTMLElement;
  clock: HTMLElement;
};

const viewTitles: Record<string, string> = {
  run: 'Neural Command',
  dashboard: 'Project Intelligence',
  history: 'Mission Archive',
  artifacts: 'Artifact Vault',
  memory: 'Memory Matrix',
  settings: 'System Configuration',
  diagnostics: 'System Diagnostics'
};

export class ShellController {
  private animationFrame = 0;

  constructor(private readonly options: ShellControllerOptions) {
    this.updateClock();
    window.setInterval(() => this.updateClock(), 15_000);
    window.addEventListener('pointermove', (event) => this.trackPointer(event), { passive: true });
  }

  setView(view: string) {
    this.options.root.dataset.view = view;
    document.querySelectorAll<HTMLButtonElement>('[data-console-tab]').forEach((button) => {
      const selected = button.dataset.consoleTab === view;
      button.setAttribute('aria-current', selected ? 'page' : 'false');
      button.setAttribute('aria-selected', String(selected));
    });
    document.title = `Jarvis — ${viewTitles[view] ?? 'Neural Command Interface'}`;
  }

  private updateClock() {
    const now = new Date();
    this.options.clock.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    this.options.clock.setAttribute('datetime', now.toISOString());
  }

  private trackPointer(event: PointerEvent) {
    if (this.animationFrame) return;
    this.animationFrame = window.requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.options.root.style.setProperty('--pointer-x', `${event.clientX}px`);
      this.options.root.style.setProperty('--pointer-y', `${event.clientY}px`);
    });
  }
}
