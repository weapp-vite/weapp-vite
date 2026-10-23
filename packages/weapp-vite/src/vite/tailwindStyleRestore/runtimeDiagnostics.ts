import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'

export interface DiagnosticRuntime {
  isClosed: boolean
  evaluateRuntime: <T = unknown>(source: string, args?: unknown[]) => T
}

type RecordObservation = (event: string, details?: Record<string, unknown>, at?: number) => void

const diagnosticKey = 'weapp-vite:tailwind-style-restore:test-diagnostics'

/** 仅复制协议摘要；false 分支不读取实例 data、properties 或用户 getter。 */
const snapshotSource = `() => {
  const client = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}];
  const bridge = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}];
  return {
    version: client?.getVersion?.(),
    phase: client?.getTransportState?.().phase,
    lastApply: client?.lastApply,
    bridge: bridge?.getDebugSnapshot?.(false),
  };
}`

/** 透明观察原 receiveBatch 的同步边界，不调用渲染、导航、调度器或客户端控制方法。 */
export function createRuntimeDiagnostics(record: RecordObservation, epoch: number) {
  const observe = (event: string, operation: () => void) => {
    try {
      operation()
    }
    catch {
      record('observation-failed', { observation: event })
    }
  }
  return {
    install(runtime: DiagnosticRuntime) {
      observe('install-runtime', () => runtime.evaluateRuntime(`() => {
        const trace = [];
        globalThis[${JSON.stringify(diagnosticKey)}] = trace;
        const snapshot = ${snapshotSource};
        const client = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}];
        const emit = (event, meta) => {
          try {
            trace.push(JSON.parse(JSON.stringify({ at: Date.now() - ${epoch}, event, meta, state: snapshot() })));
          } catch { trace.push({ event: 'observation-failed', observation: event }); }
        };
        const original = client.receiveBatch;
        client.receiveBatch = function (...args) {
          emit('receiveBatch:entered', args[0]);
          try { return Reflect.apply(original, this, args); }
          finally { emit('receiveBatch:returned', args[0]); }
        };
      }`))
    },
    capture(runtime: DiagnosticRuntime | undefined, event: string, details: Record<string, unknown> = {}) {
      if (!runtime || runtime.isClosed) {
        return
      }
      observe(event, () => {
        const result = runtime.evaluateRuntime<unknown>(`() => {
          const snapshot = ${snapshotSource};
          return JSON.parse(JSON.stringify({ state: snapshot(), trace: globalThis[${JSON.stringify(diagnosticKey)}]?.splice(0) ?? [] }));
        }`)
        if (!result || typeof result !== 'object' || !('trace' in result) || !Array.isArray(result.trace)) {
          throw new Error('Invalid runtime diagnostic snapshot')
        }
        for (const value of result.trace as unknown[]) {
          if (!value || typeof value !== 'object' || !('event' in value) || typeof value.event !== 'string') {
            throw new Error('Invalid runtime diagnostic event')
          }
          const { event: name, at, ...observation } = value as Record<string, unknown> & { event: string }
          record(name, observation, typeof at === 'number' ? at : undefined)
        }
        record(event, { ...details, state: 'state' in result ? result.state : undefined })
      })
    },
  }
}
