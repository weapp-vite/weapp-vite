import type { AcceptanceReport } from './types'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)

it('preserves a global setup exception while strict DOM acceptance remains failed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-reporter-startup-'))
  const reportDir = path.join(root, 'reports')
  const setup = path.join(root, 'setup.mjs')
  const test = path.join(root, 'case.test.mjs')
  const config = path.join(root, 'vitest.config.mjs')
  const diagnosticJournal = path.join(root, 'runtime.jsonl')
  const startupMessage = 'DOM reporter startup fixture failed before collection'
  try {
    await fs.writeFile(setup, `export default function setup() { throw new Error(${JSON.stringify(startupMessage)}) }\n`)
    await fs.writeFile(test, 'it("must not run after failed setup", () => { throw new Error("unexpected test execution") })\n')
    await fs.writeFile(diagnosticJournal, '')
    await fs.writeFile(config, `export default ${JSON.stringify({
      test: {
        include: [test.replaceAll('\\', '/')],
        globals: true,
        globalSetup: [setup],
        reporters: ['default', path.resolve(import.meta.dirname, 'reporter.ts')],
      },
    })}\n`)
    const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')
    let result: { code?: string | number, stdout: string, stderr: string }
    try {
      const success = await promisify(execFile)(process.execPath, [vitest, 'run', '--root', root, '--config', config], {
        cwd: root,
        env: {
          ...process.env,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless',
          WEAPP_VITE_E2E_DOM_ACCEPTANCE: '1',
          WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR: reportDir,
          WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE: diagnosticJournal,
        },
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      })
      result = { code: 0, ...success }
    }
    catch (error) {
      result = error as typeof result
    }
    expect(result.code).toBe(1)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain(startupMessage)
    expect(output).toContain('Strict DOM acceptance failed')
    expect(output).not.toContain('unexpected test execution')
    const files = (await fs.readdir(reportDir)).filter(file => file.endsWith('.json'))
    expect(files).toHaveLength(1)
    const report = JSON.parse(await fs.readFile(path.join(reportDir, files[0]!), 'utf8')) as AcceptanceReport
    expect(report).toMatchObject({ status: 'failed', strict: true, cases: [], summary: { plannedCount: 0 } })
    expect(report.finishedAt).not.toBeNull()
    expect(report.errors).toContain('Vitest run ended: failed')
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 40_000)
