// Local semantic-embedding pipeline for the Jarvis memory store.
//
// Uses @huggingface/transformers to run a small sentence-embedding model entirely
// on-device. First call downloads the model (~25 MB) into the transformers
// cache directory and caches it for subsequent runs. All cosine math is done
// here so memoryStore.mjs stays small and database-focused.
//
// The class is intentionally tolerant of failure: if the model can't load
// (no network on first run, ONNX runtime missing, etc.) every method returns
// null and the caller falls back to the legacy keyword path. Memory storage
// keeps working either way.

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

export class Embedder {
  /** @type {Promise<any> | null} */ #pipelinePromise = null;
  /** @type {boolean} */ #disabled = false;
  /** @type {string} */ #modelName;
  /** @type {string | null} */ #lastError = null;

  constructor({ modelName = DEFAULT_MODEL, cacheDir = null } = {}) {
    this.#modelName = modelName;
    if (cacheDir) {
      process.env.TRANSFORMERS_CACHE = cacheDir;
    }
  }

  /** Has the underlying pipeline failed to initialise? */
  get disabled() {
    return this.#disabled;
  }

  /** Latest initialisation error, if any. */
  get lastError() {
    return this.#lastError;
  }

  /** Fixed embedding dimensionality the rest of the system can rely on. */
  get dim() {
    return EMBEDDING_DIM;
  }

  async ready() {
    if (this.#disabled) return null;
    if (!this.#pipelinePromise) {
      this.#pipelinePromise = this.#initPipeline();
    }
    try {
      return await this.#pipelinePromise;
    } catch (error) {
      this.#disabled = true;
      this.#lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[embeddings] disabled: ${this.#lastError}`);
      return null;
    }
  }

  async #initPipeline() {
    // Dynamic import so the rest of the server boots cleanly even if the
    // dependency is missing — useful in dev environments without the model.
    const transformers = await import('@huggingface/transformers');
    transformers.env.allowLocalModels = false;
    transformers.env.useBrowserCache = false;
    transformers.env.useFSCache = true;
    if (process.env.TRANSFORMERS_CACHE) {
      transformers.env.cacheDir = process.env.TRANSFORMERS_CACHE;
    }
    return transformers.pipeline('feature-extraction', this.#modelName, {
      quantized: true
    });
  }

  /**
   * Embed a piece of text into a unit-length Float32Array.
   * Returns null if the embedder is disabled.
   *
   * @param {string} text
   * @returns {Promise<Float32Array | null>}
   */
  async embed(text) {
    const pipeline = await this.ready();
    if (!pipeline) return null;
    const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 2400);
    if (!clean) return null;
    const tensor = await pipeline(clean, { pooling: 'mean', normalize: true });
    return new Float32Array(tensor.data);
  }

  /** Convert a Float32Array to a Buffer for sqlite BLOB storage. */
  static toBlob(vector) {
    if (!vector) return null;
    return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
  }

  /**
   * Decode a sqlite BLOB back into a Float32Array (or null).
   *
   * We can't construct Float32Array directly from a Buffer view because the
   * underlying ArrayBuffer offset isn't guaranteed to be 4-byte aligned
   * (Node's Buffer pool slices into a shared backing store). Copy via
   * DataView to stay correct on every platform.
   */
  static fromBlob(blob) {
    if (!blob || !blob.length) return null;
    const length = blob.byteLength / 4;
    if (!Number.isInteger(length) || length === 0) return null;
    const out = new Float32Array(length);
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    for (let i = 0; i < length; i += 1) {
      out[i] = view.getFloat32(i * 4, true);
    }
    return out;
  }

  /** Cosine similarity for two unit-length Float32Arrays. */
  static cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}
