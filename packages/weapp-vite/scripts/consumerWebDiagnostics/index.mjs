import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

const eventLimit = 160
const textLimit = 2048
const serverKinds = new Set(['listeners-attached', 'listeners-removed', 'watcher:raw', 'watcher:change', 'handleHotUpdate:before', 'handleHotUpdate:after', 'limit-reached'])

/** 仅收集有界诊断，不参与原等待、重试或通过判定，也不读取请求头与凭据。 */
export function createConsumerWebDiagnostics({ root, repoRoot, host }) {
  const startedAt = new Date().toISOString()
  const startedMonotonicMs = performance.now()
  const events = []
  const writes = []
  const serverEvents = []
  const pendingLines = new Map()
  let droppedEvents = 0
  let droppedServerEvents = 0
  let phase = 'setup'
  let firstFailure
  const roots = [[root, '<consumer>'], [repoRoot, '<repo>'], [homedir(), '<home>'], [tmpdir(), '<tmp>']]
    .sort(([left], [right]) => right.length - left.length)

  function text(value) {
    let safe = stripVTControlCharacters(String(value))
    for (const [directory, label] of roots) {
      for (const spelling of new Set([directory, directory.replaceAll('\\', '/'), directory.replaceAll('\\', '\\\\'), pathToFileURL(directory).href, encodeURI(directory)])) {
        safe = safe.replaceAll(spelling, label)
      }
    }
    safe = safe
      .replace(/(?:\/Users\/|\/home\/|[a-z]:[\\/]Users[\\/])[^\s/\\"'<>]+/gi, '<home>')
      .replace(/(https?|wss?):\/\/[^/\s@]+@/gi, '$1://<redacted>@')
      .replace(/(https?|wss?):\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/g, '$1://<loopback>')
      .replace(/\?[^\s"'<>]*/g, '?<redacted>')
      .replace(/\b(Bearer|Basic)\s+[^\s"'<>]+/gi, '$1 <redacted>')
      .replace(/(["']?(?:access_token|refresh_token|token|authorization|cookie|password|secret|api[_-]?key)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1<redacted>')
    return safe.length > textLimit ? `${safe.slice(0, textLimit)}<truncated>` : safe
  }

  function record(kind, data = {}) {
    if (events.length === eventLimit) {
      events.shift()
      droppedEvents++
    }
    events.push({ kind, phase, elapsedMs: performance.now() - startedMonotonicMs, ...data })
  }

  function sourceIdentity(content) {
    return { sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content) }
  }

  function observeSocket(socket) {
    const url = new URL(socket.url())
    record('websocket-open', { protocol: url.protocol, path: text(url.pathname) })
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string' || payload.length > 32 * 1024) {
        record('websocket-frame-omitted', { bytes: payload.length })
        return
      }
      let message
      try {
        message = JSON.parse(payload)
      }
      catch {
        return
      }
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return
      }
      const updates = Array.isArray(message.updates) ? message.updates : []
      record('hmr-frame', {
        type: text(message.type),
        path: typeof message.path === 'string' ? text(message.path) : undefined,
        updateCount: updates.length,
        updates: updates.slice(0, 20).filter(update => update && typeof update === 'object').map(update => ({
          type: typeof update.type === 'string' ? text(update.type) : undefined,
          path: typeof update.path === 'string' ? text(update.path) : undefined,
          acceptedPath: typeof update.acceptedPath === 'string' ? text(update.acceptedPath) : undefined,
          timestamp: typeof update.timestamp === 'number' ? update.timestamp : undefined,
        })),
      })
    })
    socket.on('socketerror', error => record('websocket-error', { message: text(error) }))
    socket.on('close', () => record('websocket-close'))
  }

  function observeServerLine(line) {
    const prefix = '[web-consumer-server] '
    if (!line.startsWith(prefix)) {
      return
    }
    let observation
    try {
      observation = JSON.parse(line.slice(prefix.length))
    }
    catch {
      return
    }
    if (!observation || !serverKinds.has(observation.kind)) {
      return
    }
    const selected = { kind: observation.kind, file: 'src/pages/index/index.vue' }
    for (const key of ['monotonicMs', 'timeOriginMs', 'timestamp', 'moduleCount', 'limit']) {
      if (typeof observation[key] === 'number' && Number.isFinite(observation[key])) {
        selected[key] = observation[key]
      }
    }
    if (typeof observation.event === 'string') {
      selected.event = text(observation.event)
    }
    if (Array.isArray(observation.modules)) {
      selected.modules = observation.modules.slice(0, 12).filter(id => typeof id === 'string').map(text)
    }
    if (observation.options && typeof observation.options === 'object') {
      selected.options = Object.fromEntries(['usePolling', 'useFsEvents', 'interval', 'atomic', 'awaitWriteFinish', 'stabilityThreshold', 'pollInterval']
        .filter(key => typeof observation.options[key] === 'boolean' || (typeof observation.options[key] === 'number' && Number.isFinite(observation.options[key])))
        .map(key => [key, observation.options[key]]))
    }
    if (serverEvents.length === 100) {
      serverEvents.shift()
      droppedServerEvents++
    }
    serverEvents.push({ receivedMs: performance.now() - startedMonotonicMs, ...selected })
  }

  return {
    setPhase(next) {
      phase = next
      record('phase')
    },
    visible(label) {
      record('visible', { label })
    },
    observePage(page) {
      page.on('pageerror', error => record('pageerror', { message: text(error.message) }))
      page.on('websocket', observeSocket)
    },
    observeChild(chunk, stream) {
      const lines = ((pendingLines.get(stream) ?? '') + String(chunk)).split('\n')
      pendingLines.set(stream, lines.pop().slice(-16 * 1024))
      lines.forEach(observeServerLine)
    },
    startWrite(label, content) {
      const write = { label, beganAt: new Date().toISOString(), beganMs: performance.now() - startedMonotonicMs, requested: sourceIdentity(content), completed: false }
      writes.push(write)
      if (writes.length > 8) {
        writes.shift()
      }
      return write
    },
    finishWrite(write) {
      Object.assign(write, { completed: true, finishedAt: new Date().toISOString(), finishedMs: performance.now() - startedMonotonicMs })
    },
    fail(error, content) {
      firstFailure ??= { phase, elapsedMs: performance.now() - startedMonotonicMs, message: text(error instanceof Error ? error.message : error), source: content === undefined ? undefined : sourceIdentity(content) }
    },
    async save(outcome) {
      const directory = path.join(repoRoot, '.cache/web-consumer-diagnostic')
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, `${host}.json`), `${JSON.stringify({
        schemaVersion: 1,
        diagnosticOnly: true,
        host,
        outcome,
        startedAt,
        startedMonotonicMs,
        timeOriginMs: performance.timeOrigin,
        phase,
        firstFailure,
        droppedEvents,
        droppedServerEvents,
        writes,
        serverEvents,
        events,
      }, null, 2)}\n`)
    },
  }
}
