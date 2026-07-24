import { atlasView, atlasViews } from './atlasViews';

type ShellControllerOptions = {
  root: HTMLElement;
  clock: HTMLElement;
};

export class ShellController {
  private animationFrame = 0;
  private readonly viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-console-tab]'));

  constructor(private readonly options: ShellControllerOptions) {
    this.updateClock();
    window.setInterval(() => this.updateClock(), 15_000);
    window.addEventListener('pointermove', (event) => this.trackPointer(event), { passive: true });
    document.addEventListener('keydown', (event) => this.handleViewShortcut(event));
  }

  setView(view: string) {
    const definition = atlasView(view);
    if (!definition) return;
    const previousView = this.options.root.dataset.view;
    this.options.root.dataset.view = view;
    this.options.root.style.setProperty('--view-index', String(atlasViews.findIndex((candidate) => candidate.id === view)));
    this.viewButtons.forEach((button) => {
      const selected = button.dataset.consoleTab === view;
      button.setAttribute('aria-current', selected ? 'page' : 'false');
      button.setAttribute('aria-selected', String(selected));
      button.classList.toggle('active', selected);
    });
    document.title = `Jarvis 2 — ${definition.title}`;
    if (previousView !== view) {
      window.dispatchEvent(new CustomEvent('jarvis:view-change', {
        detail: { previousView, view, definition }
      }));
    }
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

  private handleViewShortcut(event: KeyboardEvent) {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const index = Number(event.key) - 1;
    const definition = atlasViews[index];
    const button = definition
      ? this.viewButtons.find((candidate) => candidate.dataset.consoleTab === definition.id)
      : undefined;
    if (!button) return;
    event.preventDefault();
    button.click();
  }
}
