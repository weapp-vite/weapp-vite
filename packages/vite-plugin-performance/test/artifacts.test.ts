import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface PackageManifest {
  name: string
  exports: {
    '.': {
      types: string
      import: string
    }
  }
}

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const packageRoot = path.resolve(import.meta.dirname, '..')
const workspaceRoot = path.resolve(packageRoot, '../..')

let temporaryRoot: string
let manifest: PackageManifest

beforeAll(async () => {
  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'vite-performance-artifacts-'))
  const packageJson = await readFile(path.join(packageRoot, 'package.json'), 'utf8')
  manifest = JSON.parse(packageJson) as PackageManifest
  await writeFile(path.join(temporaryRoot, 'package.json'), packageJson)
  await symlink(path.join(workspaceRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'junction')
  await execFileAsync(process.execPath, [
    require.resolve('tsdown/run'),
    '--config',
    'tsdown.config.ts',
    '--out-dir',
    path.join(temporaryRoot, 'dist'),
  ], {
    cwd: packageRoot,
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  })
}, 75_000)

afterAll(async () => {
  if (temporaryRoot) {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

describe('published performance artifacts', () => {
  it('emits every declared public entry and keeps Vite types external', async () => {
    const entry = manifest.exports['.']
    await access(path.resolve(temporaryRoot, entry.import))
    await access(path.resolve(temporaryRoot, entry.types))

    const declaration = await readFile(path.resolve(temporaryRoot, entry.types), 'utf8')
    expect(declaration).toMatch(/from\s+['"]vite['"]/)
  })

  it('preserves transform results, timing callbacks and hook context in Node', async () => {
    const consumerPath = path.join(temporaryRoot, 'consumer.mjs')
    await writeFile(consumerPath, `
import assert from 'node:assert/strict'
import { wrapPlugin } from ${JSON.stringify(manifest.name)}

const hookContext = { marker: 'consumer-context' }
const executions = []
const logs = []
let time = 100
const plugin = {
  name: 'consumer-plugin',
  async transform(code, id) {
    assert.equal(this, hookContext)
    assert.equal(id, 'fixture.ts')
    time = 142
    return { code: code + '-transformed', map: null }
  },
}
const wrapped = wrapPlugin(plugin, {
  hooks: ['transform'],
  threshold: 10,
  clock: () => time,
  logger: (message, context) => logs.push({ message, context }),
  onHookExecution: context => executions.push(context),
})
const result = await wrapped.transform.call(hookContext, 'source', 'fixture.ts')
assert.deepEqual(result, { code: 'source-transformed', map: null })
assert.deepEqual(executions, [{
  pluginName: 'consumer-plugin',
  hookName: 'transform',
  args: ['source', 'fixture.ts'],
  duration: 42,
}])
assert.equal(logs.length, 1)
assert.deepEqual(logs[0].context, executions[0])
assert.equal(plugin.transform === wrapped.transform, false)
`)

    const result = await execFileAsync(process.execPath, [consumerPath], {
      cwd: temporaryRoot,
      timeout: 30_000,
    })
    expect(result.stderr).toBe('')
  })

  it('lets an external Vite consumer compile against emitted declarations', async () => {
    const consumerPath = path.join(temporaryRoot, 'consumer.ts')
    await writeFile(consumerPath, `
import type { Plugin } from 'vite'
import type { HookExecutionContext, PluginHookName, WrapPluginOptions } from ${JSON.stringify(manifest.name)}
import { wrapPlugin } from ${JSON.stringify(manifest.name)}

const hook: PluginHookName = 'transform'
const options: WrapPluginOptions = {
  hooks: [hook],
  onHookExecution(context: HookExecutionContext) {
    const duration: number = context.duration
    const hookName: keyof Plugin = context.hookName
    void duration
    void hookName
  },
}
const plugin: Plugin = { name: 'consumer-plugin', transform: code => code }
const wrapped: Plugin = wrapPlugin(plugin, options)
const wrappedArray: Plugin[] = wrapPlugin([plugin], options)
void wrapped
void wrappedArray
`)

    const result = await execFileAsync(process.execPath, [
      require.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      consumerPath,
    ], {
      cwd: temporaryRoot,
      timeout: 30_000,
    })
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })
})
