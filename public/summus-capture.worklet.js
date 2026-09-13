/**
 * Captures microphone blocks and hands them to the main thread together with
 * the context time they started at — that timestamp is what lets a take be
 * lined up with the transport exactly.
 */
class SummusCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input && input[0]) {
      this.port.postMessage({ block: input[0].slice(), time: currentTime })
    }
    return true
  }
}

registerProcessor('summus-capture', SummusCapture)
