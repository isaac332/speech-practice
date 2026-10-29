export interface AudioPlayerOptions {
  sampleRate?: number; // Default 24000 for Gemini Live API audio
  onVolumeChange?: (volume: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private sampleRate: number;
  private nextPlayTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private onVolumeChange?: (volume: number) => void;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private isPlaying: boolean = false;

  constructor(options?: AudioPlayerOptions) {
    this.sampleRate = options?.sampleRate || 24000;
    this.onVolumeChange = options?.onVolumeChange;
    this.onPlaybackStateChange = options?.onPlaybackStateChange;
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
      } catch {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Plays a raw PCM 16-bit chunk (Uint8Array or Int16Array) from Gemini Live API.
   */
  public playChunk(pcmBytes: Uint8Array | Int16Array): void {
    if (typeof window === "undefined") return;

    const ctx = this.ensureContext();

    // Convert raw PCM 16-bit little-endian to Float32Array [-1.0, 1.0]
    let int16Array: Int16Array;
    if (pcmBytes instanceof Int16Array) {
      int16Array = pcmBytes;
    } else {
      int16Array = new Int16Array(
        pcmBytes.buffer,
        pcmBytes.byteOffset,
        pcmBytes.byteLength / 2
      );
    }

    if (int16Array.length === 0) return;

    const float32Array = new Float32Array(int16Array.length);
    let sumSquares = 0;
    for (let i = 0; i < int16Array.length; i++) {
      const floatVal = int16Array[i] / 32768.0;
      float32Array[i] = floatVal;
      sumSquares += floatVal * floatVal;
    }

    // Report output volume for visualizer
    if (this.onVolumeChange) {
      const rms = Math.sqrt(sumSquares / int16Array.length);
      const normalizedVol = Math.min(1, Math.max(0, rms * 5));
      this.onVolumeChange(normalizedVol);
    }

    // Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule seamlessly
    const currentTime = ctx.currentTime;
    const startTime = Math.max(currentTime, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;

    this.activeSources.add(source);
    this.updatePlayingState(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && ctx.currentTime >= this.nextPlayTime - 0.05) {
        this.updatePlayingState(false);
        if (this.onVolumeChange) {
          this.onVolumeChange(0);
        }
      }
    };
  }

  /**
   * Immediately stops all audio output and empties playback queue (barge-in interruption).
   */
  public interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may already have ended
      }
    }
    this.activeSources.clear();

    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }

    this.updatePlayingState(false);
    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  public close(): void {
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private updatePlayingState(playing: boolean): void {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      this.onPlaybackStateChange?.(playing);
    }
  }
}
