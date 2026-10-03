import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

const controlPath = '__weapp_vite_hmr/control.js'
const updatePath = '__weapp_vite_hmr/update.js'
const digest = text => createHash('sha256').update(text).digest('hex')
const decode = file => Buffer.from(file.base64, 'base64').toString('utf8')
function canonicalize(files) {
  assert(files[controlPath], 'Missing stateful control artifact')
  const controlSource = decode(files[controlPath])
  const controlMatch = /globalThis\["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"\] = (\{[^\r\n]+\});/.exec(controlSource)
  assert(controlMatch, 'Control source contract drifted')
  const control = JSON.parse(controlMatch[1])
  assert.deepEqual(Object.keys(control).sort(), ['buildId', 'token', 'url'])
  assert.equal(typeof control.buildId, 'string')
  assert.equal(typeof control.token, 'string')
  const url = new URL(control.url)
  assert.equal(url.protocol, 'http:')
  assert.equal(url.hostname, 'localhost')
  assert(url.port && Number.isFinite(Number(url.port)))
  const canonical = {}
  const rules = []
  for (const [filename, file] of Object.entries(files)) {
    let bytes = Buffer.from(file.base64, 'base64')
    assert.equal(digest(bytes), file.hash)
    assert.equal(bytes.length, file.bytes)
    if (filename.endsWith('.js')) {
      let source = bytes.toString('utf8')
      const stamp = `// weapp-vite-stateful-build:${control.buildId}\n`
      const stampCount = source.split(stamp).length - 1
      if (stampCount) {
        source = source.replaceAll(stamp, '// weapp-vite-stateful-build:<build>\n')
        rules.push({ filename, rule: 'exact full-build comment', occurrences: stampCount })
      }
      if (filename === controlPath) {
        const normalized = { ...control, buildId: '<build>', token: '<token>', url: `${url.protocol}//${url.hostname}:<port>${url.pathname}${url.search}${url.hash}` }
        source = source.replace(controlMatch[0], controlMatch[0].replace(controlMatch[1], JSON.stringify(normalized)))
        rules.push({ filename, rule: 'control object buildId/token/port only', occurrences: 1 })
      }
      if (filename === updatePath && source !== 'void 0;\n') {
        const header = /^\/\/ ([a-f\d]+)\nglobalThis\.__WEAPP_VITE_STATEFUL_HMR_CLIENT__\.receiveBatch\((\{[^\r\n]+\}), \(\) => \{\n/.exec(source)
        assert(header, 'Update metadata header contract drifted')
        const metadata = JSON.parse(header[2])
        assert.equal(metadata.buildId, control.buildId)
        assert.deepEqual(Object.keys(metadata).sort(), ['buildId', 'changedIds', 'compatible', 'fromVersion', 'targetVersion'])
        source = source.replace(header[0], header[0].replace(header[1], '<nonce>').replace(header[2], JSON.stringify({ ...metadata, buildId: '<build>' })))
        rules.push({ filename, rule: 'update header nonce + metadata buildId only', occurrences: 1 })
      }
      bytes = Buffer.from(source)
    }
    canonical[filename] = digest(bytes)
  }
  return { canonical, rules, identity: { buildId: control.buildId, tokenSha256: digest(control.token), url: control.url } }
}

export function compareModes(control, probe) {
  assert(!control.failure && !probe.failure)
  assert(!control.transportOverflow && !probe.transportOverflow)
  assert.deepEqual(control.windows.map(item => item.id), probe.windows.map(item => item.id))
  assert.equal(control.windows.length, 4)
  const comparisons = control.windows.map((left, index) => {
    const right = probe.windows[index]
    assert.equal(left.inputHash, right.inputHash)
    assert.equal(left.sample.pipeline, 'stateful')
    assert.equal(right.sample.pipeline, 'stateful')
    assert.equal(left.sample.profileMode, 'delivery')
    assert.equal(right.sample.profileMode, 'delivery')
    assert.equal(left.sample.completionBoundary, 'delivery-acknowledged')
    assert.equal(right.sample.completionBoundary, 'delivery-acknowledged')
    const a = canonicalize(left.artifacts)
    const b = canonicalize(right.artifacts)
    const files = new Set([...Object.keys(a.canonical), ...Object.keys(b.canonical)])
    const differences = [...files].filter(file => a.canonical[file] !== b.canonical[file])
    const events = report => report.transport.filter(item => item.observationWindow === left.id).map(({ type, targetVersion }) => ({ type, targetVersion }))
    const aEvents = events(control)
    const bEvents = events(probe)
    return { id: left.id, inputSha256: left.inputHash, fileCount: files.size, differences, controlIdentity: a.identity, probeIdentity: b.identity, controlRules: a.rules, probeRules: b.rules, controlTransport: aEvents, probeTransport: bEvents, transportEquivalent: JSON.stringify(aEvents) === JSON.stringify(bEvents), controlWallMs: left.sample.wallMs, probeWallMs: right.sample.wallMs }
  })
  return { comparisons, comparable: comparisons.every(item => !item.differences.length && item.transportEquivalent), limitations: ['Known build identity, generated token, ephemeral port and publish nonce are mapped only at their explicit output contracts.', 'Other differing bytes fail equivalence; there is no global string/path/source-map normalization.', 'Probe samples are diagnostics; they do not replace frozen performance samples.'] }
}
