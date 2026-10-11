import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

interface ChildReport {
  before: string | null
  during: string | null
  after: string | null
  result: boolean | null
  value: number | null
  warnings: string[]
  error: { name: string, message: string, frame: string | null } | null
  env: Record<string, string | null>
}

interface RunOptions {
  env?: NodeJS.ProcessEnv
  nodeVersion?: string
  action?: 'read' | 'throw'
  command?: 'build' | 'prepare'
}

const bootstrapUrl = new URL('../bin/bootstrap.js', import.meta.url).href
const runNode = promisify(execFile)
const cacheEnvKeys = ['NODE_COMPILE_CACHE', 'NODE_DISABLE_COMPILE_CACHE', 'NODE_COMPILE_CACHE_PORTABLE', 'NODE_V8_COVERAGE', 'VITEST']
let fixture: string

async function writeSubject(value: number) {
  const source = `export const value = ${value}\nexport function fail() {\n  throw new Error('compile-cache-contract')\n}\n`
  await writeFile(path.join(fixture, 'subject.mjs'), `${source}//# sourceMappingURL=subject.mjs.map\n`)
  await writeFile(path.join(fixture, 'original.ts'), source.replace('const value', 'const value: number'))
  await writeFile(path.join(fixture, 'subject.mjs.map'), JSON.stringify({
    version: 3,
    file: 'subject.mjs',
    sources: ['original.ts'],
    sourcesContent: [source.replace('const value', 'const value: number')],
    names: [],
    mappings: 'AAAA;AACA;AACA;AACA',
  }))
}

beforeEach(async () => {
  fixture = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-cli-cache-')))
  await writeSubject(41)
  // 只调用真实 bootstrap 与文件模块，不进入 CLI 构建、watch 或 IDE。
  await writeFile(path.join(fixture, 'run.mjs'), `
import nodeModule from 'node:module'
import process from 'node:process'
import { runWeappViteCLI } from ${JSON.stringify(bootstrapUrl)}
const options = JSON.parse(process.argv[2])
const report = {
  before: nodeModule.getCompileCacheDir() ?? null,
  during: null, after: null, result: null, value: null, error: null, warnings: [],
}
try {
  report.result = await runWeappViteCLI({
    argv: [options.command ?? 'build'],
    ...(options.nodeVersion ? { nodeVersion: options.nodeVersion } : {}),
    write: message => report.warnings.push(message),
    importer: async () => {
      report.during = nodeModule.getCompileCacheDir() ?? null
      const subject = await import('./subject.mjs')
      report.value = subject.value
      if (options.action === 'throw') subject.fail()
    },
  })
}
catch (error) {
  report.error = {
    name: error.name,
    message: error.message,
    frame: error.stack?.match(/(?:original\\.ts|subject\\.mjs):\\d+:\\d+/)?.[0] ?? null,
  }
}
report.after = nodeModule.getCompileCacheDir() ?? null
report.env = Object.fromEntries(${JSON.stringify(cacheEnvKeys)}.map(key => [key, process.env[key] ?? null]))
console.log(JSON.stringify(report))
`)
})

afterEach(async () => {
  await rm(fixture, { recursive: true, force: true })
})

async function runChild(options: RunOptions = {}): Promise<ChildReport> {
  const env = { ...process.env }
  for (const key of [...cacheEnvKeys, 'NODE_OPTIONS']) {
    delete env[key]
  }
  Object.assign(env, { TMPDIR: fixture, TMP: fixture, TEMP: fixture }, options.env)
  const { stdout, stderr } = await runNode(process.execPath, [
    '--enable-source-maps',
    path.join(fixture, 'run.mjs'),
    JSON.stringify({ action: options.action, command: options.command, nodeVersion: options.nodeVersion }),
  ], { cwd: fixture, env, timeout: 20_000, maxBuffer: 1024 * 1024 })
  expect(stderr).toBe('')
  const report = JSON.parse(stdout) as ChildReport
  expect(report.env).toEqual(Object.fromEntries(cacheEnvKeys.map(key => [key, env[key] ?? null])))
  return report
}

async function assertOwnedCache(directory: string | null) {
  expect(directory).not.toBeNull()
  const normalized = await realpath(directory!)
  const relative = path.relative(fixture, normalized)
  expect(path.isAbsolute(relative)).toBe(false)
  expect(relative.split(path.sep)).not.toContain('..')
  const entries = await readdir(normalized, { recursive: true, withFileTypes: true })
  expect(entries.some(entry => entry.isFile())).toBe(true)
}

describe('CLI native Node compile cache', () => {
  it('enables the default cache before imports and persists it when each fresh process exits', async () => {
    const cold = await runChild()
    expect(cold.before).toBeNull()
    expect(cold.result).toBe(true)
    expect(cold.value).toBe(41)
    expect(cold.error).toBeNull()
    expect(cold.after).toBe(cold.during)
    await assertOwnedCache(cold.during)
    const warm = await runChild()
    expect(warm).toEqual(cold)
  })

  it('honors a caller-selected directory and native disable even when both environment variables are present', async () => {
    const directory = path.join(fixture, 'selected cache')
    const enabled = await runChild({ env: { NODE_COMPILE_CACHE: directory } })
    expect(enabled.result).toBe(true)
    expect(enabled.before).toBe(enabled.during)
    await assertOwnedCache(enabled.during)
    expect(path.relative(directory, enabled.during!).split(path.sep)).not.toContain('..')

    const disabledDirectory = path.join(fixture, 'disabled cache')
    const disabled = await runChild({ env: { NODE_COMPILE_CACHE: disabledDirectory, NODE_DISABLE_COMPILE_CACHE: '1' } })
    expect(disabled).toMatchObject({ before: null, during: null, after: null, result: true, value: 41, error: null })
    await expect(readdir(disabledDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('continues importing without additional warnings if the cache directory cannot be created', async () => {
    const invalidDirectory = path.join(fixture, 'existing-file')
    await writeFile(invalidDirectory, 'preserved')
    const result = await runChild({ env: { NODE_COMPILE_CACHE: invalidDirectory } })
    expect(result).toMatchObject({ before: null, during: null, after: null, result: true, value: 41, warnings: [], error: null })
    expect(await readFile(invalidDirectory, 'utf8')).toBe('preserved')
  })

  it.each(['coverage', 'vitest'])('does not enable caching inside %s instrumentation', async (mode) => {
    const coverage = path.join(fixture, 'coverage')
    await mkdir(coverage)
    const result = await runChild({ env: mode === 'coverage' ? { NODE_V8_COVERAGE: coverage } : { VITEST: 'true' } })
    expect(result).toMatchObject({ before: null, during: null, after: null, result: true, value: 41, error: null })
    if (mode === 'coverage') {
      expect((await readdir(coverage)).some(name => name.endsWith('.json'))).toBe(true)
    }
  })

  it('rejects an unsupported engine before enabling the cache or invoking the importer', async () => {
    const result = await runChild({ nodeVersion: '20.19.0' })
    expect(result).toMatchObject({ before: null, during: null, after: null, result: null, value: null })
    expect(result.error?.message).toContain('weapp-vite requires Node.js')
    expect(result.error?.message).toContain('20.19.0')
  })

  it('invalidates cached code when the same module path changes', async () => {
    const first = await runChild()
    await assertOwnedCache(first.during)
    expect(first.value).toBe(41)
    await writeSubject(42)
    const changed = await runChild()
    expect(changed.during).toBe(first.during)
    expect(changed.value).toBe(42)
    expect(changed.error).toBeNull()
  })

  it('preserves mapped errors and prepare fallback with disabled, cold and reused cache', async () => {
    const disabled = await runChild({ action: 'throw', env: { NODE_DISABLE_COMPILE_CACHE: '1' } })
    const cold = await runChild({ action: 'throw' })
    await assertOwnedCache(cold.during)
    const warm = await runChild({ action: 'throw' })
    for (const result of [disabled, cold, warm]) {
      expect(result.result).toBeNull()
      expect(result.error).toEqual({ name: 'Error', message: 'compile-cache-contract', frame: 'original.ts:3:1' })
      expect(result.warnings).toEqual([])
    }
    const prepare = await runChild({ action: 'throw', command: 'prepare' })
    expect(prepare.result).toBe(false)
    expect(prepare.error).toBeNull()
    expect(prepare.warnings).toEqual(['[prepare] 跳过 .weapp-vite 支持文件预生成：compile-cache-contract'])
  })
})
