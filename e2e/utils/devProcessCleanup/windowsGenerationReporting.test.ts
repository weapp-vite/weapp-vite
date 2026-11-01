import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'

const require = createRequire(import.meta.url)
const prefix = '[e2e-cleanup-windows-generation] '

async function runFixture(body: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'generation-reporting-'))
  try {
    const source = (file: string) => JSON.stringify(path.resolve(import.meta.dirname, file).replaceAll('\\', '/'))
    await fs.writeFile(path.join(root, 'case.test.ts'), `
      import process from 'node:process'
      import { collectWindowsProcessTree, UnconfirmedDevProcessTreeError } from ${source('windowsProcessTree.ts')}
      import { runCleanupSteps } from ${source('../cleanupSteps.ts')}
      const started = '2026-10-08T00:00:00.0000208Z'
      const identity = pid => ({ pid, started, executable: 'private-executable-sentinel' })
      const entry = (pid, ppid) => ({ pid, ppid, started, identity: identity(pid) })
      const rows = [entry(61, 1), entry(64, 61), { pid: 62, ppid: 61 }, entry(63, 62),
        ...Array.from({ length: 150 }, (_, index) => entry(100 + index, 61)), entry(9999, 1)]
      ${body}
    `)
    const config = path.join(root, 'vitest.config.mjs')
    await fs.writeFile(config, `export default ${JSON.stringify({ test: {
      include: ['case.test.ts'],
      globals: true,
      reporters: ['default'],
      maxWorkers: 1,
      fileParallelism: false,
    } })}`)
    const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
    try {
      const result = await promisify(execFile)(process.execPath, [vitest, 'run', '--root', root, '--config', config], {
        cwd: root,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', [MANAGED_PROJECT_JOURNAL_ENV]: path.join(root, 'journal') },
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      })
      return { code: 0, ...result }
    }
    catch (error) {
      const result = error as { code?: number | string, stdout: string, stderr: string }
      return { code: result.code, stdout: result.stdout, stderr: result.stderr }
    }
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

it('retains the complete sanitized diagnostic through a real failing Vitest worker and cleanup error chain', async () => {
  const result = await runFixture(`
    it('fails the original cleanup', async () => {
      const calls = []
      const reinspect = async pids => { calls.push(pids); return [] }
      try {
        await runCleanupSteps([{ label: 'generation-owned-cleanup', run: async () => {
          await collectWindowsProcessTree(61, rows, reinspect)
        } }])
      }
      finally { expect(calls).toEqual([[62]]) }
    })
  `)
  expect(result.code).toBe(1)
  const lines = result.stdout.split(/\r?\n/).filter(line => line.startsWith(prefix))
  expect(lines).toHaveLength(1)
  const payload = lines[0]!.slice(prefix.length)
  expect(payload.length).toBeGreaterThan(10_000)
  expect(payload).not.toMatch(/private-executable-sentinel|\[Object\]|\[Array\]|executable"/)
  const diagnostic: unknown = JSON.parse(payload)
  expect(diagnostic).toMatchObject({
    schemaVersion: 1,
    rootPid: 61,
    nativeErrorCodeAvailable: false,
    guard: {
      stage: 'unknown-parent-generation',
      subjectPid: 62,
      entry: { pid: 62, ppid: 61, started: null, identityPresent: false },
      ancestorPath: [
        { pid: 61, ppid: 1, started: '2026-10-08T00:00:00.0000208Z' },
        { pid: 62, ppid: 61, started: null },
      ],
      parentGeneration100ns: expect.stringMatching(/^\d+$/),
      childrenPids: [63],
    },
    reinspections: [{ requestedPids: [62], status: 'returned', rows: [] }],
  })
  expect(payload).not.toContain('9999')
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cleanup failed: generation-owned-cleanup')
  expect(output).toContain('descendant ownership remains unconfirmed')
  expect(output).toContain('Dev process parent generation is unknown')
}, 40_000)

it('preserves the original guard and query count when stdout throws synchronously in a real worker', async () => {
  const result = await runFixture(`
    it('keeps the first error', async () => {
      const calls = []
      let writes = 0
      const write = process.stdout.write
      let failure
      try {
        process.stdout.write = () => { writes++; throw new Error('private-write-failure-sentinel') }
        await collectWindowsProcessTree(61, rows, async pids => { calls.push(pids); return [] })
      }
      catch (error) { failure = error }
      finally { process.stdout.write = write }
      expect(writes).toBe(1)
      expect(calls).toEqual([[62]])
      expect(failure).toBeInstanceOf(UnconfirmedDevProcessTreeError)
      expect(failure.cause.message).toBe('Dev process parent generation is unknown; descendants remain unconfirmed.')
      expect(failure.diagnostics[0].guard.subjectPid).toBe(62)
    })
  `)
  expect(result.code).toBe(0)
  expect(result.stdout).toContain('1 passed')
  expect(result.stdout).not.toContain(prefix)
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('private-write-failure-sentinel')
}, 40_000)
