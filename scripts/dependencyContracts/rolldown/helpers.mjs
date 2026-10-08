import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { setImmediate as nextTask } from 'node:timers/promises'

export async function diagnosticGc(passes = 8) {
  assert.equal(typeof globalThis.gc, 'function', 'Use --expose-gc')
  for (let pass = 0; pass < passes; pass++) {
    await nextTask()
    globalThis.gc()
  }
  await nextTask()
}

export function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

export async function fixture(root, name) {
  const cwd = path.join(root, name)
  await mkdir(cwd, { recursive: true })
  await writeFile(path.join(cwd, 'dep.js'), 'export const value = 41\n')
  await writeFile(path.join(cwd, 'entry.js'), 'import { value } from \'./dep.js\'\nexport const result = value + 1\n')
  return { cwd, entry: path.join(cwd, 'entry.js'), dependency: path.join(cwd, 'dep.js') }
}

export function stableValue(value) {
  if (typeof value === 'function') {
    return '[function]'
  }
  if (value instanceof RegExp) {
    return { source: value.source, flags: value.flags, lastIndex: value.lastIndex }
  }
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stableValue(item)]))
  }
  return value
}

export function hashText(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function outputCode(output) {
  const chunks = output.output.filter(item => item.type === 'chunk' && item.isEntry)
  assert.ok(chunks.length > 0, 'expected an entry chunk')
  return chunks.map(chunk => ({ fileName: chunk.fileName, code: chunk.code, bytes: Buffer.byteLength(chunk.code), sha256: hashText(chunk.code) }))
}

export async function writtenOutput(root, output) {
  const chunks = outputCode(output)
  const files = []
  for (const chunk of chunks) {
    const file = path.join(root, chunk.fileName)
    const code = await readFile(file, 'utf8')
    files.push({ fileName: chunk.fileName, bytes: Buffer.byteLength(code), sha256: hashText(code), code })
    assert.equal(code, chunk.code, chunk.fileName)
  }
  return files
}

export async function runtimeResult(code, format, writtenFile) {
  if (format === 'es') {
    const namespace = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    return namespace.result
  }
  assert.equal(format, 'cjs')
  assert.equal(path.extname(writtenFile), '.cjs')
  const require = createRequire(import.meta.url)
  return require(writtenFile).result
}

export function contractError(error) {
  return {
    name: error?.name,
    code: error?.code,
    message: error?.message ?? String(error),
    plugin: error?.plugin,
    hook: error?.hook,
  }
}

export const inputKeys = ['input', 'cwd', 'platform', 'shimMissingExports', 'context', 'plugins']
export const outputKeys = ['dir', 'entryFileNames', 'chunkFileNames', 'assetFileNames', 'format', 'exports', 'sourcemap', 'sourcemapFileNames', 'sourcemapBaseUrl', 'shimMissingExports', 'name', 'file', 'codeSplitting', 'inlineDynamicImports', 'dynamicImportInCjs', 'externalLiveBindings', 'banner', 'footer', 'postBanner', 'postFooter', 'intro', 'outro', 'esModule', 'extend', 'globals', 'paths', 'hashCharacters', 'sourcemapDebugIds', 'sourcemapExcludeSources', 'sourcemapIgnoreList', 'sourcemapPathTransform', 'minify', 'legalComments', 'comments', 'polyfillRequire', 'plugins', 'preserveModules', 'preserveModulesRoot', 'virtualDirname', 'topLevelVar', 'minifyInternalExports']

export function describeOptions(input, output) {
  const describe = (object, keys) => Object.fromEntries(keys.map(key => [key, key === 'plugins' ? object[key].map(plugin => plugin.name) : stableValue(object[key])]))
  return { input: describe(input, inputKeys), output: describe(output, outputKeys) }
}

export function assertLazyDescriptor(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  assert.equal(descriptor.enumerable, true)
  assert.equal(descriptor.configurable, true)
  assert.equal(typeof descriptor.get, 'function')
  assert.equal(descriptor.set, undefined)
}

export function assertChunk(output) {
  const chunk = output.output.find(item => item.type === 'chunk' && item.isEntry)
  assert.ok(chunk)
  assert.ok(chunk.exports.includes('result'))
  return chunk
}

export class UnconfirmedContractCleanupError extends AggregateError {}

export function createContractCleanupKey(reportFile, fixtureRoot, pid) {
  assert.ok(path.isAbsolute(reportFile) && path.isAbsolute(fixtureRoot), 'Contract ownership requires resolved report and fixture locations')
  assert.ok(Number.isSafeInteger(pid) && pid > 0, 'Contract ownership requires the running process')
  return `rolldown-contract:${JSON.stringify({ reportFile, fixtureRoot, pid })}`
}

export const contractNames = ['hooks', 'escaped', 'closing', 'failures', 'failFast', 'retention', 'watching', 'scanning']

export function parseContractArguments(args) {
  assert.equal(args.length, 2, 'Usage: run.mjs --report <file>')
  assert.equal(args[0], '--report', 'Only --report is supported; every contract is mandatory')
  assert.ok(args[1]?.trim() && !args[1].startsWith('--'), 'A report file is required')
  return { reportFile: path.resolve(args[1]) }
}

export function completeContractReport(report) {
  assert.equal(report.status, 'running', 'Only a running report can complete')
  assert.deepEqual(report.results.map(item => item.name), contractNames, 'All contracts must complete in order')
  for (const item of report.results) {
    assert.equal(item.status, 'passed', `${item.name} did not pass`)
    assert.ok(Number.isFinite(item.durationMs) && item.durationMs >= 0, `${item.name} has no duration`)
    assert.ok(item.result && typeof item.result === 'object', `${item.name} has no observations`)
  }
  assert.equal(report.error, undefined, 'A report with an error cannot pass')
  return { ...report, status: 'passed' }
}

export function normalizeReport(value, root) {
  if (typeof value === 'string') {
    const normalized = value.replaceAll(root, '<fixture>').replaceAll(root.replaceAll('\\', '/'), '<fixture>')
    return normalized.includes('<fixture>') ? normalized.replaceAll('\\', '/') : normalized
  }
  if (Array.isArray(value)) {
    return value.map(item => normalizeReport(item, root))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeReport(item, root)]))
  }
  return value
}
