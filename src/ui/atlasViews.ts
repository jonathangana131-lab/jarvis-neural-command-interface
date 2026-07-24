export type AtlasViewId =
  | 'run'
  | 'dashboard'
  | 'history'
  | 'artifacts'
  | 'memory'
  | 'settings'
  | 'diagnostics';

export type AtlasViewDefinition = {
  id: AtlasViewId;
  title: string;
  detail: string;
  icon: string;
  shortcut: string;
};

export const atlasViews: readonly AtlasViewDefinition[] = [
  {
    id: 'run',
    title: 'Cognitive Command',
    detail: 'Think with Jarvis and stream active work',
    icon: 'terminal-square',
    shortcut: '⌥ 1'
  },
  {
    id: 'dashboard',
    title: 'Intelligence Map',
    detail: 'Read the workspace as one living system',
    icon: 'activity',
    shortcut: '⌥ 2'
  },
  {
    id: 'history',
    title: 'Mission Archive',
    detail: 'Revisit previous thoughts, missions, and outcomes',
    icon: 'history',
    shortcut: '⌥ 3'
  },
  {
    id: 'artifacts',
    title: 'Creation Vault',
    detail: 'Inspect files and outputs created by Jarvis',
    icon: 'save',
    shortcut: '⌥ 4'
  },
  {
    id: 'memory',
    title: 'Memory Atlas',
    detail: 'Explore, recall, and shape the cognitive graph',
    icon: 'network',
    shortcut: '⌥ 5'
  },
  {
    id: 'settings',
    title: 'Jarvis Settings',
    detail: 'Configure models, voice, workspace, and privacy',
    icon: 'sliders-horizontal',
    shortcut: '⌥ 6'
  },
  {
    id: 'diagnostics',
    title: 'System Health',
    detail: 'Verify the local core and recover safely',
    icon: 'scan-line',
    shortcut: '⌥ 7'
  }
] as const;

export function atlasView(view: string): AtlasViewDefinition | undefined {
  return atlasViews.find((candidate) => candidate.id === view);
}
