import type { JarvisScene } from './JarvisScene';
import type { RecallMode, SemanticEdge } from './NeuralSphere';
import type { MemoryRecord } from './types';

/**
 * Thin choreography layer between the data layer and the 3D scene. Each
 * method translates a domain event into the right sequence of orb pulses
 * and mode shifts. Kept tiny on purpose so main.ts can call into it
 * without caring about Three.js internals.
 */
export class MemoryAnimator {
  private idleRestoreTimer: number | null = null;

  constructor(private readonly scene: JarvisScene) {}

  hydrate(memories: MemoryRecord[]) {
    this.scene.replaceMemories(memories);
    this.scene.setMode('idle');
  }

  learn(memory: MemoryRecord) {
    this.scene.setMode('learning');
    this.scene.spawnMemory(memory);
    this.scheduleIdleRestore(2800);
  }

  applySemanticEdges(edges: SemanticEdge[]) {
    this.scene.setSemanticEdges(edges ?? []);
    if (edges && edges.length > 0) {
      this.scene.pulseMemoryGrowth(0.55);
    }
  }

  recall(ids: Iterable<number>, mode: RecallMode = 'semantic') {
    const idArray = Array.from(ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (idArray.length === 0) return;
    this.scene.setMode(mode === 'semantic' ? 'thinking' : 'thinking');
    this.scene.flashRecall(idArray, mode);
    this.scene.pulseResponse(mode === 'semantic' ? 1.05 : 0.78);
    this.scheduleIdleRestore(3400);
  }

  private scheduleIdleRestore(delayMs: number) {
    if (this.idleRestoreTimer !== null) {
      window.clearTimeout(this.idleRestoreTimer);
    }
    this.idleRestoreTimer = window.setTimeout(() => {
      this.scene.setMode('idle');
      this.idleRestoreTimer = null;
    }, delayMs);
  }
}
