export type MicMode = 'headphones' | 'speakers'

/** Turns the browser's terse getUserMedia failures into something actionable. */
export function micErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Der Zugriff aufs Mikrofon wurde abgelehnt. Klick in der Adressleiste auf das Schloss-Symbol und erlaube das Mikrofon, dann nochmal versuchen.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Es wurde kein Mikrofon gefunden. Ist eins angeschlossen und ausgewählt?'
    case 'NotReadableError':
      return 'Das Mikrofon ist gerade von einem anderen Programm belegt. Schließ andere Apps, die es benutzen.'
    case 'AbortError':
      return 'Das Mikrofon konnte nicht gestartet werden. Versuch es nochmal.'
    default:
      return error instanceof Error && error.message
        ? `Mikrofon-Problem: ${error.message}`
        : 'Das Mikrofon konnte nicht geöffnet werden.'
  }
}


export interface RecorderState {
  ready: boolean
  recording: boolean
  mode: MicMode
  deviceLabel: string
}

/**
 * Captures the microphone into raw Float32 blocks.
 *
 * Timing matters here: every block carries the AudioContext time it started at,
 * so a take can be trimmed to the exact moment the transport began — otherwise
 * an overdub drifts against the click by a whole buffer.
 */
/** An AudioWorklet processor name can only be registered once per context. */
const registered = new WeakSet<BaseAudioContext>()

const WORKLET_URL = '/summus-capture.worklet.js'

/**
 * Tone hands out its own context wrapper in some builds, which is missing the
 * plain Web Audio factory methods. Dig out the real AudioContext.
 */
export function nativeContext(candidate: unknown): AudioContext {
  let ctx = candidate as Record<string, unknown> | undefined
  for (let i = 0; i < 5 && ctx; i++) {
    if (typeof (ctx as unknown as AudioContext).createGain === 'function' && 'audioWorklet' in ctx) {
      return ctx as unknown as AudioContext
    }
    ctx = (ctx._nativeAudioContext ?? ctx.rawContext ?? ctx._context) as Record<string, unknown> | undefined
  }
  return candidate as AudioContext
}

export class MicRecorder {
  private ctx: AudioContext
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | ScriptProcessorNode | null = null
  private analyser: AnalyserNode | null = null
  private meterData: Float32Array<ArrayBuffer> | null = null
  private silentSink: GainNode | null = null

  private blocks: Float32Array[] = []
  private blockTimes: number[] = []
  private capturing = false

  mode: MicMode = 'headphones'
  deviceLabel = ''
  /** Context time of the first captured block */
  captureStart = 0

  constructor(ctx: AudioContext) {
    this.ctx = nativeContext(ctx)
  }

  get ready(): boolean {
    return this.stream !== null
  }

  get recording(): boolean {
    return this.capturing
  }

  async open(mode: MicMode = this.mode, deviceId?: string): Promise<void> {
    if (this.stream && this.mode === mode) return
    this.close()
    this.mode = mode

    // On speakers we need the browser's echo canceller or the app's own output
    // bleeds into the take. On headphones we turn every clean-up off, because
    // noise suppression and AGC both wreck pitch tracking.
    const useAec = mode === 'speakers'
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: useAec,
        noiseSuppression: useAec,
        autoGainControl: false,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      video: false,
    })
    this.deviceLabel = this.stream.getAudioTracks()[0]?.label ?? 'Mikrofon'

    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.meterData = new Float32Array(this.analyser.fftSize)
    this.source.connect(this.analyser)

    try {
      if (!registered.has(this.ctx)) {
        await this.ctx.audioWorklet.addModule(WORKLET_URL)
        registered.add(this.ctx)
      }
      const worklet = new AudioWorkletNode(this.ctx, 'summus-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      })
      worklet.port.onmessage = (event: MessageEvent<{ block: Float32Array; time: number }>) => {
        if (!this.capturing) return
        if (!this.blocks.length) this.captureStart = event.data.time
        this.blocks.push(event.data.block)
        this.blockTimes.push(event.data.time)
      }
      this.node = worklet
    } catch (workletError) {
      // Older engines (and some locked-down embeds) have no AudioWorklet.
      if (typeof this.ctx.createScriptProcessor !== 'function') {
        this.close()
        const detail = workletError instanceof Error ? workletError.message : String(workletError)
        throw new Error(`Aufnahme wird von diesem Browser nicht unterstützt (${detail})`)
      }
      const processor = this.ctx.createScriptProcessor(2048, 1, 1)
      processor.onaudioprocess = (event) => {
        if (!this.capturing) return
        const block = new Float32Array(event.inputBuffer.getChannelData(0))
        if (!this.blocks.length) this.captureStart = event.playbackTime
        this.blocks.push(block)
        this.blockTimes.push(event.playbackTime)
      }
      this.node = processor
    }

    this.source.connect(this.node)
    // Keep the node pulling without letting the mic reach the speakers.
    this.silentSink = this.ctx.createGain()
    this.silentSink.gain.value = 0
    this.node.connect(this.silentSink)
    this.silentSink.connect(this.ctx.destination)
  }

  /** Peak level of the incoming signal, 0..1 — for the input meter. */
  level(): number {
    if (!this.analyser || !this.meterData) return 0
    this.analyser.getFloatTimeDomainData(this.meterData)
    let peak = 0
    for (let i = 0; i < this.meterData.length; i++) {
      const v = Math.abs(this.meterData[i])
      if (v > peak) peak = v
    }
    return peak
  }

  start(): void {
    this.blocks = []
    this.blockTimes = []
    this.captureStart = 0
    this.capturing = true
  }

  /**
   * Stops capture and returns the take.
   * `alignTo` is the context time that should become second 0 of the buffer —
   * pass the transport start so bar 1 lands on sample 0.
   */
  stop(alignTo?: number): AudioBuffer | null {
    this.capturing = false
    if (!this.blocks.length) return null

    const total = this.blocks.reduce((sum, b) => sum + b.length, 0)
    const merged = new Float32Array(total)
    let pos = 0
    for (const block of this.blocks) {
      merged.set(block, pos)
      pos += block.length
    }

    const sr = this.ctx.sampleRate
    let data = merged
    if (alignTo !== undefined) {
      const skip = Math.round((alignTo - this.captureStart) * sr)
      if (skip > 0) data = merged.subarray(Math.min(skip, merged.length))
      else if (skip < 0) {
        // Transport started before the first block: pad so timing still lines up.
        const padded = new Float32Array(merged.length - skip)
        padded.set(merged, -skip)
        data = padded
      }
    }

    if (data.length < 128) return null
    const channel = new Float32Array(data.length)
    channel.set(data)
    const buffer = this.ctx.createBuffer(1, channel.length, sr)
    buffer.copyToChannel(channel, 0)
    this.blocks = []
    this.blockTimes = []
    return buffer
  }

  close(): void {
    this.capturing = false
    this.node?.disconnect()
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.silentSink?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.node = null
    this.source = null
    this.analyser = null
    this.silentSink = null
    this.stream = null
  }
}

/** Decode a dropped or picked audio file into an AudioBuffer. */
export async function decodeFile(ctx: BaseAudioContext, file: File | Blob): Promise<AudioBuffer> {
  const data = await file.arrayBuffer()
  return ctx.decodeAudioData(data)
}
