/**
 * Saffi MicProcessor — AudioWorklet
 * Runs in the audio thread. Buffers mic input and posts chunks to main thread.
 * The main thread resamples to 24kHz and encodes as PCM16.
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._len = 0;
    // ~100ms at 48kHz = 4800 samples
    this._chunkSize = 4800;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    for (let i = 0; i < channel.length; i++) {
      this._buf.push(channel[i]);
    }
    this._len += channel.length;

    while (this._len >= this._chunkSize) {
      const chunk = new Float32Array(this._buf.splice(0, this._chunkSize));
      this._len -= this._chunkSize;
      this.port.postMessage({ audio: chunk }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
