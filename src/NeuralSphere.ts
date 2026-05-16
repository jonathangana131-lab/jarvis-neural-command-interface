import * as THREE from 'three';
import type { AssistantMode, MemoryRecord } from './types';

type MemoryScope = MemoryRecord['scope'];

interface MemoryCluster {
  kind: string;
  direction: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  color: THREE.Color;
  accent: THREE.Color;
  indices: number[];
}

interface MemoryNeuron {
  memoryId: number;
  memoryKind: string;
  title: string;
  basePosition: THREE.Vector3;
  position: THREE.Vector3;
  radius: number;
  importance: number;
  confidence: number;
  pinned: boolean;
  scope: MemoryScope;
  clusterKey: string;
  clusterOrder: number;
  phase: number;
  birth: number;
  activation: number;
  coreGlow: number;
}

interface MemoryPath {
  memoryId: number;
  memoryKind: string;
  points: THREE.Vector3[];
  thickness: number;
  strength: number;
  phase: number;
  build: number;
  color: THREE.Color;
}

interface RecallPulse {
  pathIndex: number;
  progress: number;
  speed: number;
  age: number;
}

const NODE_CAPACITY = 3000;
const PATH_SEGMENT_CAPACITY = 9000;
const PULSE_CAPACITY = 560;
const CORE_COLOR = new THREE.Color(0x72f7ff);
const CORE_HOT = new THREE.Color(0xf3feff);
const MEMORY_AMBER = new THREE.Color(0xffc857);
const MODE_EXECUTE = new THREE.Color(0xffa64d);
const MODE_LISTEN = new THREE.Color(0x96c7ff);
const MODE_LEARN = new THREE.Color(0x76ffd1);
const MODE_ERROR = new THREE.Color(0xff6174);

const KIND_PALETTE: Record<string, { color: number; accent: number; direction: [number, number, number] }> = {
  preference: { color: 0x73f3ff, accent: 0xe9fdff, direction: [-0.78, 0.08, -0.22] },
  constraint: { color: 0xffd479, accent: 0xfff1bd, direction: [0.78, 0.08, -0.18] },
  project: { color: 0x55a8ff, accent: 0xb9dcff, direction: [-0.56, -0.04, 0.12] },
  task: { color: 0xff915c, accent: 0xffd0af, direction: [0.58, -0.04, 0.02] },
  fact: { color: 0x88ffca, accent: 0xdbffef, direction: [0.06, 0.08, -0.46] },
  conversation: { color: 0xbf9bff, accent: 0xf1eaff, direction: [0.0, 0.04, 0.28] }
};

function clamp01(value: number): number {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothDamp(current: number, target: number, delta: number, speed: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-delta * speed));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state += 1831565813;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function directionFromHash(kind: string): THREE.Vector3 {
  const rng = seededRandom(kind);
  const theta = rng() * Math.PI * 2;
  const y = rng() * 1.4 - 0.7;
  const r = Math.sqrt(Math.max(0.05, 1 - y * y));
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).normalize();
}

function basisFromDirection(direction: THREE.Vector3) {
  const up = Math.abs(direction.y) > 0.82 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(up, direction).normalize();
  const binormal = new THREE.Vector3().crossVectors(direction, tangent).normalize();
  return { tangent, binormal };
}

function makeCurvePoints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  direction: THREE.Vector3,
  tangent: THREE.Vector3,
  order: number,
  importance: number
): THREE.Vector3[] {
  const distance = from.distanceTo(to);
  const mid = from.clone().lerp(to, 0.54);
  const compactDistance = Math.min(distance, 1.6);
  const lift = direction.clone().multiplyScalar(0.08 + compactDistance * 0.11 + importance * 0.018);
  const side = tangent.clone().multiplyScalar(Math.sin(order * 1.73) * (0.06 + compactDistance * 0.045));
  const control = mid.add(lift).add(side);
  const points: THREE.Vector3[] = [];
  const segments = 12;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const mt = 1 - t;
    const point = from.clone().multiplyScalar(mt * mt)
      .add(control.clone().multiplyScalar(2 * mt * t))
      .add(to.clone().multiplyScalar(t * t));
    points.push(point);
  }
  return points;
}

function samplePath(path: MemoryPath, progress: number): THREE.Vector3 {
  if (path.points.length < 2) {
    return new THREE.Vector3();
  }
  const t = THREE.MathUtils.clamp(progress, 0, 0.999);
  const idx = t * (path.points.length - 1);
  const i = Math.min(Math.floor(idx), path.points.length - 2);
  return path.points[i].clone().lerp(path.points[i + 1], idx - i);
}

function makeSoftDiscTexture(size = 96): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const center = size / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.92)');
    gradient.addColorStop(0.48, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class NeuralSphere {
  group = new THREE.Group();

  private readonly neurons: MemoryNeuron[] = [];
  private readonly paths: MemoryPath[] = [];
  private readonly pulses: RecallPulse[] = [];
  private readonly clusters = new Map<string, MemoryCluster>();
  private readonly memoryNodeById = new Map<number, number>();
  private readonly pathIndicesByMemory = new Map<number, number[]>();

  private readonly coreGroup = new THREE.Group();
  private readonly coreShell: THREE.Mesh;
  private readonly coreHalo: THREE.Mesh;
  private readonly coreInner: THREE.Mesh;
  private readonly ringGroup = new THREE.Group();
  private readonly cortexLines: THREE.LineSegments;
  private readonly nodeMesh: THREE.InstancedMesh;
  private readonly haloMesh: THREE.InstancedMesh;
  private readonly memoryPointGeometry: THREE.BufferGeometry;
  private readonly memoryPointMesh: THREE.Points;
  private readonly pinRingMesh: THREE.InstancedMesh;
  private readonly pathMesh: THREE.InstancedMesh;
  private readonly pathLineGeometry: THREE.BufferGeometry;
  private readonly pathLineMesh: THREE.LineSegments;
  private readonly pulseMesh: THREE.InstancedMesh;

  private readonly memoryPointPositions: Float32Array;
  private readonly memoryPointColors: Float32Array;
  private readonly pathLinePositions: Float32Array;
  private readonly pathLineColors: Float32Array;
  private readonly scratch = new THREE.Object3D();
  private readonly scratchColor = new THREE.Color();
  private readonly pathColor = new THREE.Color();
  private readonly pathGlowColor = new THREE.Color();
  private readonly pathDirection = new THREE.Vector3();
  private readonly neuronTarget = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3(0, 1, 0);

  private mode: AssistantMode = 'idle';
  private taskPhase = 'idle';
  private modePulse = 0;
  private phasePulse = 0;
  private learningPulse = 0;
  private responsePulse = 0;
  private memoryGrowthPulse = 0;
  private activityLevel = 0.32;
  private audioLevel = 0;
  private responseActive = false;
  private selectedMemoryId: number | null = null;
  private hoveredMemoryId: number | null = null;
  private elapsedTime = 0;
  private pathGeometryDirty = true;
  private pathUpdateAccumulator = 0;
  private lastPathFocusKey = '';

  constructor() {
    this.group.name = 'NeuralSphere';
    this.group.rotation.x = -0.12;

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: CORE_HOT,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreInner = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 24), coreMaterial);
    this.coreInner.visible = true;

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: CORE_COLOR,
      transparent: true,
      opacity: 0.025,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreShell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 64, 32), shellMaterial);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x0aa9c6,
      transparent: true,
      opacity: 0.044,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreHalo = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 24), haloMaterial);
    this.coreHalo.visible = true;

    this.coreGroup.add(this.coreHalo, this.coreShell, this.coreInner);
    this.group.add(this.coreGroup);

    this.createCoreRings();
    this.group.add(this.ringGroup);

    this.cortexLines = this.createCortexLines();
    this.cortexLines.visible = false;
    this.group.add(this.cortexLines);

    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), nodeMaterial, NODE_CAPACITY);
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.nodeMesh.name = 'MemoryNeuronCores';
    this.group.add(this.nodeMesh);

    const haloMaterialNodes = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.haloMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 10), haloMaterialNodes, NODE_CAPACITY);
    this.haloMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.haloMesh.name = 'MemoryNeuronHalos';
    this.haloMesh.visible = true;
    this.group.add(this.haloMesh);

    this.memoryPointPositions = new Float32Array(NODE_CAPACITY * 3);
    this.memoryPointColors = new Float32Array(NODE_CAPACITY * 3);
    this.memoryPointGeometry = new THREE.BufferGeometry();
    this.memoryPointGeometry.setAttribute('position', new THREE.BufferAttribute(this.memoryPointPositions, 3));
    this.memoryPointGeometry.setAttribute('color', new THREE.BufferAttribute(this.memoryPointColors, 3));
    this.memoryPointMesh = new THREE.Points(
      this.memoryPointGeometry,
      new THREE.PointsMaterial({
        size: 0.19,
        map: makeSoftDiscTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        alphaTest: 0.01
      })
    );
    this.memoryPointMesh.name = 'MemorySynapsePointCloud';
    this.memoryPointMesh.visible = true;
    this.group.add(this.memoryPointMesh);

    const pinMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd479,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.pinRingMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 42), pinMaterial, NODE_CAPACITY);
    this.pinRingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pinRingMesh.name = 'PinnedMemoryRings';
    this.group.add(this.pinRingMesh);

    const pathMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.pathMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), pathMaterial, PATH_SEGMENT_CAPACITY);
    this.pathMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pathMesh.name = 'MemoryDendritePaths';
    this.group.add(this.pathMesh);

    this.pathLinePositions = new Float32Array(PATH_SEGMENT_CAPACITY * 2 * 3);
    this.pathLineColors = new Float32Array(PATH_SEGMENT_CAPACITY * 2 * 3);
    this.pathLineGeometry = new THREE.BufferGeometry();
    this.pathLineGeometry.setAttribute('position', new THREE.BufferAttribute(this.pathLinePositions, 3));
    this.pathLineGeometry.setAttribute('color', new THREE.BufferAttribute(this.pathLineColors, 3));
    this.pathLineMesh = new THREE.LineSegments(
      this.pathLineGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.pathLineMesh.name = 'MemoryFilamentLines';
    this.group.add(this.pathLineMesh);

    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });
    this.pulseMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), pulseMaterial, PULSE_CAPACITY);
    this.pulseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pulseMesh.name = 'MemoryRecallPulses';
    this.group.add(this.pulseMesh);

    this.rebuildGeometry();
  }

  setMode(mode: AssistantMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.modePulse = 1;
    }
  }

  setTaskPhase(phase: string): void {
    const next = phase || 'idle';
    if (this.taskPhase !== next) {
      this.taskPhase = next;
      this.phasePulse = 1;
      if (['streaming', 'editing', 'testing'].includes(next)) {
        this.responsePulse = Math.max(this.responsePulse, 0.75);
      }
      if (next === 'editing') {
        this.learningPulse = Math.max(this.learningPulse, 0.5);
      }
    }
  }

  setAudioLevel(level: number): void {
    this.audioLevel = clamp01(level);
  }

  setResponseActive(active: boolean): void {
    this.responseActive = active;
    if (active) {
      this.responsePulse = Math.max(this.responsePulse, 0.86);
    }
  }

  pulseResponse(intensity = 1): void {
    this.responsePulse = Math.max(this.responsePulse, THREE.MathUtils.clamp(intensity, 0, 1.8));
  }

  pulseMemoryGrowth(intensity = 1): void {
    this.memoryGrowthPulse = Math.max(this.memoryGrowthPulse, THREE.MathUtils.clamp(intensity, 0, 2.2));
    this.learningPulse = Math.max(this.learningPulse, this.memoryGrowthPulse * 0.5);
  }

  setSelectedMemory(memoryId: number | null): void {
    this.selectedMemoryId = memoryId;
    this.pathGeometryDirty = true;
    if (memoryId !== null) {
      this.activateMemory(memoryId, 1.2);
    }
  }

  setHoveredMemory(memoryId: number | null): void {
    if (this.hoveredMemoryId !== memoryId) {
      this.pathGeometryDirty = true;
    }
    this.hoveredMemoryId = memoryId;
  }

  spawnMemory(memory: MemoryRecord, animate = true): void {
    if (this.memoryNodeById.has(memory.id) || this.neurons.length >= NODE_CAPACITY) {
      return;
    }

    const cluster = this.clusterFor(memory.kind);
    const clusterOrder = cluster.indices.length;
    const rng = seededRandom(`${memory.id}:${memory.kind}:${memory.title}:${memory.createdAt}`);
    const importance = THREE.MathUtils.clamp(Number(memory.importance ?? 2), 1, 5);
    const confidence = clamp01(Number(memory.confidence ?? 1));
    const position = this.positionForMemory(memory, cluster, clusterOrder, rng);
    const radius = 0.092 + importance * 0.024 + (memory.pinned ? 0.02 : 0);
    const parent = this.nearestClusterNeuron(position, cluster);

    const neuron: MemoryNeuron = {
      memoryId: memory.id,
      memoryKind: memory.kind,
      title: memory.title,
      basePosition: position.clone(),
      position: animate ? position.clone().multiplyScalar(0.12) : position.clone(),
      radius,
      importance,
      confidence,
      pinned: Boolean(Number(memory.pinned)),
      scope: memory.scope,
      clusterKey: cluster.kind,
      clusterOrder,
      phase: rng() * Math.PI * 2,
      birth: animate ? 0 : 1,
      activation: animate ? 1.4 : 0.12,
      coreGlow: animate ? 1.7 : 0.35
    };

    const neuronIndex = this.neurons.length;
    this.neurons.push(neuron);
    cluster.indices.push(neuronIndex);
    this.memoryNodeById.set(memory.id, neuronIndex);

    const path = this.createMemoryPath(neuron, cluster, parent);
    const pathIndex = this.paths.length;
    this.paths.push(path);
    this.pathGeometryDirty = true;
    this.pathIndicesByMemory.set(memory.id, [pathIndex]);

    this.connectRelatedMemories(neuronIndex, cluster, rng);

    if (animate) {
      this.learningPulse = 1;
      this.pulseMemoryGrowth(0.95 + importance * 0.18);
      this.setMode('learning');
      this.spawnPulse(pathIndex, 0, 0.95 + importance * 0.08);
    }

    this.rebuildGeometry();
  }

  replaceMemories(memories: MemoryRecord[]): void {
    this.neurons.length = 0;
    this.paths.length = 0;
    this.pulses.length = 0;
    this.clusters.clear();
    this.memoryNodeById.clear();
    this.pathIndicesByMemory.clear();
    this.pathGeometryDirty = true;

    for (const memory of memories.slice().reverse()) {
      this.spawnMemory(memory, false);
    }

    this.rebuildGeometry();
  }

  pickMemory(raycaster: THREE.Raycaster): number | null {
    const intersections = raycaster.intersectObject(this.nodeMesh, false);
    for (const hit of intersections) {
      if (hit.instanceId !== undefined) {
        const neuron = this.neurons[hit.instanceId];
        if (neuron) {
          return neuron.memoryId;
        }
      }
    }
    return null;
  }

  update(delta: number, elapsed: number): void {
    this.elapsedTime = elapsed;
    this.modePulse = Math.max(0, this.modePulse - delta * 1.9);
    this.phasePulse = Math.max(0, this.phasePulse - delta * 1.45);
    this.learningPulse = Math.max(0, this.learningPulse - delta * 0.82);
    this.responsePulse = Math.max(0, this.responsePulse - delta * 1.12);
    this.memoryGrowthPulse = Math.max(0, this.memoryGrowthPulse - delta * 0.58);

    const isThinking = this.mode === 'thinking' || this.mode === 'executing';
    const isLearning = this.mode === 'learning';
    const isListening = this.mode === 'listening' || this.mode === 'speaking';
    const phaseProfile = this.phaseProfile();
    const targetActivity = Math.max(phaseProfile.energy, isThinking ? 1.12
      : isLearning ? 1.34
        : isListening ? 0.92
          : this.responseActive ? 0.84
            : 0.34);
    this.activityLevel = smoothDamp(this.activityLevel, targetActivity, delta, 4.8);

    const density = THREE.MathUtils.clamp(this.neurons.length / 120, 0, 1);
    const pulseScale = this.modePulse * 0.06 + this.learningPulse * 0.09 + this.responsePulse * 0.08 + this.audioLevel * 0.055;
    this.group.scale.setScalar(1 + density * 0.07 + pulseScale);
    this.group.rotation.y += delta * (0.018 + this.activityLevel * 0.032 + phaseProfile.spin);
    this.group.rotation.z = Math.sin(elapsed * 0.11) * (0.022 + this.activityLevel * 0.008 + this.phasePulse * 0.012);

    this.updateCore(delta, elapsed, density);
    this.updateRings(delta, elapsed);
    this.updateCortex(elapsed);
    this.updateNeurons(delta, elapsed);
    this.updatePaths(delta);
    this.updatePulses(delta);
  }

  private clusterFor(kind: string): MemoryCluster {
    const normalized = kind || 'fact';
    const existing = this.clusters.get(normalized);
    if (existing) {
      return existing;
    }

    const palette = KIND_PALETTE[normalized];
    const direction = palette
      ? new THREE.Vector3(...palette.direction).normalize()
      : directionFromHash(normalized);
    const { tangent, binormal } = basisFromDirection(direction);
    const fallbackHue = (hashString(normalized) % 360) / 360;
    const color = palette ? new THREE.Color(palette.color) : new THREE.Color().setHSL(fallbackHue, 0.8, 0.62);
    const accent = palette ? new THREE.Color(palette.accent) : color.clone().lerp(CORE_HOT, 0.45);
    const cluster: MemoryCluster = {
      kind: normalized,
      direction,
      tangent,
      binormal,
      color,
      accent,
      indices: []
    };
    this.clusters.set(normalized, cluster);
    return cluster;
  }

  private positionForMemory(
    memory: MemoryRecord,
    cluster: MemoryCluster,
    order: number,
    rng: () => number
  ): THREE.Vector3 {
    const importance = THREE.MathUtils.clamp(Number(memory.importance ?? 2), 1, 5);
    const scopePull = memory.scope === 'global' ? -0.08 : 0.04;
    const shell = Math.floor(order / 18);
    const ringSlot = order % 18;
    const angle = order * 2.399963 + shell * 0.57 + rng() * 0.42;
    const compactRadius = THREE.MathUtils.clamp(
      1.02 + importance * 0.06 + shell * 0.052 + (ringSlot % 5) * 0.018 + scopePull + (rng() - 0.5) * 0.06,
      0.96,
      1.62
    );
    const clusterBias = cluster.direction.clone().multiplyScalar(0.28);
    const localSpread = cluster.tangent.clone().multiplyScalar(Math.cos(angle) * (0.86 + rng() * 0.08))
      .add(cluster.binormal.clone().multiplyScalar(Math.sin(angle) * (0.82 + rng() * 0.08)))
      .add(cluster.direction.clone().multiplyScalar(((ringSlot % 6) - 2.5) * 0.16 + (rng() - 0.5) * 0.18));
    const direction = clusterBias.add(localSpread).normalize();
    const interiorScatter = cluster.tangent.clone().multiplyScalar((rng() - 0.5) * 0.08)
      .add(cluster.binormal.clone().multiplyScalar((rng() - 0.5) * 0.08));

    return direction.multiplyScalar(compactRadius).add(interiorScatter);
  }

  private nearestClusterNeuron(position: THREE.Vector3, cluster: MemoryCluster): MemoryNeuron | null {
    let nearest: MemoryNeuron | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const index of cluster.indices) {
      const candidate = this.neurons[index];
      if (!candidate) {
        continue;
      }
      const distance = position.distanceTo(candidate.basePosition);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private createMemoryPath(neuron: MemoryNeuron, cluster: MemoryCluster, parent: MemoryNeuron | null): MemoryPath {
    const root = parent?.basePosition.clone()
      ?? cluster.direction.clone().multiplyScalar(0.54)
        .add(cluster.tangent.clone().multiplyScalar(Math.sin(neuron.phase) * 0.08))
        .add(cluster.binormal.clone().multiplyScalar(Math.cos(neuron.phase) * 0.08));
    const points = makeCurvePoints(
      root,
      neuron.basePosition,
      cluster.direction,
      cluster.tangent,
      neuron.clusterOrder,
      neuron.importance
    );
    return {
      memoryId: neuron.memoryId,
      memoryKind: neuron.memoryKind,
      points,
      thickness: 0.026 + neuron.importance * 0.0075 + (neuron.pinned ? 0.01 : 0),
      strength: 0.66 + neuron.importance * 0.1 + neuron.confidence * 0.2,
      phase: neuron.phase,
      build: neuron.birth >= 1 ? 1 : 0,
      color: cluster.color.clone().lerp(CORE_HOT, parent ? 0.12 : 0.24)
    };
  }

  private connectRelatedMemories(neuronIndex: number, cluster: MemoryCluster, rng: () => number): void {
    const neuron = this.neurons[neuronIndex];
    const candidates = cluster.indices
      .filter((idx) => idx !== neuronIndex)
      .map((idx) => ({
        idx,
        distance: neuron.basePosition.distanceTo(this.neurons[idx]?.basePosition ?? neuron.basePosition)
      }))
      .filter((candidate) => candidate.distance > 0.001 && candidate.distance <= 1.05)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    for (const candidate of candidates) {
      if (this.paths.length >= Math.floor(PATH_SEGMENT_CAPACITY / 10)) {
        break;
      }
      const other = this.neurons[candidate.idx];
      const mid = neuron.basePosition.clone().lerp(other.basePosition, 0.5)
        .add(cluster.direction.clone().multiplyScalar(0.055 + rng() * 0.055))
        .add(cluster.tangent.clone().multiplyScalar((rng() - 0.5) * 0.085));
      const points: THREE.Vector3[] = [];
      const segments = 8;
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const mt = 1 - t;
        points.push(
          neuron.basePosition.clone().multiplyScalar(mt * mt)
            .add(mid.clone().multiplyScalar(2 * mt * t))
            .add(other.basePosition.clone().multiplyScalar(t * t))
        );
      }
      const pathIndex = this.paths.length;
      this.paths.push({
        memoryId: neuron.memoryId,
        memoryKind: neuron.memoryKind,
        points,
        thickness: 0.012 + Math.min(neuron.importance, other.importance) * 0.003,
        strength: 0.28 + Math.min(neuron.confidence, other.confidence) * 0.2,
        phase: neuron.phase + rng() * Math.PI,
        build: neuron.birth >= 1 ? 1 : 0,
        color: cluster.color.clone().lerp(other.clusterKey === neuron.clusterKey ? cluster.accent : CORE_COLOR, 0.18)
      });
      const indices = this.pathIndicesByMemory.get(neuron.memoryId) ?? [];
      indices.push(pathIndex);
      this.pathIndicesByMemory.set(neuron.memoryId, indices);
    }
  }

  private activateMemory(memoryId: number, amount: number): void {
    const neuronIndex = this.memoryNodeById.get(memoryId);
    if (neuronIndex !== undefined) {
      const neuron = this.neurons[neuronIndex];
      neuron.activation = Math.max(neuron.activation, amount);
      neuron.coreGlow = Math.max(neuron.coreGlow, amount);
    }
    for (const pathIndex of this.pathIndicesByMemory.get(memoryId) ?? []) {
      this.spawnPulse(pathIndex, 0, 1.0);
    }
  }

  private spawnPulse(pathIndex: number, progress = 0, speedBoost = 1): void {
    if (!this.paths[pathIndex] || this.pulses.length >= PULSE_CAPACITY) {
      return;
    }
    this.pulses.push({
      pathIndex,
      progress,
      speed: (0.34 + Math.random() * 0.56) * speedBoost,
      age: 0
    });
  }

  private rebuildGeometry(): void {
    this.pathGeometryDirty = true;
    this.updateNeurons(0, this.elapsedTime);
    this.updatePaths(0, true);
    this.updatePulses(0);
  }

  private updateCore(_delta: number, elapsed: number, density: number): void {
    const phaseProfile = this.phaseProfile();
    const active = this.activityLevel + this.responsePulse * 0.5 + this.learningPulse * 0.7 + this.audioLevel * 0.5 + this.phasePulse * 0.22;
    const breathe = 1 + Math.sin(elapsed * (1.4 + active * 0.4 + phaseProfile.beat)) * (0.035 + this.phasePulse * 0.018);
    this.coreInner.scale.setScalar((1.18 + active * 0.22) * breathe);
    this.coreShell.scale.setScalar(1.0 + active * 0.14 + density * 0.08);
    this.coreHalo.scale.setScalar(1.08 + active * 0.34 + density * 0.14);
    this.coreShell.rotation.y += 0.01 + active * 0.006;
    this.coreShell.rotation.x += 0.004;
    this.coreHalo.rotation.y -= 0.004 + active * 0.002;

    const shellMat = this.coreShell.material as THREE.MeshBasicMaterial;
    const innerMat = this.coreInner.material as THREE.MeshBasicMaterial;
    const haloMat = this.coreHalo.material as THREE.MeshBasicMaterial;
    shellMat.opacity = 0.018 + active * 0.012;
    innerMat.opacity = 0.56 + Math.min(0.16, active * 0.05);
    haloMat.opacity = 0.044 + active * 0.018 + density * 0.01;
    innerMat.color.copy(this.modeColor().lerp(phaseProfile.color, 0.26).lerp(CORE_HOT, 0.22));
  }

  private updateRings(delta: number, elapsed: number): void {
    const modeBoost = this.activityLevel + this.learningPulse * 0.7 + this.responsePulse * 0.5;
    for (let i = 0; i < this.ringGroup.children.length; i += 1) {
      const ring = this.ringGroup.children[i];
      ring.rotation.z += delta * (i % 2 === 0 ? 0.22 : -0.16) * (0.8 + modeBoost);
      ring.rotation.x += delta * (i % 3 === 0 ? 0.03 : -0.018);
      const material = (ring as THREE.Mesh).material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.055 + Math.sin(elapsed * 1.8 + i) * 0.012 + modeBoost * 0.025;
        material.color.copy(i % 4 === 0 ? MEMORY_AMBER : this.modeColor().lerp(this.phaseProfile().color, 0.36));
      }
    }
  }

  private updateCortex(elapsed: number): void {
    this.cortexLines.rotation.y = Math.sin(elapsed * 0.18) * 0.18;
    this.cortexLines.rotation.x = Math.sin(elapsed * 0.13) * 0.05;
    const material = this.cortexLines.material;
    if (material instanceof THREE.LineBasicMaterial) {
      material.opacity = 0.16 + this.activityLevel * 0.055 + this.learningPulse * 0.045 + this.responsePulse * 0.04;
    }
  }

  private updateNeurons(delta: number, elapsed: number): void {
    let pinCount = 0;
    const selectedKind = this.selectedMemoryId === null
      ? null
      : this.neurons[this.memoryNodeById.get(this.selectedMemoryId) ?? -1]?.clusterKey ?? null;

    for (let i = 0; i < this.neurons.length && i < NODE_CAPACITY; i += 1) {
      const neuron = this.neurons[i];
      neuron.birth = Math.min(1, neuron.birth + delta * (0.9 + neuron.importance * 0.16));
      neuron.activation = Math.max(0, neuron.activation - delta * 0.62);
      neuron.coreGlow = Math.max(0, neuron.coreGlow - delta * 0.48);

      const selected = this.selectedMemoryId === neuron.memoryId;
      const hovered = this.hoveredMemoryId === neuron.memoryId;
      const related = selectedKind !== null && neuron.clusterKey === selectedKind;
      const target = this.neuronTarget.copy(neuron.basePosition);
      const birthEase = 1 - Math.pow(1 - neuron.birth, 3);
      target.multiplyScalar(THREE.MathUtils.lerp(0.22, 1, birthEase));
      const drift = 0.062 * this.activityLevel + neuron.activation * 0.026;
      target.x += Math.sin(elapsed * 0.7 + neuron.phase) * drift;
      target.y += Math.cos(elapsed * 0.62 + neuron.phase * 1.3) * drift * 0.7;
      target.z += Math.sin(elapsed * 0.53 + neuron.phase * 0.7) * drift;
      neuron.position.lerp(target, 1 - Math.exp(-Math.max(delta, 0.016) * 8));

      const attention = selected ? 1.15 : hovered ? 0.72 : related ? 0.24 : 0;
      const unstable = (1 - neuron.confidence) * Math.sin(elapsed * 3.2 + neuron.phase) * 0.07;
      const pulse = Math.sin(elapsed * (1.1 + neuron.importance * 0.08) + neuron.phase) * 0.04;
      const scale = neuron.radius
        * (1 + attention + neuron.activation * 0.36 + this.memoryGrowthPulse * 0.12 + pulse + unstable);

      this.scratch.position.copy(neuron.position);
      this.scratch.scale.setScalar(scale);
      this.scratch.updateMatrix();
      this.nodeMesh.setMatrixAt(i, this.scratch.matrix);
      const nodeColor = this.colorForNeuron(neuron, attention, false);
      this.nodeMesh.setColorAt(i, nodeColor);
      this.memoryPointPositions[i * 3] = neuron.position.x;
      this.memoryPointPositions[i * 3 + 1] = neuron.position.y;
      this.memoryPointPositions[i * 3 + 2] = neuron.position.z;
      this.memoryPointColors[i * 3] = nodeColor.r;
      this.memoryPointColors[i * 3 + 1] = nodeColor.g;
      this.memoryPointColors[i * 3 + 2] = nodeColor.b;

      this.scratch.position.copy(neuron.position);
      this.scratch.scale.setScalar(scale * (1.85 + neuron.coreGlow * 0.36 + attention * 0.48 + this.audioLevel * 0.2));
      this.scratch.updateMatrix();
      this.haloMesh.setMatrixAt(i, this.scratch.matrix);
      this.haloMesh.setColorAt(i, this.colorForNeuron(neuron, attention, true));

      if (neuron.pinned) {
        this.scratch.position.copy(neuron.position);
        this.scratch.rotation.set(Math.PI / 2 + Math.sin(elapsed + neuron.phase) * 0.16, 0, elapsed * 0.35 + neuron.phase);
        this.scratch.scale.setScalar(scale * (2.0 + attention * 0.45));
        this.scratch.updateMatrix();
        this.pinRingMesh.setMatrixAt(pinCount, this.scratch.matrix);
        pinCount += 1;
      }
    }

    this.nodeMesh.count = this.neurons.length;
    this.haloMesh.count = this.neurons.length;
    this.pinRingMesh.count = pinCount;
    this.memoryPointGeometry.setDrawRange(0, this.neurons.length);
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    this.haloMesh.instanceMatrix.needsUpdate = true;
    this.pinRingMesh.instanceMatrix.needsUpdate = true;
    this.memoryPointGeometry.getAttribute('position').needsUpdate = true;
    this.memoryPointGeometry.getAttribute('color').needsUpdate = true;
    if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
    if (this.haloMesh.instanceColor) this.haloMesh.instanceColor.needsUpdate = true;
  }

  private updatePaths(delta = 0, force = false): void {
    const selectedKind = this.selectedMemoryId === null
      ? null
      : this.neurons[this.memoryNodeById.get(this.selectedMemoryId) ?? -1]?.clusterKey ?? null;
    const focusKey = `${this.selectedMemoryId ?? 'none'}:${this.hoveredMemoryId ?? 'none'}:${selectedKind ?? 'none'}`;
    const focusChanged = focusKey !== this.lastPathFocusKey;
    this.lastPathFocusKey = focusKey;
    this.pathUpdateAccumulator += delta;
    const hasGrowth = this.memoryGrowthPulse > 0.01 || this.pathGeometryDirty;
    const interval = hasGrowth || focusChanged ? 1 / 30 : 1 / 12;

    const material = this.pathMesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.07 + this.activityLevel * 0.03 + this.learningPulse * 0.028 + this.responsePulse * 0.03;
    const lineMaterial = this.pathLineMesh.material as THREE.LineBasicMaterial;
    lineMaterial.opacity = 0.14 + this.activityLevel * 0.045 + this.learningPulse * 0.035 + this.responsePulse * 0.035;

    if (!force && !this.pathGeometryDirty && !focusChanged && this.pathUpdateAccumulator < interval) {
      return;
    }

    this.pathUpdateAccumulator = 0;
    this.pathGeometryDirty = false;
    let segmentCount = 0;
    let lineVertexOffset = 0;

    for (const path of this.paths) {
      path.build = Math.min(1, path.build + Math.max(0.035, delta * (1.05 + this.memoryGrowthPulse * 0.65)));
      const selected = this.selectedMemoryId === path.memoryId;
      const hovered = this.hoveredMemoryId === path.memoryId;
      const related = selectedKind !== null && path.memoryKind === selectedKind;
      const emphasis = selected ? 1.25 : hovered ? 0.85 : related ? 0.24 : 0;
      const visibleSegments = Math.max(1, Math.floor((path.points.length - 1) * path.build));

      for (let i = 0; i < visibleSegments && segmentCount < PATH_SEGMENT_CAPACITY; i += 1) {
        const a = path.points[i];
        const b = path.points[i + 1];
        const dir = this.pathDirection.copy(b).sub(a);
        const len = dir.length();
        if (len < 0.001) {
          continue;
        }
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const thickness = path.thickness * (1 + emphasis * 0.65 + this.learningPulse * 0.2) * path.strength;
        this.scratch.position.copy(mid);
        this.scratch.quaternion.setFromUnitVectors(this.yAxis, dir.normalize());
        this.scratch.scale.set(thickness, len, thickness);
        this.scratch.updateMatrix();
        this.pathMesh.setMatrixAt(segmentCount, this.scratch.matrix);
        this.pathColor.copy(path.color).lerp(CORE_COLOR, emphasis * 0.22 + this.responsePulse * 0.08);
        this.pathMesh.setColorAt(segmentCount, this.pathColor);
        this.pathGlowColor.copy(this.pathColor).lerp(CORE_COLOR, 0.12 + this.learningPulse * 0.1 + emphasis * 0.1);
        this.pathLinePositions[lineVertexOffset] = a.x;
        this.pathLinePositions[lineVertexOffset + 1] = a.y;
        this.pathLinePositions[lineVertexOffset + 2] = a.z;
        this.pathLinePositions[lineVertexOffset + 3] = b.x;
        this.pathLinePositions[lineVertexOffset + 4] = b.y;
        this.pathLinePositions[lineVertexOffset + 5] = b.z;
        this.pathLineColors[lineVertexOffset] = this.pathGlowColor.r;
        this.pathLineColors[lineVertexOffset + 1] = this.pathGlowColor.g;
        this.pathLineColors[lineVertexOffset + 2] = this.pathGlowColor.b;
        this.pathLineColors[lineVertexOffset + 3] = this.pathGlowColor.r;
        this.pathLineColors[lineVertexOffset + 4] = this.pathGlowColor.g;
        this.pathLineColors[lineVertexOffset + 5] = this.pathGlowColor.b;
        lineVertexOffset += 6;
        segmentCount += 1;
      }
    }

    this.pathMesh.count = segmentCount;
    this.pathLineGeometry.setDrawRange(0, segmentCount * 2);
    this.pathMesh.instanceMatrix.needsUpdate = true;
    this.pathLineGeometry.getAttribute('position').needsUpdate = true;
    this.pathLineGeometry.getAttribute('color').needsUpdate = true;
    if (this.pathMesh.instanceColor) this.pathMesh.instanceColor.needsUpdate = true;
  }

  private updatePulses(delta: number): void {
    const phaseProfile = this.phaseProfile();
    const spawnRate = this.responseActive
      ? 24 + phaseProfile.pulse
      : this.activityLevel * 6.2 + this.memoryGrowthPulse * 9.5 + this.responsePulse * 13 + this.audioLevel * 7.5 + phaseProfile.pulse;

    if (this.paths.length > 0 && Math.random() < delta * spawnRate) {
      const preferred = this.selectedMemoryId !== null
        ? this.pathIndicesByMemory.get(this.selectedMemoryId)
        : this.hoveredMemoryId !== null
          ? this.pathIndicesByMemory.get(this.hoveredMemoryId)
          : null;
      const source = preferred?.length ? preferred : null;
      const pathIndex = source
        ? source[Math.floor(Math.random() * source.length)]
        : Math.floor(Math.random() * this.paths.length);
      this.spawnPulse(pathIndex, Math.random() * 0.12, 0.9 + this.activityLevel * 0.35);
    }

    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      const path = this.paths[pulse.pathIndex];
      if (!path) {
        this.pulses.splice(i, 1);
        continue;
      }
      pulse.age += delta;
      pulse.progress += delta * pulse.speed * (0.72 + this.activityLevel * 0.42 + this.responsePulse * 0.35 + phaseProfile.speed);
      if (pulse.progress >= 1) {
        const next = this.pathIndicesByMemory.get(path.memoryId) ?? [];
        if (next.length > 1 && Math.random() > 0.35) {
          pulse.pathIndex = next[Math.floor(Math.random() * next.length)];
          pulse.progress = 0;
          pulse.age = 0;
        } else {
          this.pulses.splice(i, 1);
        }
      }
    }

    const modeColor = this.modeColor();
    for (let i = 0; i < this.pulses.length && i < PULSE_CAPACITY; i += 1) {
      const pulse = this.pulses[i];
      const path = this.paths[pulse.pathIndex];
      const pos = samplePath(path, pulse.progress);
      const size = (0.035 + path.thickness * 1.8) * Math.min(1, pulse.age * 4) * (1 + this.responsePulse * 0.16);
      this.scratch.position.copy(pos);
      this.scratch.scale.setScalar(size);
      this.scratch.updateMatrix();
      this.pulseMesh.setMatrixAt(i, this.scratch.matrix);
      this.pulseMesh.setColorAt(i, path.color.clone().lerp(modeColor, 0.42).lerp(phaseProfile.color, 0.28).lerp(CORE_HOT, this.responsePulse * 0.25));
    }

    this.pulseMesh.count = Math.min(this.pulses.length, PULSE_CAPACITY);
    this.pulseMesh.instanceMatrix.needsUpdate = true;
    if (this.pulseMesh.instanceColor) this.pulseMesh.instanceColor.needsUpdate = true;
  }

  private colorForNeuron(neuron: MemoryNeuron, attention: number, halo: boolean): THREE.Color {
    const cluster = this.clusters.get(neuron.clusterKey);
    const base = cluster?.color ?? CORE_COLOR;
    const target = this.modeColor();
    const confidenceDim = THREE.MathUtils.lerp(0.55, 1, neuron.confidence);
    this.scratchColor.copy(base)
      .lerp(target, this.learningPulse * 0.18 + this.responsePulse * 0.16)
      .lerp(CORE_HOT, attention * (halo ? 0.28 : 0.48) + neuron.activation * 0.18);
    if (neuron.pinned) {
      this.scratchColor.lerp(MEMORY_AMBER, halo ? 0.28 : 0.38);
    }
    return this.scratchColor.multiplyScalar(halo ? 0.75 + attention * 0.22 : confidenceDim + attention * 0.16);
  }

  private modeColor(): THREE.Color {
    const phaseProfile = this.phaseProfile();
    if (this.taskPhase !== 'idle') return phaseProfile.color.clone().lerp(CORE_HOT, this.responsePulse > 0.1 ? 0.22 : 0);
    if (this.responsePulse > 0.1) return CORE_HOT.clone().lerp(MEMORY_AMBER, 0.28);
    if (this.mode === 'learning') return MODE_LEARN.clone();
    if (this.mode === 'thinking' || this.mode === 'executing') return MODE_EXECUTE.clone();
    if (this.mode === 'listening' || this.mode === 'speaking') return MODE_LISTEN.clone();
    return CORE_COLOR.clone();
  }

  private phaseProfile(): { color: THREE.Color; energy: number; spin: number; pulse: number; speed: number; beat: number } {
    switch (this.taskPhase) {
      case 'queued':
        return { color: MODE_LISTEN.clone(), energy: 0.58, spin: 0.006, pulse: 3, speed: 0.02, beat: 0.1 };
      case 'planning':
      case 'thinking':
        return { color: MEMORY_AMBER.clone(), energy: 1.02, spin: 0.025, pulse: 12, speed: 0.08, beat: 0.5 };
      case 'streaming':
        return { color: CORE_HOT.clone(), energy: 1.1, spin: 0.04, pulse: 18, speed: 0.12, beat: 0.8 };
      case 'editing':
      case 'testing':
        return { color: MODE_LEARN.clone(), energy: 1.22, spin: 0.055, pulse: 22, speed: 0.16, beat: 1.0 };
      case 'done':
      case 'completed':
        return { color: MODE_LEARN.clone(), energy: 0.72, spin: 0.012, pulse: 5, speed: 0.03, beat: 0.2 };
      case 'failed':
      case 'timed_out':
      case 'cancelled':
        return { color: MODE_ERROR.clone(), energy: 0.9, spin: 0.018, pulse: 8, speed: 0.05, beat: 0.35 };
      default:
        return { color: CORE_COLOR.clone(), energy: 0.34, spin: 0, pulse: 0, speed: 0, beat: 0 };
    }
  }

  private createCoreRings(): void {
    const ringSpecs = [
      { radius: 0.92, tube: 0.006, color: 0x73f3ff, opacity: 0.035, rot: [Math.PI / 2, 0.1, 0] },
      { radius: 1.12, tube: 0.005, color: 0xe9fdff, opacity: 0.025, rot: [Math.PI / 2.25, -0.22, 0.8] },
      { radius: 1.38, tube: 0.005, color: 0xffc857, opacity: 0.024, rot: [Math.PI / 2.1, 0.32, 1.8] },
      { radius: 1.66, tube: 0.004, color: 0x73f3ff, opacity: 0.02, rot: [Math.PI / 1.9, -0.48, 2.7] }
    ];

    for (const spec of ringSpecs) {
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.radius, spec.tube, 8, 180), material);
      ring.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
      this.ringGroup.add(ring);
    }
  }

  private createCortexLines(): THREE.LineSegments {
    const positions: number[] = [];
    const colors: number[] = [];
    const colorA = new THREE.Color(0x28dfff);
    const colorB = MEMORY_AMBER.clone().multiplyScalar(0.72);
    const colorC = new THREE.Color(0x147cff).lerp(CORE_COLOR, 0.28);
    const rng = seededRandom('jarvis-reference-memory-web');

    const addCurve = (
      sampler: (t: number) => THREE.Vector3,
      color: THREE.Color,
      segments = 32,
      fadeEnds = false
    ) => {
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const point = sampler(t);
        if (prev) {
          positions.push(prev.x, prev.y, prev.z, point.x, point.y, point.z);
          const endFade = fadeEnds ? Math.sin(t * Math.PI) : 1;
          const intensity = 0.2 + endFade * 0.46;
          colors.push(
            color.r * intensity, color.g * intensity, color.b * intensity,
            color.r * intensity, color.g * intensity, color.b * intensity
          );
        }
        prev = point;
      }
    };

    for (let i = 0; i < 420; i += 1) {
      const angle = (i / 420) * Math.PI * 2;
      const petal = i % 5;
      const twist = rng() * Math.PI * 2;
      const color = i % 9 === 0 ? colorB : i % 4 === 0 ? colorC : colorA;
      addCurve((t) => {
        const ease = Math.sin(t * Math.PI);
        const curl = angle + Math.sin(t * Math.PI * (1.2 + petal * 0.08) + twist) * (0.34 + petal * 0.035);
        const radius = 0.14 + ease * (1.18 + petal * 0.06 + rng() * 0.08);
        return new THREE.Vector3(
          Math.cos(curl) * radius * (1.05 + Math.sin(twist) * 0.05),
          Math.sin(curl * 1.08 + twist * 0.2) * radius * 0.86,
          Math.cos(t * Math.PI + twist) * 0.22 + Math.sin(curl) * radius * 0.48
        );
      }, color, 28, true);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
  }
}
