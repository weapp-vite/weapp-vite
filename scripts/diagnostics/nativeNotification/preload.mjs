import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createSink } from './sink.mjs'
import { transform } from './transform.mjs'

assert.equal(process.env.WEAPP_NATIVE_NOTIFICATION_SLOT, '1', 'Exclusive runtime slot must be explicitly assigned')
const root = fileURLToPath(new URL('../../', import.meta.url))
const mode = process.env.WEAPP_NATIVE_NOTIFICATION_MODE
assert(['control', 'probe'].includes(mode))
const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
const hash = source => createHash('sha256').update(source).digest('hex')
const files = new Map(manifest.files.map(file => [path.join(root, file.path), file]))
const sink = createSink(root)
globalThis[Symbol.for('weapp-vite.ignored.native-notification')] = sink
if (mode === 'probe') {
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context)
      if (!url.startsWith('file:')) {
        return result
      }
      const filename = fileURLToPath(url)
      const expected = files.get(filename)
      if (!expected) {
        return result
      }
      const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8')
      assert.equal(hash(source), expected.sourceHash, `${expected.path} drifted since preparation`)
      const transformed = transform(source, filename, expected.kind)
      assert.equal(hash(transformed.source), expected.transformedHash)
      sink.module(expected)
      return { ...result, source: transformed.source }
    },
  })
}
let count = 0
function flush(reason) {
  const out = process.env.WEAPP_NATIVE_NOTIFICATION_OUTPUT
  assert(out && path.isAbsolute(out))
  const report = sink.export(reason)
  report.mode = mode
  report.integrity = { modulesUnchanged: manifest.files.every(file => hash(readFileSync(path.join(root, file.path))) === file.sourceHash), sourcesUnchanged: Object.entries(manifest.sources).every(([file, expected]) => hash(readFileSync(path.join(root, file))) === expected), nativeUnchanged: hash(readFileSync(path.join(root, manifest.native.path))) === manifest.native.hash }
  writeFileSync(path.join(out, `events-${process.pid}-${++count}.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
}
function safeFlush(reason) {
  try {
    flush(reason)
  }
  catch (error) {
    process.stderr.write(`[native-notification:export-error] ${String(error?.message ?? error).replaceAll(root, '<repo>')}\n`)
  }
}
process.once('exit', () => safeFlush('exit'))
function terminate() {
  try {
    safeFlush('SIGTERM-before-existing-cleanup')
  }
  finally {
    if (process.listenerCount('SIGTERM') === 1) {
      process.removeListener('SIGTERM', terminate)
      process.kill(process.pid, 'SIGTERM')
    }
  }
}
process.prependListener('SIGTERM', terminate)
