import * as THREE from 'three';
import { NeuralSphere } from './NeuralSphere';
import type { RecallMode, SemanticEdge } from './NeuralSphere';
import type { AssistantMode, MemoryRecord } from './types';

type JarvisSceneOptions = {
  onRendererStatus?: (status: string) => void;
};

export class JarvisScene {
  readonly neuralSphere = new NeuralSphere();

  private readonly scene = new THREE.Scene();
  private readonly orbitRoot = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly rings = new THREE.Group();
  private readonly rayLines: THREE.LineSegments;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly responsiveSceneOffset = new THREE.Vector3();
  private mode: AssistantMode = 'idle';
  private taskPhase = 'idle';
  private modeEnergy = 0.32;
  private audioLevel = 0;
  private rotationX = 0.2; // polar angle (up/down from top)
  private rotationY = 0;   // azimuthal angle (horizontal orbit)
  private targetRotationX = 0.2;
  private targetRotationY = 0;
  private velocityX = 0;
  private velocityY = 0;
  private targetZoom = 7.2;
  private zoom = 7.2;
  private dragging = false;
  private lastPointer = new THREE.Vector2();
  private downPointer = new THREE.Vector2();
  private dragDistance = 0;
  private lastInteractionAt = 0;
  private memoryPickHandler: ((memoryId: number) => void) | null = null;
  private rendererAvailable = true;
  private readonly spherical = new THREE.Spherical();
  private readonly maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
  private currentPixelRatio = Math.min(window.devicePixelRatio, 1.5);
  private slowFrameCount = 0;
  private fastFrameCount = 0;

  constructor(canvas: HTMLCanvasElement, private readonly options: JarvisSceneOptions = {}) {
    this.renderer = this.createRenderer(canvas);
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x02070b, 1);

    this.camera.position.set(0, 0.2, this.zoom);
    this.scene.fog = new THREE.FogExp2(0x02070b, 0.035);
    this.spherical.set(this.zoom, 0.2, 0);
    this.camera.position.setFromSpherical(this.spherical);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(this.orbitRoot);
    this.addLights();
    this.createRings();
    this.orbitRoot.add(this.neuralSphere.group);
    this.rayLines = this.createScanningRays();
    this.orbitRoot.add(this.rayLines);

    this.setupOrbitControls(canvas);
    this.setupContextRecovery(canvas);
    window.addEventListener('resize', () => this.resize());
  }

  private createRenderer(canvas: HTMLCanvasElement) {
    try {
      return new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      console.warn('High performance WebGL renderer unavailable; retrying with conservative settings.', error);
      return new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'default'
      });
    }
  }

  setMode(mode: AssistantMode) {
    this.mode = mode;
    this.neuralSphere.setMode(mode);
  }

  setTaskPhase(phase: string) {
    this.taskPhase = phase || 'idle';
    this.neuralSphere.setTaskPhase(this.taskPhase);
  }

  setAudioLevel(level: number) {
    this.audioLevel = THREE.MathUtils.clamp(level, 0, 1);
    this.neuralSphere.setAudioLevel(this.audioLevel);
  }

  setResponseActive(active: boolean) {
    this.neuralSphere.setResponseActive(active);
  }

  pulseResponse(intensity = 1) {
    this.neuralSphere.pulseResponse(intensity);
  }

  pulseMemoryGrowth(intensity = 1) {
    this.neuralSphere.pulseMemoryGrowth(intensity);
  }

  spawnMemory(memory: MemoryRecord) {
    this.neuralSphere.spawnMemory(memory);
  }

  replaceMemories(memories: MemoryRecord[]) {
    this.neuralSphere.replaceMemories(memories);
  }

  setSelectedMemory(memoryId: number | null) {
    this.neuralSphere.setSelectedMemory(memoryId);
  }

  setMemoryPickHandler(handler: ((memoryId: number) => void) | null) {
    this.memoryPickHandler = handler;
  }

  /** Bind real semantic edges to the orb. Pass [] to revert to legacy layout. */
  setSemanticEdges(edges: SemanticEdge[]) {
    this.neuralSphere.setSemanticEdges(edges);
  }

  /** Flash a set of memories that were just recalled (semantic or keyword). */
  flashRecall(memoryIds: Iterable<number>, mode: RecallMode = 'semantic') {
    this.neuralSphere.flashRecall(memoryIds, mode);
  }

  /** Diagnostics: { active, count, recalled }. */
  getEdgeStats() {
    return this.neuralSphere.getEdgeStats();
  }

  start() {
    this.renderer.setAnimationLoop(() => this.animate());
  }

  private animate() {
    if (!this.rendererAvailable) {
      return;
    }
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.tuneRenderQuality(delta);
    this.neuralSphere.update(delta, elapsed);

    const phaseEnergy = this.energyForTaskPhase();
    const targetEnergy = Math.max(phaseEnergy, this.mode === 'executing' ? 1.05
      : this.mode === 'thinking' ? 0.88
        : this.mode === 'learning' ? 1.18
          : this.mode === 'listening' || this.mode === 'speaking' ? 0.82
            : 0.34);
    this.modeEnergy = THREE.MathUtils.lerp(this.modeEnergy, targetEnergy, 1 - Math.exp(-delta * 4.2));
    const modeBoost = this.modeEnergy;
    this.updateCamera(delta);
    this.rings.rotation.z += delta * (0.08 + modeBoost * 0.16 + this.audioLevel * 0.22 + this.phaseSpinBoost());
    this.rings.rotation.x = Math.sin(elapsed * 0.25) * (0.04 + modeBoost * 0.025);
    this.rings.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.016 + this.audioLevel * 0.06 + modeBoost * 0.018);

    for (let i = 0; i < this.rings.children.length; i += 1) {
      const child = this.rings.children[i];
      child.rotation.z += delta * (i % 2 === 0 ? 0.18 : -0.12) * (1 + modeBoost);
      const material = (child as THREE.Mesh).material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.026 + Math.sin(elapsed * 2.2 + i) * 0.014 + this.audioLevel * 0.04 + modeBoost * 0.032;
      }
    }

    this.rayLines.rotation.z -= delta * (0.06 + modeBoost * 0.12);
    const rayMaterial = this.rayLines.material;
    if (rayMaterial instanceof THREE.LineBasicMaterial) {
      rayMaterial.opacity = 0.025 + modeBoost * 0.055 + this.audioLevel * 0.04;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private tuneRenderQuality(delta: number) {
    if (delta > 0.028) {
      this.slowFrameCount += 1;
      this.fastFrameCount = 0;
    } else if (delta < 0.018) {
      this.fastFrameCount += 1;
      this.slowFrameCount = 0;
    } else {
      this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
      this.fastFrameCount = Math.max(0, this.fastFrameCount - 1);
    }

    if (this.slowFrameCount >= 8 && this.currentPixelRatio > 1.08) {
      this.currentPixelRatio = Math.max(1.08, this.currentPixelRatio - 0.08);
      this.renderer.setPixelRatio(this.currentPixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.slowFrameCount = 0;
      return;
    }

    if (this.fastFrameCount >= 180 && this.currentPixelRatio < this.maxPixelRatio) {
      this.currentPixelRatio = Math.min(this.maxPixelRatio, this.currentPixelRatio + 0.05);
      this.renderer.setPixelRatio(this.currentPixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.fastFrameCount = 0;
    }
  }

  private energyForTaskPhase() {
    switch (this.taskPhase) {
      case 'queued':
        return 0.58;
      case 'planning':
      case 'thinking':
        return 0.98;
      case 'streaming':
        return 1.08;
      case 'editing':
      case 'testing':
        return 1.2;
      case 'done':
      case 'completed':
        return 0.74;
      case 'failed':
      case 'timed_out':
      case 'cancelled':
        return 0.88;
      default:
        return 0.34;
    }
  }

  private phaseSpinBoost() {
    switch (this.taskPhase) {
      case 'planning':
      case 'thinking':
        return 0.045;
      case 'streaming':
        return 0.07;
      case 'editing':
      case 'testing':
        return 0.1;
      default:
        return 0;
    }
  }

  private setupContextRecovery(canvas: HTMLCanvasElement) {
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.rendererAvailable = false;
      this.renderer.setAnimationLoop(null);
      this.options.onRendererStatus?.('Renderer paused after WebGL context loss; attempting recovery.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.rendererAvailable = true;
      this.resize();
      this.clock.start();
      this.renderer.setAnimationLoop(() => this.animate());
      this.options.onRendererStatus?.('Renderer recovered.');
    });
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private setupOrbitControls(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.dragging = true;
      this.lastPointer.set(event.clientX, event.clientY);
      this.downPointer.copy(this.lastPointer);
      this.dragDistance = 0;
      this.velocityX = 0;
      this.velocityY = 0;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) {
        this.hoverMemory(event, canvas);
        return;
      }
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer.set(event.clientX, event.clientY);
      this.dragDistance += Math.hypot(dx, dy);
      this.lastInteractionAt = performance.now();
      this.velocityY = dx * 0.0052;
      this.velocityX = dy * 0.0045;
      this.targetRotationY += this.velocityY;
      this.targetRotationX = THREE.MathUtils.clamp(this.targetRotationX + this.velocityX, 0.02, Math.PI - 0.02);
    });

    const endDrag = (event: PointerEvent) => {
      const wasClick = this.dragDistance < 6 && this.downPointer.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) < 6;
      this.dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (wasClick) {
        this.pickMemory(event, canvas);
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
      this.neuralSphere.setHoveredMemory(null);
      canvas.style.cursor = 'grab';
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.lastInteractionAt = performance.now();
      this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + event.deltaY * 0.005, 5.9, 14.5);
    }, { passive: false });
    canvas.addEventListener('dblclick', (event) => {
      event.preventDefault();
      this.lastInteractionAt = performance.now();
      this.targetRotationX = 0.2;
      this.targetRotationY = 0;
      this.velocityX = 0;
      this.velocityY = 0;
      this.targetZoom = 7.2;
    });
  }

  private updateCamera(delta: number) {
    if (!this.dragging && performance.now() - this.lastInteractionAt > 4200) {
      this.targetRotationY += delta * 0.025;
    }
    if (!this.dragging) {
      const damping = Math.exp(-delta * 3.8);
      this.targetRotationY += this.velocityY * delta * 9;
      this.targetRotationX = THREE.MathUtils.clamp(this.targetRotationX + this.velocityX * delta * 8, 0.02, Math.PI - 0.02);
      this.velocityY *= damping;
      this.velocityX *= damping;
      if (Math.abs(this.velocityY) < 0.00002) {
        this.velocityY = 0;
      }
      if (Math.abs(this.velocityX) < 0.00002) {
        this.velocityX = 0;
      }
    }
    this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, 1 - Math.exp(-delta * 13));
    this.rotationX = THREE.MathUtils.lerp(this.rotationX, this.targetRotationX, 1 - Math.exp(-delta * 13));
    this.zoom = THREE.MathUtils.lerp(this.zoom, this.targetZoom, 1 - Math.exp(-delta * 8));

    const narrow = window.innerWidth <= 620;
    const tablet = window.innerWidth > 620 && window.innerWidth <= 900;
    const targetOffsetX = narrow ? -0.8 : 0;
    const targetOffsetZ = narrow ? -1.35 : tablet ? -0.62 : 0;
    const targetScale = narrow ? 0.78 : tablet ? 0.9 : 1;
    this.responsiveSceneOffset.set(targetOffsetX, 0, targetOffsetZ);
    this.orbitRoot.position.lerp(this.responsiveSceneOffset, 1 - Math.exp(-delta * 8));
    this.orbitRoot.scale.setScalar(THREE.MathUtils.lerp(this.orbitRoot.scale.x, targetScale, 1 - Math.exp(-delta * 8)));

    // Use spherical coordinates for proper orbit behavior
    this.spherical.set(this.zoom, this.rotationX, this.rotationY);
    this.camera.position.setFromSpherical(this.spherical);
    this.camera.lookAt(0, 0.05, 0);
  }

  private pickMemory(event: PointerEvent, canvas: HTMLCanvasElement) {
    if (!this.memoryPickHandler) {
      return;
    }
    const memoryId = this.memoryAtEvent(event, canvas);
    if (memoryId !== null) {
      this.memoryPickHandler(memoryId);
    }
  }

  private hoverMemory(event: PointerEvent, canvas: HTMLCanvasElement) {
    const memoryId = this.memoryAtEvent(event, canvas);
    this.neuralSphere.setHoveredMemory(memoryId);
    canvas.style.cursor = memoryId === null ? 'grab' : 'pointer';
  }

  private memoryAtEvent(event: PointerEvent, canvas: HTMLCanvasElement) {
    const bounds = canvas.getBoundingClientRect();
    this.pointerNdc.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return this.neuralSphere.pickMemory(this.raycaster);
  }

  private addLights() {
    this.scene.add(new THREE.AmbientLight(0x6bdfff, 0.32));

    const key = new THREE.PointLight(0x69efff, 18, 28, 2);
    key.position.set(0, 1.8, 4.5);
    this.scene.add(key);

    const rim = new THREE.PointLight(0x0c68ff, 15, 28, 2);
    rim.position.set(-3.5, -2.4, -2.2);
    this.scene.add(rim);
  }

  private createRings() {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x50eaff,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    for (let i = 0; i < 8; i += 1) {
      const radius = 3.35 + i * 0.25;
      const tube = i % 3 === 0 ? 0.012 : 0.005;
      const arc = i % 2 === 0 ? Math.PI * (1.25 + Math.random() * 0.28) : Math.PI * (0.55 + Math.random() * 0.35);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 180, arc), ringMaterial.clone());
      ring.rotation.set(
        Math.PI / 2 + (Math.random() - 0.5) * 0.28,
        (Math.random() - 0.5) * 0.38,
        Math.random() * Math.PI * 2
      );
      this.rings.add(ring);
    }

    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.45 + i * 0.33, 0.004, 6, 180, Math.PI * (0.42 + i * 0.12)),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? 0xf7ba4d : i % 2 === 0 ? 0xffffff : 0x2bdcff,
          transparent: true,
          opacity: 0.09,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.set(Math.PI / 2, 0.18 * i, i * 1.35);
      this.rings.add(ring);
    }

    this.orbitRoot.add(this.rings);
  }

  private createScanningRays() {
    const count = 24;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const inner = 3.4 + Math.random() * 0.7;
      const outer = 6.4 + Math.random() * 1.7;
      positions.set([
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        -0.4,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer,
        -0.7 - Math.random() * 0.5
      ], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x1bcfff,
        transparent: true,
        opacity: 0.045,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
  }
}
