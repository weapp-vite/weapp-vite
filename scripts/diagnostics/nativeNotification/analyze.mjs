import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const runRoot = path.resolve(process.argv[2] ?? '')
assert(process.argv[2], 'Pass the owned diagnostic run directory')
const pair = JSON.parse(await readFile(path.join(runRoot, 'pair-result.json'), 'utf8'))
const probe = pair.modes.find(mode => mode.mode === 'probe')
assert(probe?.selectedTrace, 'Probe did not produce a selected trace')
const trace = JSON.parse(await readFile(path.join(runRoot, 'probe/traces', probe.selectedTrace), 'utf8'))
const driver = JSON.parse(await readFile(path.join(runRoot, 'probe/driver-events.json'), 'utf8'))
assert(!trace.overflow && !driver.transportOverflow)
function elapsed(events, start, end) {
  const a = events.find(event => event.type === start)
  const b = events.find(event => event.type === end)
  return a && b ? b.at - a.at : null
}
const results = driver.windows.map((window) => {
  const events = trace.events.filter(event => event.observationWindow === window.id)
  const ids = [...new Set(events.filter(event => event.coreSpan !== null).map(event => event.coreSpan))]
  const spans = ids.map((id) => {
    const selected = events.filter(event => event.coreSpan === id)
    return { id, owner: selected[0].owner, ownerSpan: selected[0].ownerSpan, events: selected.map(({ type, at, event, dirtyReasonSummary }) => ({ type, at, event, dirtyReasonSummary })), normalizationMs: elapsed(selected, 'core.normalize.begin', 'core.normalized'), invalidationMs: elapsed(selected, 'core.invalidate.begin', 'core.invalidate.end'), coreToNotifyMs: elapsed(selected, 'core.enter', 'core.notify'), coreToSessionMs: elapsed(selected, 'core.enter', 'session.source'), totalMs: elapsed(selected, 'core.enter', 'core.exit') }
  })
  const range = (type) => {
    const point = events.find(event => event.type === type)
    if (!point || window.writeBegin === undefined) {
      return null
    }
    return { lowerMs: point.at - window.writeBegin - window.calibration.offsetUpper, upperMs: point.at - window.writeBegin - window.calibration.offsetLower, calibrationRoundTripMs: window.calibration.roundTripMs }
  }
  return { id: window.id, phase: window.phase, cycle: window.cycle, writeDurationMs: window.writeEnd - window.writeBegin, observationWindowOnly: true, wallMs: window.sample?.wallMs, spans, nativeCallbacks: events.filter(event => event.type === 'native.callback').map(({ at, plugin, ownerSpan }) => ({ at, plugin, ownerSpan })), viteEvents: events.filter(event => event.type.startsWith('vite.')), writeToFirstCoreRange: range('core.enter'), writeToFirstNativeCallbackRange: range('native.callback'), writeToFirstViteReceiptRange: range('vite.receipt'), writeToFirstSessionRange: range('session.source') }
})
const report = { diagnosticOnly: true, outputEquivalence: pair.comparison?.comparable ?? false, pairErrors: pair.errors, outOfWindowEvents: trace.events.filter(event => event.observationWindow === null), results, limitations: ['Native callback is downstream of native event delivery, scheduling, locking and earlier plugins; no OS receipt claim.', 'The active observation window is not a propagated native mutation ID. Duplicate or late callbacks need explicit analysis; this report does not silently pair by nearest timestamp.', 'Clock offset bounds come from the activation inspector round trip. No midpoint or epoch-time exactness is assumed.', 'Control/probe are single diagnostic runs, not formal performance samples or proof of a platform-specific cause.'] }
await writeFile(path.join(runRoot, 'notification-analysis.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ windows: results.length, coreSpans: results.reduce((sum, item) => sum + item.spans.length, 0), outputEquivalence: report.outputEquivalence, pairErrors: pair.errors.length }))
