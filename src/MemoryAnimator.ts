import type { JarvisScene } from './JarvisScene';
import type { MemoryRecord } from './types';

export class MemoryAnimator {
  constructor(private readonly scene: JarvisScene) {}

  hydrate(memories: MemoryRecord[]) {
    this.scene.replaceMemories(memories);
    this.scene.setMode('idle');
  }

  learn(memory: MemoryRecord) {
    this.scene.setMode('learning');
    this.scene.spawnMemory(memory);
    window.setTimeout(() => this.scene.setMode('idle'), 2800);
  }
}
