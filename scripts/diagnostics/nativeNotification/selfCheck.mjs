import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import process from 'node:process'
import { Linter } from 'eslint'
import globals from 'globals'
import { compareModes } from './compare.mjs'
import { createSink } from './sink.mjs'

const linter = new Linter()
for (const filename of await readdir(new URL('./', import.meta.url))) {
  if (!filename.endsWith('.mjs')) {
    continue
  }
  const source = await readFile(new URL(filename, import.meta.url), 'utf8')
  const diagnostics = linter.verify(source, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.es2024, WebSocket: 'readonly' } }, rules: { 'no-undef': 'error' } }])
  assert.deepEqual(diagnostics.map(item => item.message), [], filename)
}
const root = process.cwd()
const target = `${root}/diagnostic-pure-input.ts`
const sink = createSink(root)
sink.activate({ id: 'one', file: target, phase: 'edit', cycle: 0, inputHash: 'hash' })
let release
const barrier = new Promise((resolve) => {
  release = resolve
})
const first = sink.owner('native-js', target, 'update', 'core-a', async () => {
  const span = sink.beginCore(target, 'update')
  await barrier
  sink.notify(span, () => sink.sessionSource(target))
  sink.event(span, 'core.exit')
})
const second = sink.owner('vite-container', target, 'update', 'client', () => {
  const span = sink.beginCore(target, 'update')
  sink.notify(span, () => sink.sessionSource(target))
  sink.event(span, 'core.exit')
})
assert.equal(second, undefined)
release()
await first
sink.finish('one')
const report = sink.export('pure-self-check')
assert.deepEqual(report.events.filter(event => event.type === 'session.source').map(event => event.owner), ['vite-container', 'native-js'])
assert.equal(new Set(report.events.filter(event => event.type === 'core.enter').map(event => event.coreSpan)).size, 2)
assert.equal(report.incompleteWindow, null)
const tiny = createSink(root, 1)
tiny.activate({ id: 'overflow', file: target, phase: 'edit', cycle: 0, inputHash: 'hash' })
tiny.receipt(target, 'change')
assert.equal(tiny.export('limit').overflow, true)
assert.throws(() => compareModes({ failure: 'broken' }, { failure: null }))
function file(source) {
  return { hash: createHash('sha256').update(source).digest('hex'), bytes: Buffer.byteLength(source), base64: Buffer.from(source).toString('base64') }
}
function mode(buildId, port, token, nonce) {
  const control = { buildId, token, url: `http://localhost:${port}/__weapp_vite_hmr` }
  return { failure: null, transportOverflow: false, transport: [], windows: Array.from({ length: 4 }, (_, index) => ({
    id: `cycle:${index}`,
    inputHash: 'same-input',
    sample: { pipeline: 'stateful', profileMode: 'delivery', completionBoundary: 'delivery-acknowledged', wallMs: 1 },
    artifacts: {
      '__weapp_vite_hmr/control.js': file(`globalThis["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"] = ${JSON.stringify(control)};\nunchanged();\n`),
      '__weapp_vite_hmr/update.js': file(`// ${nonce}\nglobalThis.__WEAPP_VITE_STATEFUL_HMR_CLIENT__.receiveBatch(${JSON.stringify({ buildId, changedIds: ['page'], compatible: true, fromVersion: index, targetVersion: index + 1 })}, () => {\nconst behavior = 'same';\n});\n`),
      'app.js': file(`// weapp-vite-stateful-build:${buildId}\nApp({ marker: 1 });\n`),
      'app.json': file('{"pages":["pages/index/index"]}'),
    },
  })) }
}
const control = mode('aaa', 10001, 'aaa-secret', '111')
const probe = mode('bbb', 10002, 'bbb-secret', '222')
assert.equal(compareModes(control, probe).comparable, true)
probe.windows[0].artifacts['app.js'] = file('// weapp-vite-stateful-build:bbb\nApp({ marker: 2 });\n')
assert.equal(compareModes(control, probe).comparable, false)
console.log(JSON.stringify({ exactMetadataMapping: 'passed', behaviorByteDifferenceRejected: true, staticModuleLint: 'passed', pureAsyncOwnershipCheck: 'passed', overflowGuard: 'passed', noChildProcessesOrWatchers: true }))
