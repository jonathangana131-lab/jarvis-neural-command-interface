import type { AssistantMode, VoiceSettings } from './types';

type VoiceCallbacks = {
  onMode: (mode: AssistantMode) => void;
  onStatus: (status: string) => void;
  onAudioLevel: (level: number) => void;
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
  private active = false;
  private settings: VoiceSettings = {
    voiceEnabled: true,
    spokenResponses: true,
    selectedVoiceName: '',
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

  speakSummary(text: string) {
    if (!this.settings.voiceEnabled || !this.settings.spokenResponses || !('speechSynthesis' in window)) {
      return;
    }
    const summary = summarizeForSpeech(text, this.settings.summaryMaxLength);
    if (!summary) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 1;
    utterance.pitch = 0.92;
    const voices = this.availableVoices();
    const selected = voices.find((voice) => voice.name === this.settings.selectedVoiceName)
      ?? voices.find((voice) => /natural|online|guy|david|mark|zira/i.test(`${voice.name} ${voice.voiceURI}`))
      ?? voices.find((voice) => /^en/i.test(voice.lang))
      ?? voices[0];
    if (selected) {
      utterance.voice = selected;
    }
    this.callbacks.onMode('speaking');
    utterance.onend = () => this.callbacks.onMode(this.active ? 'listening' : 'idle');
    utterance.onerror = () => this.callbacks.onMode(this.active ? 'listening' : 'idle');
    window.speechSynthesis.speak(utterance);
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
