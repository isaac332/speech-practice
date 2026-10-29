import { AudioUtils } from "@llm-multi-provider/core/live";

export interface AudioRecorderOptions {
  onAudioData: (pcmBase64: string, rawPcm: Int16Array) => void;
  onVolumeChange?: (volume: number) => void;
  targetSampleRate?: number; // Default 16000 for Gemini Live API
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRecording: boolean = false;
  private targetSampleRate: number;
  private onAudioData: (pcmBase64: string, rawPcm: Int16Array) => void;
  private onVolumeChange?: (volume: number) => void;

  constructor(options: AudioRecorderOptions) {
    this.onAudioData = options.onAudioData;
    this.onVolumeChange = options.onVolumeChange;
    this.targetSampleRate = options.targetSampleRate || 16000;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone recording is only available in browser environments.");
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.targetSampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize AudioContext (safely fall back to default rate if 16kHz is unsupported by hardware)
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch {
        this.audioContext = new AudioCtx();
      }

      console.log(`[AudioRecorder] Initialized at ${this.audioContext.sampleRate}Hz (resampling to ${this.targetSampleRate}Hz).`);

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessor with 4096 buffer size (~250ms chunks at 16kHz)
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const sourceSampleRate = this.audioContext?.sampleRate || this.targetSampleRate;

        // Downsample or interpolate to 16000Hz if needed
        const resampledFloat32 = this.resampleAudio(
          inputChannelData,
          sourceSampleRate,
          this.targetSampleRate
        );

        // Calculate Volume (RMS)
        if (this.onVolumeChange) {
          let sumSquares = 0;
          for (let i = 0; i < inputChannelData.length; i++) {
            sumSquares += inputChannelData[i] * inputChannelData[i];
          }
          const rms = Math.sqrt(sumSquares / inputChannelData.length);
          const normalizedVol = Math.min(1, Math.max(0, rms * 5)); // amplify for visual feedback
          this.onVolumeChange(normalizedVol);
        }

        // Convert to 16-bit linear PCM
        const pcm16 = AudioUtils.float32ToPcm16(resampledFloat32);
        const base64 = AudioUtils.pcm16ToBase64(pcm16);

        this.onAudioData(base64, pcm16);
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      // Connect to destination to keep processor node running (silent)
      const silenceGain = this.audioContext.createGain();
      silenceGain.gain.value = 0;
      this.processorNode.connect(silenceGain);
      silenceGain.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  get active(): boolean {
    return this.isRecording;
  }

  private resampleAudio(
    inputData: Float32Array,
    sourceRate: number,
    targetRate: number
  ): Float32Array {
    if (sourceRate === targetRate) {
      return inputData;
    }
    const ratio = sourceRate / targetRate;
    const newLength = Math.round(inputData.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const lower = Math.floor(srcIndex);
      const upper = Math.min(lower + 1, inputData.length - 1);
      const weight = srcIndex - lower;
      result[i] = inputData[lower] * (1 - weight) + inputData[upper] * weight;
    }
    return result;
  }
}
