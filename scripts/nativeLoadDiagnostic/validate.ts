import { isDeepStrictEqual } from 'node:util'

export const MODES = ['off', 'on-no-load', 'load-only', 'actual'] as const
export type LoadMode = typeof MODES[number]
export const PHASES = ['import', 'no-hint', 'batch', 'cached-warning', 'repeat-last', 'parse-failure', 'recovery', 'finished-workload'] as const

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

/** 此入口只验证单个主线程的定序源码探针，不把退出缺失或零事件当作成功。 */
export function validateLoadTrace(raw: string, mode: LoadMode) {
  const rows = raw.trim().split(/\r?\n/).map((line): Record<string, unknown> => {
    const row: unknown = JSON.parse(line)
    ensure(row && typeof row === 'object' && !Array.isArray(row), 'Invalid native load event')
    return row as Record<string, unknown>
  })
  const first = rows[0]!
  ensure(first.kind === 'started' && first.nativeEnabled === (mode !== 'off') && first.bindingConfigured === true && Number.isSafeInteger(first.pid) && Number(first.pid) > 0, 'Missing process startup')
  let elapsed = 0
  let phase = 'startup'
  let loadPending = false
  let loaded = false
  let channelPending = false
  let methodPending: string | undefined
  const phases: string[] = []
  const events: Array<{ kind: string, phase: string, method?: string }> = []
  const counts: Record<string, number> = {}
  for (const [index, row] of rows.entries()) {
    ensure(row.version === 1 && row.mode === mode && row.pid === first.pid && row.threadId === 0
      && row.seq === index && typeof row.elapsedMs === 'number' && Number.isFinite(row.elapsedMs) && row.elapsedMs >= elapsed, 'Invalid native load sequence or process identity')
    elapsed = row.elapsedMs
    ensure(typeof row.kind === 'string' && ['started', 'finished', 'phase', 'binding-request', 'load-start', 'load-success', 'load-error', 'binding-call', 'binding-return', 'binding-exception', 'call', 'cacheHits', 'fallbacks', 'loadFailures'].includes(row.kind), 'Invalid native event payload')
    counts[row.kind] = (counts[row.kind] ?? 0) + 1
    if (row.kind === 'phase') {
      ensure(!loadPending && !channelPending && !methodPending, 'Phase changed during unfinished native work')
      ensure(typeof row.phase === 'string' && row.phase === PHASES[phases.length], 'Missing or reordered phase')
      phases.push(row.phase)
      phase = row.phase
    }
    ensure(row.phase === phase, 'Event phase differs from active phase')
    if (row.kind === 'binding-request') {
      ensure(phase === 'batch' && counts['binding-request'] === 1, 'Unexpected lazy require boundary')
    }
    if (row.kind === 'load-start') {
      ensure(counts['binding-request'] === 1 && !loadPending && !loaded, 'Invalid load start order')
      loadPending = true
    }
    if (row.kind === 'load-success') {
      ensure(loadPending && !loaded, 'Load finished before it started')
      loadPending = false
      loaded = true
    }
    if (['call', 'cacheHits', 'fallbacks', 'loadFailures'].includes(row.kind)) {
      ensure(row.origin === 'channel', 'Missing channel origin')
    }
    if (row.kind === 'call') {
      ensure(!channelPending && !methodPending && typeof row.batch === 'boolean'
        && Number.isSafeInteger(row.inputScripts) && Number(row.inputScripts) > 0
        && Number.isSafeInteger(row.inputBytes) && Number(row.inputBytes) > 0, 'Invalid native call event')
      channelPending = true
    }
    if (row.kind === 'binding-call') {
      ensure(mode === 'actual' && loaded && !loadPending && channelPending && !methodPending
        && typeof row.method === 'string', 'Native method called outside observed invocation')
      channelPending = false
      methodPending = row.method
    }
    if (row.kind === 'binding-return' || row.kind === 'binding-exception') {
      ensure(methodPending !== undefined && row.method === methodPending, 'Native result has no matching invocation')
      methodPending = undefined
    }
    if (row.kind.startsWith('binding-') || row.kind.startsWith('load-') || row.origin === 'channel') {
      ensure(phase && phase !== 'import' && phase !== 'no-hint', 'Import or negative hint unexpectedly loaded native')
      events.push({ kind: row.kind, phase, ...(typeof row.method === 'string' ? { method: row.method } : {}) })
    }
  }
  ensure(!loadPending && !channelPending && !methodPending, 'Incomplete final native work')
  ensure(isDeepStrictEqual(phases, PHASES), 'Missing or reordered workload phases')
  ensure(counts.started === 1 && counts.finished === 1 && rows.at(-1)!.kind === 'finished' && rows.at(-1)!.exitCode === 0 && rows.at(-1)!.invalidEvents === 0, 'Incomplete process lifetime')
  const count = (kind: string) => counts[kind] ?? 0
  ensure(count('binding-request') === Number(mode !== 'off'), 'Unexpected wrapper initialization count')
  ensure(count('load-start') === Number(mode === 'load-only' || mode === 'actual') && count('load-success') === count('load-start')
    && count('load-error') === 0 && count('loadFailures') === 0, 'Unexpected native loading state')
  for (const row of rows.filter(row => row.kind === 'load-success')) {
    ensure(typeof row.durationMs === 'number' && Number.isFinite(row.durationMs) && row.durationMs >= 0 && row.nodeModulesAdded === 1, 'Expected one fresh native module')
  }
  if (mode === 'actual') {
    ensure(count('binding-call') > 0 && count('binding-call') === count('call')
      && count('binding-call') === count('binding-return') + count('binding-exception'), 'Missing actual native call evidence')
    ensure(count('cacheHits') >= 2 && count('binding-exception') >= 1 && count('fallbacks') >= 1, 'Missing cache or parse failure recovery coverage')
    ensure(['cached-warning', 'repeat-last'].every(phase => events.some(row => row.phase === phase && row.kind === 'cacheHits')), 'Missing phase-specific cache hit')
    ensure(['binding-exception', 'fallbacks'].every(kind => events.some(row => row.phase === 'parse-failure' && row.kind === kind)), 'Missing parse failure fallback')
    ensure(events.filter(row => row.kind === 'binding-exception' || row.kind === 'fallbacks').every(row => row.phase === 'parse-failure'), 'Unexpected valid-source native failure or fallback')
    ensure(['batch', 'recovery'].every(phase => events.some(row => row.phase === phase && row.kind === 'binding-return' && row.method === 'analyzeScriptsNative')), 'Missing successful native batch or recovery')
    ensure(rows.filter(row => row.kind === 'binding-return').every(row => row.nullish === false), 'Unexpected missing native result')
  }
  else {
    ensure(count('binding-call') === 0 && count('call') === 0 && count('binding-exception') === 0 && count('cacheHits') === 0, 'Non-native variant called native')
    ensure(mode === 'off' ? count('fallbacks') === 0 : count('fallbacks') > 0, 'Missing enabled JS fallback evidence')
  }
  return {
    mode,
    completedProcesses: 1,
    wrapperInitializations: count('binding-request'),
    nativeLoads: count('load-success'),
    nativeCalls: count('binding-call'),
    nativeExceptions: count('binding-exception'),
    analysisCacheHits: count('cacheHits'),
    observedFallbackEvents: count('fallbacks'),
    phases,
    events,
  }
}
