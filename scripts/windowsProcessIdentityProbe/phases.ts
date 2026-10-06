import type { Readable } from 'node:stream'
import type { ProbeTimings } from './identity'
import { ENTRY_MARKER, readTimingMarker, TIMING_MARKER } from './identity'

/** 入口时间使用父进程时钟，查询与序列化使用脚本内 Stopwatch，避免跨进程相减时间戳。 */
export function observeProbePhases(stream: Readable | null | undefined, elapsed: () => number, publish: (fields: Record<string, unknown>) => void) {
  let buffer = ''
  let entryMs: number | undefined
  let entryCount = 0
  let timingCount = 0
  let timings: ProbeTimings | undefined
  const snapshot = () => ({
    scriptEntryMs: entryMs,
    queryBodyMs: timings?.queryMs,
    serializationMs: timings?.serializationMs,
    entryMarkerCount: entryCount,
    timingMarkerCount: timingCount,
    phaseEvidenceComplete: entryCount === 1 && timingCount === 1 && timings !== undefined,
  })
  const line = (value: string) => {
    const text = value.replace(/\r$/, '')
    if (text === ENTRY_MARKER) {
      entryCount++
      entryMs ??= elapsed()
    }
    if (text.startsWith(TIMING_MARKER)) {
      timingCount++
      timings = readTimingMarker(text)
    }
    if (text === ENTRY_MARKER || text.startsWith(TIMING_MARKER)) {
      publish(snapshot())
    }
  }
  const data = (chunk: unknown) => {
    buffer += String(chunk)
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      line(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  stream?.on('data', data)
  return {
    finish() {
      stream?.off('data', data)
      if (buffer) {
        line(buffer)
        buffer = ''
      }
      return snapshot()
    },
  }
}
