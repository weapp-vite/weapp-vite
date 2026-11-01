import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import type { SuiteReportPayload } from '../suiteReport'
import type { SuiteTask } from '../suiteRunner'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { createManagedWechatProjectJournal } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { runTaskSuite } from '../suiteRunner'

let machine: IsolatedMachineLease
let previousExitCode: typeof process.exitCode
let marker: string
const reports: SuiteReportPayload[] = []

beforeEach(async () => {
  previousExitCode = process.exitCode
  process.exitCode = undefined
  machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(machine.environment)) {
    vi.stubEnv(key, value)
  }
  const journal = await createManagedWechatProjectJournal(path.dirname(machine.journalPath), machine.journalPath)
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, journal)
  marker = path.join(path.dirname(machine.stateDirectory), 'next-task-started')
}, 30_000)
afterEach(async () => {
  try {
    for (const report of reports.splice(0)) {
      fs.rmSync(report.reportDir, { recursive: true, force: true })
    }
    await machine.dispose()
  }
  finally {
    process.exitCode = previousExitCode
    vi.unstubAllEnvs()
  }
})

function childOutput(line: string, stream: 'stdout' | 'stderr', ending: string, exitCode = 0): SuiteTask {
  // 分批写入控制序列、正文和行尾；只让真实流转发器拼接输出。
  const split = Math.max(2, line.indexOf('OOM') + 1)
  const chunks = [line.slice(0, 2), line.slice(2, split), line.slice(split), ...ending]
  const script = `
    const chunks = ${JSON.stringify(chunks)};
    const write = () => {
      if (!chunks.length) { process.exitCode = ${exitCode}; return; }
      process.${stream}.write(chunks.shift(), () => setImmediate(write));
    };
    write();
  `
  return { label: 'diagnostic-child', command: process.execPath, args: ['-e', script] }
}

function nextTask(): SuiteTask {
  return {
    label: 'following-child',
    command: process.execPath,
    args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "started")', marker],
  }
}

async function run(tasks: SuiteTask[], onUnsafeRuntime = vi.fn()) {
  // 真实 child 的 pipe 仍经过 collector；只阻止故意注入的事故文本泄漏给外层 suite。
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    const code = await runTaskSuite('e2e:diagnostic-process-unit', tasks, {
      machineLeaseOptions: { stateDirectory: machine.stateDirectory },
      failOnTaskFailure: false,
      stopOnTaskFailure: false,
      onUnsafeRuntime,
      onReport: report => reports.push(report),
    })
    return { code, report: reports.at(-1)!, onUnsafeRuntime }
  }
  finally {
    stdout.mockRestore()
    stderr.mockRestore()
  }
}

describe('runtime diagnostic output boundaries', () => {
  it.each([
    ['project', 'mixed-oOm-tail', 'stdout', '\r\n'],
    ['runtimeRoot', 'OOM', 'stderr', '\n'],
    ['project', path.join('DevTools', 'OOM', 'fixture'), 'stderr', ''],
  ] as const)('continues after recovery metadata %s contains %s', async (key, suffix, stream, ending) => {
    const project = path.join(path.dirname(machine.stateDirectory), suffix)
    fs.mkdirSync(project, { recursive: true })
    const line = `[warn] [runtime:launch-recover] cleanup-devtools ${key}=${project}`
    const task = childOutput(line, stream, ending)
    const { code, report, onUnsafeRuntime } = await run([task, nextTask()])

    expect(code).toBe(0)
    expect(process.exitCode).toBeUndefined()
    expect(fs.readFileSync(marker, 'utf8')).toBe('started')
    expect(onUnsafeRuntime).not.toHaveBeenCalled()
    expect(task.unsafeRuntimeReason).toBeUndefined()
    expect(report.execution?.status).toBe('passed')
    expect(report.summary).toMatchObject({ executedCount: 2, passedCount: 2, notExecutedCount: 0 })
  })

  it.each([
    ' ✓ runner safely reports DevTools OOM without starting an IDE',
    '[warn] [unrelated:test-output] DevTools OOM matcher regression',
    '[warn] [runtime:devtools-log] connect: state=pending first-error=[INFO] DevTools: BOOM',
  ])('does not stop for an ordinary test label or a longer word: %s', async (line) => {
    const { code, onUnsafeRuntime } = await run([childOutput(line, 'stdout', '\r\n'), nextTask()])

    expect(code).toBe(0)
    expect(fs.existsSync(marker)).toBe(true)
    expect(onUnsafeRuntime).not.toHaveBeenCalled()
  })

  it('ignores OOM metadata in an ANSI decorated runtime log with no final newline', async () => {
    const project = path.join(path.dirname(machine.stateDirectory), 'DevTools', 'OOM')
    const line = `\u001B[33m[warn] [runtime:devtools-log] connect: state=recovered first-error=[INFO] webview page ready runtimeRoot=${project}\u001B[0m`
    const { code, onUnsafeRuntime } = await run([childOutput(line, 'stderr', ''), nextTask()])

    expect(code).toBe(0)
    expect(fs.existsSync(marker)).toBe(true)
    expect(onUnsafeRuntime).not.toHaveBeenCalled()
  })

  it.each([
    ['stdout', '\n', 0, false],
    ['stderr', '\r\n', 7, false],
    ['stderr', '', 0, true],
  ] as const)('stops after a known OOM log on %s with ending %j, exit %s and ANSI %s', async (stream, ending, childExit, ansi) => {
    const project = path.dirname(machine.stateDirectory)
    const message = '[warn] [runtime:devtools-log] connect: state=fatal window=current first-error=[ERROR] DevTools process OOM'
    const line = `${ansi ? '\u001B[31m' : ''}${message} project=${project}${ansi ? '\u001B[0m' : ''}`
    const task = childOutput(line, stream, ending, childExit)
    const { code, report, onUnsafeRuntime } = await run([task, nextTask()])

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(fs.existsSync(marker)).toBe(false)
    expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(line)
    expect(task.unsafeRuntimeReason).toBe(line)
    expect(report.tasks[0]).toMatchObject({ status: 'failed', exitCode: childExit || 1, reason: line })
    expect(report.tasks[1]?.status).toBe('not-executed')
    expect(report.execution?.status).toBe('incomplete')
  })

  it('keeps the first OOM when recovery and another fatal diagnostic follow', async () => {
    const first = '[warn] [runtime:devtools-log] connect: state=fatal first-error=[ERROR] DevTools process OOM'
    const later = '[warn] [runtime:devtools-log] connect: state=recovered webview page ready\nFATAL ERROR: later heap failure'
    const task = childOutput(`${first}\n${later}`, 'stderr', '\r\n')
    const { code, report, onUnsafeRuntime } = await run([task, nextTask()])

    expect(code).toBe(1)
    expect(fs.existsSync(marker)).toBe(false)
    expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(first)
    expect(report.tasks[0]?.reason).toBe(first)
  })

  it('fails an unsafe final task even when its child exits zero', async () => {
    // 尚无对应仓库生产者；此独立完整签名为显式兼容合同。
    const line = 'WeChat DevTools: OOM'
    const { code, report, onUnsafeRuntime } = await run([childOutput(line, 'stderr', '')])

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(line)
    expect(report.execution?.status).toBe('failed')
    expect(report.summary).toMatchObject({ executedCount: 1, failedCount: 1, notExecutedCount: 0 })
    expect(report.tasks[0]).toMatchObject({ status: 'failed', exitCode: 1, reason: line })
  })

  it.each([
    { name: 'heap exhaustion', line: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' },
    { name: 'allocation exhaustion', line: 'out of memory' },
    { name: 'incomplete shutdown', line: 'DevProcessGracefulShutdownError: task resources did not finish cleanup' },
    { name: 'host identity mismatch', line: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH: selected host identity changed' },
    { name: 'installation mismatch', line: 'DEVTOOLS_INSTALLATION_MISMATCH: selected installation changed' },
  ])('preserves the existing fatal guard for $name', async ({ line }) => {
    const { code, onUnsafeRuntime } = await run([childOutput(line, 'stderr', '\r\n'), nextTask()])

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(fs.existsSync(marker)).toBe(false)
    expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(line)
  })
})
