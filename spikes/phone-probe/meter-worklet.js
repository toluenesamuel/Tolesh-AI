// AudioWorklet: computes an RMS level from the microphone input.
// It posts numbers only, never audio samples, and outputs silence.
class LevelMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0;
    this.count = 0;
    this.blockSize = 512; // about 10 ms at 48 kHz
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this.sum += channel[i] * channel[i];
      this.count += channel.length;
      if (this.count >= this.blockSize) {
        this.port.postMessage({ rms: Math.sqrt(this.sum / this.count), t: currentTime });
        this.sum = 0;
        this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor('level-meter', LevelMeter);
