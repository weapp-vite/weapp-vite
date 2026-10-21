import type { HmrUnitReceipt } from './unit'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 模拟生产代码的跨平台启动器并校验原始输出。
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { identity } from '../../../scripts/verificationE2E/fixtures'
import { DOM_ACCEPTANCE_ENV } from '../domAcceptanceReport/helpers'
import { createVerificationIdentity } from '../verification/plan'
import { passingVitestJson } from './testFixtures'
import { runHmrUnitValidation, summarizeHmrUnitResults } from './unit'

vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('../verification/plan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../verification/plan')>()
  return { ...actual, createVerificationIdentity: vi.fn() }
})

let root = ''

beforeEach(async () => {
  vi.resetAllMocks()
  vi.mocked(createVerificationIdentity).mockReturnValue(identity)
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'hmr-unit-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

function options() {
  return { repositoryRoot: root, directory: path.join(root, 'unit'), identity, environment: { TEST_MACHINE_LEASE: 'borrowed-ticket' } }
}

function childResult(exitCode = 0) {
  return { exitCode, stdout: 'unit stdout\n', stderr: 'unit stderr\n' } as Awaited<ReturnType<typeof execa>>
}

function reportFromChild(value: unknown = passingVitestJson(), exitCode = 0) {
  vi.mocked(execa).mockImplementation(((_command: string, args: string[]) => {
    const reportArgument = args.find(arg => arg.startsWith('--outputFile.json='))
    if (!reportArgument) {
      throw new Error('Unit command did not request its own Vitest JSON output')
    }
    const completion = fs.writeFile(reportArgument.slice('--outputFile.json='.length), JSON.stringify(value))
      .then(() => childResult(exitCode))
    return completion as unknown as ReturnType<typeof execa>
  }) as unknown as typeof execa)
}

describe('HMR unit child execution and evidence', () => {
  it('runs the pnpm script with a borrowed lease and saves both streams, JSON and matching evidence', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    vi.stubEnv(DOM_ACCEPTANCE_ENV, '1')
    reportFromChild()
    const receipt = await runHmrUnitValidation(options())
    expect(execa).toHaveBeenCalledWith('pnpm', expect.arrayContaining(['test:hmr', '--reporter=default', '--reporter=json']), expect.objectContaining({
      cwd: root,
      reject: false,
      extendEnv: false,
      env: expect.objectContaining({ TEST_MACHINE_LEASE: 'borrowed-ticket', [DOM_ACCEPTANCE_ENV]: '0', WEAPP_VITE_E2E_RUNTIME_PROVIDER: undefined }),
    }))
    expect(receipt).toMatchObject({ ...identity, status: 'passed', exitCode: 0, summary: { testFiles: 1, totalTests: 2, passedTests: 2 } })
    expect(await fs.readFile(path.join(root, receipt.artifacts.stdout), 'utf8')).toBe('unit stdout\n')
    expect(await fs.readFile(path.join(root, receipt.artifacts.stderr), 'utf8')).toBe('unit stderr\n')
    expect(JSON.parse(await fs.readFile(path.join(root, receipt.artifacts.vitest), 'utf8'))).toEqual(passingVitestJson())
    expect(JSON.parse(await fs.readFile(path.join(root, 'unit/receipt.json'), 'utf8'))).toMatchObject(receipt)
  })

  it('does not reuse an older successful JSON result when a zero-exit child emits no report', async () => {
    await fs.mkdir(path.join(root, 'unit'))
    await fs.writeFile(path.join(root, 'unit/vitest.json'), JSON.stringify(passingVitestJson()))
    vi.mocked(execa).mockResolvedValue(childResult())
    await expect(runHmrUnitValidation(options())).rejects.toThrow()
    const receipt = JSON.parse(await fs.readFile(path.join(root, 'unit/receipt.json'), 'utf8')) as HmrUnitReceipt
    expect(receipt.status).toBe('failed')
    expect(await fs.readFile(path.join(root, 'unit/stdout.log'), 'utf8')).toBe('unit stdout\n')
  })

  it('keeps failure evidence when the child exits unsuccessfully despite a passing JSON payload', async () => {
    reportFromChild(passingVitestJson(), 1)
    await expect(runHmrUnitValidation(options())).rejects.toThrow('exit code 1')
    expect(JSON.parse(await fs.readFile(path.join(root, 'unit/receipt.json'), 'utf8'))).toMatchObject({ status: 'failed', exitCode: 1 })
    expect(await fs.readFile(path.join(root, 'unit/stderr.log'), 'utf8')).toBe('unit stderr\n')
  })

  it('rejects a checkout that moves while tests run', async () => {
    reportFromChild()
    vi.mocked(createVerificationIdentity).mockReturnValueOnce(identity).mockReturnValue({ ...identity, commitSha: 'c'.repeat(40) })
    await expect(runHmrUnitValidation(options())).rejects.toThrow('checkout changed')
    expect(JSON.parse(await fs.readFile(path.join(root, 'unit/receipt.json'), 'utf8'))).toMatchObject({ status: 'failed' })
  })

  it('preserves available child output when process launch rejects', async () => {
    const error = Object.assign(new Error('pnpm launch failed'), { stdout: 'launch output', stderr: 'launch failure' })
    vi.mocked(execa).mockRejectedValue(error)
    await expect(runHmrUnitValidation(options())).rejects.toThrow('pnpm launch failed')
    expect(await fs.readFile(path.join(root, 'unit/stdout.log'), 'utf8')).toBe('launch output')
    expect(await fs.readFile(path.join(root, 'unit/stderr.log'), 'utf8')).toBe('launch failure')
  })
})

describe('Vitest result semantics', () => {
  it('requires executed passing cases rather than success metadata alone', () => {
    expect(summarizeHmrUnitResults(passingVitestJson())).toMatchObject({ totalTests: 2, passedTests: 2 })
    const failedAssertion = passingVitestJson()
    failedAssertion.testResults[0]!.assertionResults[0]!.status = 'failed'
    for (const report of [
      { ...passingVitestJson(), testResults: [] },
      { ...passingVitestJson(), numTotalTests: 0, numPassedTests: 0 },
      { ...passingVitestJson(), numPassedTests: 1, numPendingTests: 1 },
      { ...passingVitestJson(), numTotalTests: 3, numPassedTests: 3 },
      { ...passingVitestJson(), success: false },
      failedAssertion,
    ]) {
      expect(() => summarizeHmrUnitResults(report)).toThrow('non-empty complete passing')
    }
  })
})
