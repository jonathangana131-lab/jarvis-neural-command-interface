import type { AssistantMode, VoiceSettings } from './types';

type VoiceCallbacks = {
  onMode: (mode: AssistantMode) => void;
  onStatus: (status: string) => void;
  onAudioLevel: (level: number) => void;
  onSpeechWord: (word: string, intensity: number) => void;
  onTranscript: (text: string) => void;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class VoiceSession {
  private recognition: SpeechRecognitionLike | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame = 0;
  private speechFallbackTimers: number[] = [];
  private active = false;
  private settings: VoiceSettings = {
    voiceEnabled: true,
    spokenResponses: false,
    selectedVoiceName: '',
    voiceProfile: 'jarvis',
    voiceSampleName: '',
    voiceSampleSize: 0,
    voiceSampleUpdatedAt: '',
    speechRate: 0.94,
    speechPitch: 0.82,
    speechVolume: 1,
    orbSpeechReactive: true,
    orbSpeechIntensity: 1,
    autoSendAfterFinalTranscript: true,
    summaryMaxLength: 180
  };

  constructor(private readonly callbacks: VoiceCallbacks) {}

  get connected() {
    return this.active;
  }

  configure(settings: VoiceSettings) {
    this.settings = settings;
  }

  availableVoices() {
    return window.speechSynthesis?.getVoices?.() ?? [];
  }

  async start() {
    if (!this.settings.voiceEnabled) {
      throw new Error('Voice Mode is disabled in Settings.');
    }
    if (this.active) {
      await this.stop();
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      throw new Error('Speech dictation is not available in this Windows webview. Type the task and run Codex directly.');
    }

    this.callbacks.onStatus('Requesting microphone');
    this.callbacks.onMode('listening');
    this.mediaStream = await requestMicrophoneStream(12000);
    this.attachAudioMeter(this.mediaStream);

    this.recognition = new Recognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';
    this.recognition.onstart = () => {
      this.active = true;
      this.callbacks.onStatus('Dictation listening');
      this.callbacks.onMode('listening');
    };
    this.recognition.onend = () => {
      if (this.active) {
        this.callbacks.onStatus('Dictation stopped');
        void this.stop();
      }
    };
    this.recognition.onerror = (event) => {
      this.callbacks.onStatus(`Dictation error: ${event.error ?? 'unknown'}`);
      this.callbacks.onMode('idle');
    };
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.start();
  }

  async stop() {
    this.active = false;
    cancelAnimationFrame(this.animationFrame);
    this.recognition?.stop();
    for (const track of this.mediaStream?.getTracks() ?? []) {
      track.stop();
    }
    this.recognition = null;
    this.mediaStream = null;
    this.analyser = null;
    this.callbacks.onAudioLevel(0);
    this.callbacks.onStatus('Codex app connected locally');
    this.callbacks.onMode('idle');
  }

  speakSummary(text: string, options: { preview?: boolean } = {}) {
    if (!this.settings.voiceEnabled || (!this.settings.spokenResponses && !options.preview) || !('speechSynthesis' in window)) {
      return;
    }
    const summary = summarizeForSpeech(text, this.settings.summaryMaxLength);
    if (!summary) {
      return;
    }
    window.speechSynthesis.cancel();
    this.clearSpeechFallbackTimers();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = this.settings.voiceProfile === 'jarvis'
      ? clampNumber(this.settings.speechRate, 0.72, 1.22, 0.94)
      : clampNumber(this.settings.speechRate, 0.72, 1.22, 1);
    utterance.pitch = this.settings.voiceProfile === 'jarvis'
      ? clampNumber(this.settings.speechPitch, 0.5, 1.35, 0.82)
      : clampNumber(this.settings.speechPitch, 0.5, 1.35, 1);
    utterance.volume = clampNumber(this.settings.speechVolume, 0.2, 1, 1);
    const words = wordsForSpeech(summary);
    let boundarySeen = false;
    const voices = this.availableVoices();
    const selected = selectVoice(voices, this.settings);
    if (selected) {
      utterance.voice = selected;
    }
    this.callbacks.onMode('speaking');
    this.callbacks.onStatus(`Speaking with ${this.settings.voiceProfile === 'jarvis' ? 'Jarvis tuned' : 'system'} voice`);
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') {
        return;
      }
      boundarySeen = true;
      const word = wordAtChar(summary, event.charIndex) || words[Math.min(words.length - 1, Math.max(0, event.charIndex))] || '';
      this.callbacks.onSpeechWord(word, speechIntensityForWord(word));
    };
    utterance.onstart = () => {
      this.callbacks.onSpeechWord(words[0] ?? '', 1);
      this.scheduleSpeechFallback(words, () => boundarySeen);
    };
    utterance.onend = () => {
      this.clearSpeechFallbackTimers();
      this.callbacks.onAudioLevel(0);
      this.callbacks.onMode(this.active ? 'listening' : 'idle');
      this.callbacks.onStatus(this.active ? 'Dictation listening' : 'Codex app connected locally');
    };
    utterance.onerror = () => {
      this.clearSpeechFallbackTimers();
      this.callbacks.onAudioLevel(0);
      this.callbacks.onMode(this.active ? 'listening' : 'idle');
      this.callbacks.onStatus(this.active ? 'Dictation listening' : 'Codex app connected locally');
    };
    window.speechSynthesis.speak(utterance);
  }

  private scheduleSpeechFallback(words: string[], hasBoundary: () => boolean) {
    if (words.length === 0) {
      return;
    }
    const rate = clampNumber(this.settings.speechRate, 0.72, 1.22, 1);
    const interval = Math.max(115, Math.round(185 / rate));
    const maxWords = words.slice(1, 90);
    this.clearSpeechFallbackTimers();
    for (let index = 0; index < maxWords.length; index += 1) {
      const timer = window.setTimeout(() => {
        if (!hasBoundary()) {
          const word = maxWords[index];
          this.callbacks.onSpeechWord(word, speechIntensityForWord(word));
        }
      }, 180 + index * interval);
      this.speechFallbackTimers.push(timer);
    }
  }

  private clearSpeechFallbackTimers() {
    for (const timer of this.speechFallbackTimers) {
      window.clearTimeout(timer);
    }
    this.speechFallbackTimers = [];
  }

  private handleResult(event: SpeechRecognitionEvent) {
    let finalText = '';
    let interimText = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0]?.transcript?.replace(/\s+/g, ' ').trim() ?? '';
      if (!transcript) {
        continue;
      }
      if (result.isFinal) {
        finalText += `${transcript} `;
      } else {
        interimText += `${transcript} `;
      }
    }

    if (interimText.trim()) {
      this.callbacks.onStatus(interimText.trim());
      this.callbacks.onMode('listening');
    }
    if (finalText.trim()) {
      this.emitTranscript(finalText);
    }
  }

  private emitTranscript(value: string) {
    const transcript = value.replace(/\s+/g, ' ').trim();
    if (transcript.length >= 3) {
      this.callbacks.onTranscript(transcript);
      this.callbacks.onStatus('Added dictation to Codex prompt');
      this.callbacks.onMode('thinking');
    }
  }

  private attachAudioMeter(stream: MediaStream) {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.analyser) {
        return;
      }
      this.analyser.getByteFrequencyData(data);
      const average = data.reduce((sum, value) => sum + value, 0) / data.length / 255;
      this.callbacks.onAudioLevel(average);
      this.animationFrame = requestAnimationFrame(tick);
    };
    tick();
  }
}

function summarizeForSpeech(value: string, maxLength: number) {
  const clean = value
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) {
    return '';
  }
  const firstSentence = clean.match(/^.{24,}?[.!?](?:\s|$)/)?.[0]?.trim() ?? clean;
  const summary = firstSentence.length <= maxLength ? firstSentence : `${firstSentence.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  if (/^(import|const|let|var|function|class|export|type|interface)\b/.test(summary)) {
    return 'I finished generating code. Check the response for details.';
  }
  return summary;
}

function selectVoice(voices: SpeechSynthesisVoice[], settings: VoiceSettings) {
  const selected = voices.find((voice) => voice.name === settings.selectedVoiceName);
  if (selected) {
    return selected;
  }
  if (settings.voiceProfile === 'jarvis') {
    return voices.find((voice) => /natural|online|guy|david|mark|george|male/i.test(`${voice.name} ${voice.voiceURI}`))
      ?? voices.find((voice) => /^en/i.test(voice.lang) && !/zira|female/i.test(`${voice.name} ${voice.voiceURI}`))
      ?? voices.find((voice) => /^en/i.test(voice.lang))
      ?? voices[0];
  }
  return voices.find((voice) => /^en/i.test(voice.lang)) ?? voices[0];
}

function wordsForSpeech(value: string) {
  return value.match(/[A-Za-z0-9']+/g) ?? [];
}

function wordAtChar(value: string, charIndex: number) {
  const safeIndex = Math.max(0, Math.min(value.length, Number(charIndex) || 0));
  const suffix = value.slice(safeIndex);
  return suffix.match(/[A-Za-z0-9']+/)?.[0] ?? '';
}

function speechIntensityForWord(word: string) {
  const clean = word.replace(/[^A-Za-z0-9]/g, '');
  if (!clean) {
    return 0.62;
  }
  return Math.max(0.68, Math.min(1.45, 0.72 + clean.length * 0.055));
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function requestMicrophoneStream(timeoutMs: number) {
  let settled = false;
  let timedOut = false;
  const request = navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      settled = true;
      if (timedOut) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        throw new Error('Microphone permission timed out. Check Windows and browser microphone permissions.');
      }
      return stream;
    });
  const timeout = new Promise<MediaStream>((_resolve, reject) => {
    window.setTimeout(() => {
      if (settled) {
        return;
      }
      timedOut = true;
      reject(new Error('Microphone permission timed out. Check Windows and browser microphone permissions.'));
    }, timeoutMs);
  });
  return Promise.race([request, timeout]);
}
