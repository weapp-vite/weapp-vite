import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { driverRoot, readJson, writeJson } from './evidence.mjs'
import { manifestPath } from './manifest.mjs'
import { runCorrectness } from './runner.mjs'
import { candidateFixture, completeReport, minimumAssertionCount } from './testHelpers.mjs'

const roots = []
beforeEach(() => {
  vi.stubEnv('NATIVE_CORRECTNESS_EXPECTED_COMMIT', '')
  vi.stubEnv('NATIVE_CORRECTNESS_DRIVER_COMMIT', '')
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function preparedFixture() {
  const fixture = await candidateFixture()
  roots.push(fixture.root)
  const dependencies = {
    commit: vi.fn(async root => root === driverRoot ? 'b'.repeat(40) : 'a'.repeat(40)),
    loadBinding: vi.fn(async () => Object.fromEntries(fixture.manifest.requiredExports.map(name => [name, () => {}]))),
    findAddonFiles: vi.fn(async () => ['packages/ast-native/index.js', 'packages/ast-native/fixture.node']),
  }
  const run = (mode, extra = {}) => runCorrectness(mode, fixture.root, fixture.directory, { ...dependencies, ...extra })
  await run('plan')
  return { ...fixture, dependencies, run }
}

describe('trusted native correctness runner', () => {
  it('freezes candidate identity, runs one serial closure and all suites, then emits portable evidence', async () => {
    const fixture = await preparedFixture()
    const { root, directory, manifest, run, dependencies } = fixture
    const plan = await readJson(directory, 'plan.json')
    expect(plan.testedCommit).toBe('a'.repeat(40))
    expect(plan.driverCommit).toBe('b'.repeat(40))
    expect(plan.manifestSha256).toMatch(/^[a-f\d]{64}$/u)
    await run('binding')
    expect(dependencies.loadBinding).toHaveBeenCalledOnce()
    const commands = []
    let releaseBuild
    const buildFinished = new Promise((resolve) => {
      releaseBuild = resolve
    })
    const execute = async (command) => {
      commands.push(command)
      if (commands.length === 1) {
        await buildFinished
      }
      else {
        await writeJson(directory, 'raw-vitest.json', completeReport(root, manifest))
      }
    }
    const running = run('run', { execute })
    await vi.waitFor(() => expect(commands).toHaveLength(1))
    expect(commands[0]).toEqual({
      command: 'pnpm',
      args: ['exec', 'turbo', 'run', 'build', '--filter=@wevu/compiler...', '--filter=weapp-vite...', '--concurrency=1', '--force'],
      cwd: root,
    })
    releaseBuild()
    await running
    expect(commands).toHaveLength(2)
    expect(commands[1].cwd).toBe(path.join(root, 'packages/ast-native'))
    expect(commands[1].args).toEqual([
      'exec',
      'vitest',
      'run',
      '--config',
      'native.vitest.config.ts',
      ...manifest.suites.map(suite => suite.file),
      '--maxWorkers=1',
      '--no-file-parallelism',
      '--reporter=default',
      '--reporter=json',
      `--outputFile=${path.join(directory, 'raw-vitest.json')}`,
    ])
    await run('report')
    const summary = await readJson(directory, 'summary.json')
    expect(summary).toMatchObject({ status: 'passed', passed: minimumAssertionCount(manifest), skipped: 0, manifestSha256: plan.manifestSha256, testedCommit: plan.testedCommit })
    expect(summary.buildFilters).toEqual(manifest.buildFilters)
    expect(summary.buildOptions).toEqual({ force: true, concurrency: 1 })
    expect(summary.suiteFiles).toEqual(manifest.suites.map(suite => suite.file))
    expect(summary.suites).toHaveLength(manifest.suites.length)
    expect(summary.addonFiles.map(item => item.file)).toEqual(['packages/ast-native/index.js', 'packages/ast-native/fixture.node'])
    expect(dependencies.loadBinding).toHaveBeenCalledOnce()
    expect(JSON.stringify(summary)).not.toContain(root)
  })

  it('clears previous evidence before a new plan and never accepts a report before the addon preflight', async () => {
    const { directory, run } = await preparedFixture()
    await run('binding')
    await writeJson(directory, 'raw-vitest.json', { success: true })
    await writeJson(directory, 'summary.json', { status: 'passed' })
    await run('plan')
    await expect(readFile(path.join(directory, 'binding.json'))).rejects.toThrow()
    await expect(readFile(path.join(directory, 'summary.json'))).rejects.toThrow()
    await expect(run('report')).rejects.toThrow()
  })

  it('rejects an addon missing a candidate-only export before any build', async () => {
    const { run, manifest, directory } = await preparedFixture()
    const binding = Object.fromEntries(manifest.requiredExports.slice(0, -1).map(name => [name, () => {}]))
    await expect(run('binding', { loadBinding: async () => binding })).rejects.toThrow('analyzeNpmChunksNative')
    await expect(readFile(path.join(directory, 'binding.json'))).rejects.toThrow()
  })

  it.each(['build', 'tests'])('rejects failed %s even if stale JSON claims a complete report', async (phase) => {
    const { root, directory, manifest, run } = await preparedFixture()
    await run('binding')
    let calls = 0
    await expect(run('run', { execute: async () => {
      calls++
      await writeJson(directory, 'raw-vitest.json', completeReport(root, manifest))
      if (calls === (phase === 'build' ? 1 : 2)) {
        throw new Error('fixture command failed')
      }
    } })).rejects.toThrow('fixture command failed')
    expect(calls).toBe(phase === 'build' ? 1 : 2)
    await expect(run('report')).rejects.toThrow('did not complete')
  })

  it('rejects changed manifest bytes even when parsed coverage is equivalent', async () => {
    const { root, run, directory } = await preparedFixture()
    await run('binding')
    const file = path.join(root, manifestPath)
    await writeFile(file, `${await readFile(file, 'utf8')}\n`)
    await expect(run('run', { execute: vi.fn() })).rejects.toThrow('plan changed')
    await expect(run('report')).rejects.toThrow('plan changed')
    await expect(readFile(path.join(directory, 'execution.json'))).rejects.toThrow()
  })

  it('rejects candidate HEAD drift and an expected context SHA mismatch', async () => {
    const { run, dependencies } = await preparedFixture()
    await run('binding')
    dependencies.commit.mockResolvedValue('c'.repeat(40))
    await expect(run('run')).rejects.toThrow('plan changed')
    vi.stubEnv('NATIVE_CORRECTNESS_EXPECTED_COMMIT', 'd'.repeat(40))
    await expect(run('plan')).rejects.toThrow('frozen PR context')
  })

  it('rejects a driver SHA mismatch or a missing candidate manifest without selecting old suites', async () => {
    const { root, run } = await preparedFixture()
    vi.stubEnv('NATIVE_CORRECTNESS_DRIVER_COMMIT', 'c'.repeat(40))
    await expect(run('plan')).rejects.toThrow('workflow commit')
    vi.stubEnv('NATIVE_CORRECTNESS_DRIVER_COMMIT', '')
    await rm(path.join(root, manifestPath))
    await expect(run('plan')).rejects.toThrow()
  })

  it('does not start native tests if the build changes the frozen plan', async () => {
    const { root, run } = await preparedFixture()
    await run('binding')
    const execute = vi.fn(async () => {
      const file = path.join(root, manifestPath)
      await writeFile(file, `${await readFile(file, 'utf8')}\n`)
    })
    await expect(run('run', { execute })).rejects.toThrow('plan changed')
    expect(execute).toHaveBeenCalledOnce()
    await expect(run('report')).rejects.toThrow('plan changed')
  })

  it('requires complete actual results after successful child exits', async () => {
    const { root, directory, manifest, run } = await preparedFixture()
    await run('binding')
    await run('run', { execute: async () => {} })
    await expect(run('report')).rejects.toThrow()
    const report = completeReport(root, manifest)
    report.testResults.at(-1).assertionResults[0].status = 'skipped'
    await writeJson(directory, 'raw-vitest.json', report)
    await expect(run('report')).rejects.toThrow('skipped')
  })

  it('rejects binding identities from another checkout or host', async () => {
    const { directory, run } = await preparedFixture()
    await run('binding')
    const binding = await readJson(directory, 'binding.json')
    await writeJson(directory, 'binding.json', { ...binding, testedCommit: 'c'.repeat(40) })
    await expect(run('run')).rejects.toThrow('preflight did not pass')
  })

  it.each(['index.js', 'fixture.node'])('rejects replacement of the actual addon %s after preflight without reloading it', async (file) => {
    const { root, run, dependencies } = await preparedFixture()
    await run('binding')
    await writeFile(path.join(root, 'packages/ast-native', file), 'replacement fixture bytes\n')
    await expect(run('run')).rejects.toThrow('changed after preflight')
    await expect(run('report')).rejects.toThrow('changed after preflight')
    expect(dependencies.loadBinding).toHaveBeenCalledOnce()
  })

  it('rejects an addon replacement during the fresh build before native tests start', async () => {
    const { root, run } = await preparedFixture()
    await run('binding')
    const execute = vi.fn(async () => {
      await writeFile(path.join(root, 'packages/ast-native/fixture.node'), 'replacement fixture bytes\n')
    })
    await expect(run('run', { execute })).rejects.toThrow('changed after preflight')
    expect(execute).toHaveBeenCalledOnce()
  })
})
