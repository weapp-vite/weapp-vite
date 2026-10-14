import type { EventEmitter } from 'node:events'
import type { Server } from 'node:http'
import type { Plugin } from 'vite'
import process from 'node:process'
import { createEvidenceWriter, DIAGNOSTICS_ENV, HOST_EVIDENCE_ENV } from './writer'

type ObservedServer = EventEmitter & Pick<Server, 'address'>

/** 只观察原有连接与请求，不读取正文、请求头或发出就绪探测。 */
export function observeHost(server: ObservedServer, record: (event: Record<string, unknown>) => void) {
  let nextSocketId = 0
  const followups = new Set<() => void>()
  const once = (source: EventEmitter, event: string, run: (...args: unknown[]) => void) => {
    let observed: (...args: unknown[]) => void
    function dispose() {
      source.off(event, observed)
      followups.delete(dispose)
    }
    observed = (...args: unknown[]) => {
      followups.delete(dispose)
      run(...args)
    }
    followups.add(dispose)
    source.once(event, observed)
    return dispose
  }
  const ids = new WeakMap<object, number>()
  const idOf = (socket: object) => {
    let id = ids.get(socket)
    if (id === undefined) {
      id = ++nextSocketId
      ids.set(socket, id)
    }
    return id
  }
  const listening = () => record({ event: 'listening', address: server.address() })
  const connection = (socket: import('node:net').Socket) => {
    const socketId = idOf(socket)
    record({ event: 'connection', socketId, localPort: socket.localPort, remotePort: socket.remotePort })
    once(socket, 'close', hadError => record({ event: 'connection-close', socketId, hadError }))
  }
  const request = (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => {
    const socketId = idOf(request.socket)
    let pathname = '<unparsed-url>'
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    }
    catch {}
    record({ event: 'request', socketId, method: request.method, pathname })
    const requestListeners: (() => void)[] = []
    const completed = (event: string) => {
      for (const dispose of requestListeners.splice(0)) {
        dispose()
      }
      record({ event, socketId, status: response.statusCode })
    }
    requestListeners.push(
      once(request, 'aborted', () => completed('request-aborted')),
      once(response, 'finish', () => completed('response-finish')),
      once(response, 'close', () => completed('response-close')),
    )
  }
  const closed = () => record({ event: 'server-close' })
  server.on('listening', listening)
  server.on('connection', connection)
  server.on('request', request)
  server.on('close', closed)
  return () => {
    server.off('listening', listening)
    server.off('connection', connection)
    server.off('request', request)
    server.off('close', closed)
    for (const dispose of followups) {
      dispose()
    }
    followups.clear()
  }
}

/** 仅本任务显式传入的证据文件可启用宿主被动观察。 */
export function hostDiagnostics(environment: NodeJS.ProcessEnv = process.env): Plugin | false {
  const file = environment[HOST_EVIDENCE_ENV]
  if (environment[DIAGNOSTICS_ENV] !== '1' || !file) {
    return false
  }
  const writer = createEvidenceWriter(file, `${file}.errors.json`)
  const disposers: (() => void)[] = []
  const attach = ({ httpServer }: { httpServer: ObservedServer | null }) => {
    writer.record({ event: 'host-identity', pid: process.pid, node: process.version })
    if (httpServer) {
      disposers.push(observeHost(httpServer, event => writer.record(event)))
    }
  }
  return {
    name: 'dimina-e2e-diagnostics',
    configureServer: attach,
    configurePreviewServer: attach,
    async closeBundle() {
      for (const dispose of disposers.splice(0)) {
        dispose()
      }
      await writer.flush()
    },
  }
}
