type CommandAction = {
  id: string;
  title: string;
  detail: string;
  shortcut?: string;
  icon: string;
  run: () => void;
};

type CommandPaletteOptions = {
  overlay: HTMLElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  toggle: HTMLButtonElement;
  onNavigate: (tab: string) => void;
  onNewChat: () => void;
  onFocusPrompt: () => void;
  onVoice: () => void;
  onThink: () => void;
  renderIcons: () => void;
  canOpen?: () => boolean;
};

export class CommandPalette {
  private readonly actions: CommandAction[];
  private filteredActions: CommandAction[] = [];
  private selectedIndex = 0;

  constructor(private readonly options: CommandPaletteOptions) {
    this.actions = [
      { id: 'compose', title: 'Compose a command', detail: 'Jump to the neural command line', shortcut: 'C', icon: 'terminal-square', run: options.onFocusPrompt },
      { id: 'new-chat', title: 'Start a new chat', detail: 'Open a clean mission thread', shortcut: 'N', icon: 'message-square', run: options.onNewChat },
      { id: 'voice', title: 'Toggle voice link', detail: 'Start or stop local dictation', shortcut: '⌘ M', icon: 'mic', run: options.onVoice },
      { id: 'think', title: 'Pulse neural core', detail: 'Preview Jarvis thinking state', icon: 'brain', run: options.onThink },
      ...atlasViews.map((view) => ({
        id: `view-${view.id}`,
        title: view.title,
        detail: view.detail,
        shortcut: view.shortcut,
        icon: view.icon,
        run: () => options.onNavigate(view.id)
      }))
    ];

    options.toggle.addEventListener('click', () => this.open());
    options.overlay.addEventListener('click', (event) => {
      if (event.target === options.overlay) this.close();
    });
    options.input.addEventListener('input', () => this.render());
    options.input.addEventListener('keydown', (event) => this.onInputKeydown(event));
    options.list.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-command-id]');
      if (!button) return;
      this.execute(button.dataset.commandId ?? '');
    });
    document.addEventListener('keydown', (event) => this.onGlobalKeydown(event));
  }

  open() {
    if (this.options.canOpen?.() === false) return;
    this.options.overlay.hidden = false;
    this.options.overlay.classList.remove('hidden');
    this.options.toggle.setAttribute('aria-expanded', 'true');
    this.options.input.value = '';
    this.selectedIndex = 0;
    this.render();
    window.requestAnimationFrame(() => this.options.input.focus());
  }

  close() {
    this.options.overlay.hidden = true;
    this.options.overlay.classList.add('hidden');
    this.options.toggle.setAttribute('aria-expanded', 'false');
    this.options.toggle.focus({ preventScroll: true });
  }

  private onGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.options.overlay.hidden ? this.open() : this.close();
      return;
    }
    if (event.key === 'Escape' && !this.options.overlay.hidden) {
      event.preventDefault();
      this.close();
    }
  }

  private onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredActions.length - 1);
      this.syncSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.syncSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const action = this.filteredActions[this.selectedIndex];
      if (action) this.execute(action.id);
    }
  }

  private render() {
    const query = this.options.input.value.trim().toLowerCase();
    this.filteredActions = this.actions.filter((action) => {
      const haystack = `${action.title} ${action.detail} ${action.id}`.toLowerCase();
      return !query || query.split(/\s+/).every((term) => haystack.includes(term));
    });
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredActions.length - 1));
    this.options.list.innerHTML = this.filteredActions.length
      ? this.filteredActions.map((action, index) => `
        <button type="button" class="command-menu__item${index === this.selectedIndex ? ' selected' : ''}" data-command-id="${action.id}">
          <span class="command-menu__icon" data-icon="${action.icon}"></span>
          <span><strong>${action.title}</strong><em>${action.detail}</em></span>
          ${action.shortcut ? `<kbd>${action.shortcut}</kbd>` : ''}
        </button>
      `).join('')
      : '<p class="command-menu__empty">No matching command.</p>';
    this.options.renderIcons();
  }

  private syncSelection() {
    this.options.list.querySelectorAll<HTMLButtonElement>('[data-command-id]').forEach((button, index) => {
      button.classList.toggle('selected', index === this.selectedIndex);
      if (index === this.selectedIndex) button.scrollIntoView({ block: 'nearest' });
    });
  }

  private execute(id: string) {
    const action = this.actions.find((candidate) => candidate.id === id);
    if (!action) return;
    this.close();
    action.run();
  }
}
import { atlasViews } from './atlasViews';
