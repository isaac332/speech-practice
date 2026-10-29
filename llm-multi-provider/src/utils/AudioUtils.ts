/**
 * Audio manipulation utilities for Gemini Live API audio streaming.
 * Handles PCM 16-bit conversion, base64 encoding/decoding, and RIFF WAV formatting.
 */
export class AudioUtils {
  /**
   * Converts 32-bit float audio samples (standard Web Audio API mic input in range [-1.0, 1.0])
   * to 16-bit signed PCM integers in little-endian.
   */
  static float32ToPcm16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  /**
   * Encodes PCM audio data (Int16Array, Uint8Array, ArrayBuffer, or Buffer) to a base64 string.
   */
  static pcm16ToBase64(pcmData: Int16Array | Uint8Array | ArrayBuffer | Buffer): string {
    let uint8: Uint8Array;
    if (pcmData instanceof Uint8Array) {
      uint8 = pcmData;
    } else if (pcmData instanceof Int16Array) {
      uint8 = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    } else if (pcmData instanceof ArrayBuffer) {
      uint8 = new Uint8Array(pcmData);
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(pcmData)) {
      return (pcmData as Buffer).toString("base64");
    } else {
      uint8 = new Uint8Array(pcmData);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString("base64");
    }

    let binary = "";
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  /**
   * Decodes a base64-encoded string into a Uint8Array.
   */
  static base64ToUint8Array(base64: string): Uint8Array {
    if (typeof Buffer !== "undefined") {
      const buf = Buffer.from(base64, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Creates a standard 44-byte RIFF WAV header for raw PCM audio data.
   * Enables immediate playback in browser HTML5 audio elements or saving to .wav files.
   *
   * @param pcmByteLength - Total length of raw PCM bytes
   * @param sampleRate - Sample rate (e.g. 24000 for Gemini output, 16000 for microphone input)
   * @param numChannels - Number of audio channels (default: 1 mono)
   * @param bitDepth - Bit depth per sample (default: 16-bit linear PCM)
   */
  static createWavHeader(
    pcmByteLength: number,
    sampleRate: number = 24000,
    numChannels: number = 1,
    bitDepth: number = 16
  ): Uint8Array {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + pcmByteLength, true); // ChunkSize
    this.writeString(view, 8, "WAVE");

    // "fmt " sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    view.setUint32(28, byteRate, true); // ByteRate
    const blockAlign = (numChannels * bitDepth) / 8;
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample

    // "data" sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, pcmByteLength, true); // Subchunk2Size

    return header;
  }

  /**
   * Prepends a WAV header to raw PCM audio bytes to form a complete WAV audio container.
   */
  static pcmToWav(
    pcmData: Uint8Array | ArrayBuffer | Int16Array | Buffer,
    sampleRate: number = 24000,
    numChannels: number = 1,
    bitDepth: number = 16
  ): Uint8Array {
    let pcmBytes: Uint8Array;
    if (pcmData instanceof Uint8Array) {
      pcmBytes = pcmData;
    } else if (pcmData instanceof Int16Array) {
      pcmBytes = new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    } else if (pcmData instanceof ArrayBuffer) {
      pcmBytes = new Uint8Array(pcmData);
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(pcmData)) {
      const buf = pcmData as Buffer;
      pcmBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else {
      pcmBytes = new Uint8Array(pcmData as any);
    }

    const header = this.createWavHeader(pcmBytes.byteLength, sampleRate, numChannels, bitDepth);
    const wav = new Uint8Array(header.byteLength + pcmBytes.byteLength);
    wav.set(header, 0);
    wav.set(pcmBytes, header.byteLength);
    return wav;
  }

  /**
   * Converts raw PCM audio directly to a Data URL (data:audio/wav;base64,...),
   * ideal for setting as the src of an HTMLAudioElement.
   */
  static pcmToWavDataUrl(
    pcmData: Uint8Array | ArrayBuffer | Int16Array | Buffer,
    sampleRate: number = 24000
  ): string {
    const wav = this.pcmToWav(pcmData, sampleRate);
    const base64 = this.pcm16ToBase64(wav);
    return `data:audio/wav;base64,${base64}`;
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
