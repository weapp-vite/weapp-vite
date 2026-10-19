import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { validateLocalVitest } from './localReporter.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const execute = promisify(execFile)

it('collects real planned files and declared cases before recording the actual Vitest completion', async () => {
  await mkdir(path.join(root, '.tmp'), { recursive: true })
  const directory = await mkdtemp(path.join(root, '.tmp/local-reporter-'))
  try {
    const reportDirectory = path.join(directory, '.tmp/evidence')
    const reporter = fileURLToPath(new URL('./localReporter.mjs', import.meta.url))
    const testFile = path.join(directory, 'sample.test.mjs')
    await writeFile(testFile, `import { expect, it } from 'vitest'
it('finishes an asynchronous observable check', async () => {
  await new Promise(resolve => setTimeout(resolve, 40))
  expect(2 + 2).toBe(4)
})
it.skip('preserves the original declared skip', () => {})
`)
    const config = path.join(directory, 'vitest.config.mjs')
    await writeFile(config, `export default { test: { allowOnly: false, include: ['sample.test.mjs'], reporters: ['default', ${JSON.stringify(reporter)}] } }\n`)
    const env = { ...process.env, WEAPP_VITE_VERIFICATION_LOCAL_ROOT: directory, WEAPP_VITE_VERIFICATION_LOCAL_DIR: reportDirectory, WEAPP_VITE_VERIFICATION_LOCAL_RUN: 'smoke', WEAPP_VITE_VERIFICATION_LOCAL_TASK: 'tests', WEAPP_VITE_VERIFICATION_LOCAL_INVOCATION: 'task-smoke' }
    for (const key of Object.keys(env).filter(key => key.startsWith('VITEST'))) {
      delete env[key]
    }
    const vitest = path.join(path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs')
    const begin = Date.now()
    const { stdout } = await execute(process.execPath, [vitest, 'run', '--root', directory, '--config', config, '--maxWorkers=1'], { cwd: root, env })
    const end = Date.now()
    const files = await readdir(path.join(reportDirectory, 'vitest'))
    expect(files).toHaveLength(1)
    const report = JSON.parse(await readFile(path.join(reportDirectory, 'vitest', files[0]), 'utf8'))
    expect(stdout).toContain('[verification-local-case] index=.tmp/evidence/vitest/')
    expect(report).toMatchObject({ passed: true, runId: 'smoke', taskId: 'tests', taskInvocation: 'task-smoke', collected: [{ name: 'finishes an asynchronous observable check', mode: 'run' }, { name: 'preserves the original declared skip', mode: 'skip' }] })
    expect(Date.parse(report.startedAt)).toBeGreaterThanOrEqual(begin)
    expect(Date.parse(report.finishedAt)).toBeLessThanOrEqual(end)
    expect(Date.parse(report.finishedAt) - Date.parse(report.startedAt)).toBeGreaterThanOrEqual(40)
    expect(validateLocalVitest(report).cases.map(item => item[4])).toEqual(['passed', 'skipped'])
    for (const fault of ['case', 'file', 'state', 'mode', 'reason']) {
      const changed = structuredClone(report)
      if (fault === 'case') {
        changed.cases.pop()
      }
      if (fault === 'file') {
        changed.files = []
      }
      if (fault === 'state') {
        changed.cases[0].state = 'pending'
      }
      if (fault === 'mode') {
        changed.cases[0].mode = 'only'
      }
      if (fault === 'reason') {
        changed.reason = 'interrupted'
      }
      expect(() => validateLocalVitest(changed)).toThrow()
    }
    for (const focus of ['describe.only', 'it.only']) {
      await writeFile(testFile, `import { describe, expect, it } from 'vitest'
${focus === 'describe.only' ? 'describe.only' : 'describe'}('focused suite', () => {
  ${focus === 'it.only' ? 'it.only' : 'it'}('runs selected', () => expect(true).toBe(true))
})
describe('ordinary suite', () => it('must remain in full scope', () => expect(true).toBe(true)))
`)
      await expect(execute(process.execPath, [vitest, 'run', '--root', directory, '--config', config, '--maxWorkers=1'], { cwd: root, env })).rejects.toMatchObject({ code: 1 })
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
