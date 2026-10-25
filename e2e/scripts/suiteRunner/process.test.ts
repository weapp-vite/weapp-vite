import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { createManagedWechatProjectJournal } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { runTaskSuite as runTaskSuiteWithOptions } from '../suiteRunner'
import { createStdioLeakFixture } from './stdioLeakFixture'

let machine: IsolatedMachineLease
beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(machine.environment)) {
    vi.stubEnv(key, value)
  }
  // 监督钩子覆盖十秒身份查询及后续 I/O；底层查询和后续业务任务预算均不放宽。
  const journal = await createManagedWechatProjectJournal(path.dirname(machine.journalPath), machine.journalPath)
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, journal)
}, 30_000)
afterEach(async () => {
  try {
    await machine.dispose()
  }
  finally {
    vi.unstubAllEnvs()
  }
})

function runTaskSuite(...[name, tasks, options]: Parameters<typeof runTaskSuiteWithOptions>) {
  return runTaskSuiteWithOptions(name, tasks, { ...options, machineLeaseOptions: { stateDirectory: machine.stateDirectory } })
}

describe('suiteRunner real process and machine lease integration', () => {
  it('collects fragmented login errors as blocked evidence without waiting for input', async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const task = { label: 'login-blocked', command: process.execPath, args: ['-e', 'process.stdout.write("WechatIdeLogin"); setImmediate(() => { console.log("RequiredError: 需要重新登录"); process.exitCode = 10 })'] }
    try {
      expect(await runTaskSuite('e2e:test', [task], { nonInteractive: true, writeReport: false })).toBe(1)
      expect(task).toMatchObject({ nonInteractive: true, runtimeBlocker: { code: 'needs-login', reason: 'WechatIdeLoginRequiredError: 需要重新登录' } })
    }
    finally {
      process.exitCode = previousExitCode
    }
  })

  it('stops after fragmented incomplete dev shutdown evidence even when task failures are allowed', async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const beforeEachTask = vi.fn()
    const beforeTaskLaunch = vi.fn()
    const onUnsafeRuntime = vi.fn()
    const task = {
      label: 'incomplete-dev-shutdown',
      command: process.execPath,
      args: ['-e', `
        process.stderr.write('DevProcessGraceful');
        setImmediate(() => {
          process.stderr.write('ShutdownError: session cleanup did not finish before forced termination\\n');
          process.exitCode = 1;
        });
      `],
    }
    try {
      expect(await runTaskSuite('e2e:test', [
        task,
        { label: 'must-not-run', command: process.execPath, args: ['-e', 'process.exit(0)'] },
      ], { beforeEachTask, beforeTaskLaunch, onUnsafeRuntime, failOnTaskFailure: false, stopOnTaskFailure: false, writeReport: false })).toBe(1)
      expect(beforeEachTask).toHaveBeenCalledTimes(1)
      expect(beforeTaskLaunch).toHaveBeenCalledTimes(1)
      expect(task).toMatchObject({ unsafeRuntimeReason: expect.stringContaining('DevProcessGracefulShutdownError') })
      expect(onUnsafeRuntime).toHaveBeenCalledOnce()
      expect(onUnsafeRuntime).toHaveBeenCalledWith(expect.stringContaining('DevProcessGracefulShutdownError'))
    }
    finally {
      process.exitCode = previousExitCode
    }
  })

  it.skipIf(process.platform === 'win32')('stops the suite after an unexpected SIGKILL instead of launching another task', async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const onUnsafeRuntime = vi.fn()
    const beforeEachTask = vi.fn()
    const beforeTaskLaunch = vi.fn()
    try {
      expect(await runTaskSuite('e2e:test', [
        { label: 'system-killed', command: process.execPath, args: ['-e', 'process.kill(process.pid, "SIGKILL")'] },
        { label: 'must-not-run', command: process.execPath, args: ['-e', 'process.exit(0)'] },
      ], { beforeEachTask, beforeTaskLaunch, onUnsafeRuntime, writeReport: false })).toBe(1)
      expect(beforeEachTask).toHaveBeenCalledTimes(1)
      expect(beforeTaskLaunch).toHaveBeenCalledTimes(1)
      expect(onUnsafeRuntime).toHaveBeenCalledWith(expect.stringContaining('SIGKILL'))
    }
    finally {
      process.exitCode = previousExitCode
    }
  })
  it('rejects an unrelated process before running suite callbacks while the machine is owned', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-lease-'))
    const runnerScript = path.join(tempRoot, 'contender.mjs')
    const marker = path.join(tempRoot, 'started')
    const suiteRunnerUrl = pathToFileURL(path.resolve(import.meta.dirname, '../suiteRunner.ts')).href
    fs.writeFileSync(runnerScript, `
      import fs from 'node:fs';
      import { runTaskSuite } from ${JSON.stringify(suiteRunnerUrl)};
      try {
        await runTaskSuite('e2e:contender', [{ label: 'must-not-run', command: 'node', args: [] }], {
          machineLeaseOptions: { stateDirectory: ${JSON.stringify(machine.stateDirectory)} },
          beforeEachTask: () => fs.writeFileSync(process.argv[2], 'started'),
          runTask: async () => 0,
          writeReport: false,
        });
      }
      catch (error) {
        console.log(error.message);
        process.exitCode = 3;
      }
    `)
    try {
      await expect(promisify(execFile)(process.execPath, ['--import', 'tsx', runnerScript, marker], {
        cwd: path.resolve(import.meta.dirname, '../../..'),
        env: { ...process.env, WEAPP_VITE_E2E_MACHINE_LEASE: '' },
      })).rejects.toMatchObject({ code: 3, stdout: expect.stringContaining('Runtime busy') })
      expect(fs.existsSync(marker)).toBe(false)
    }
    finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('does not wait forever when descendant processes keep piped stdio open after exit', async () => {
    const fixture = createStdioLeakFixture()
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    const deadline = Promise.withResolvers<'timeout'>()
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined
    const runPromise = runTaskSuite('e2e:test', [
      {
        label: 'pipe-leak-task',
        command: process.execPath,
        args: [fixture.scriptPath],
      },
    ], {
      // 先完成真实租约和 journal 初始化；1 秒预算覆盖任务启动、执行及 suite 收尾。
      beforeEachTask: () => {
        deadlineTimer = setTimeout(deadline.resolve, 1000, 'timeout')
      },
      writeReport: false,
    })
    const errors: unknown[] = []
    try {
      const result = await Promise.race([runPromise, deadline.promise])

      expect(result, JSON.stringify(fixture.snapshot())).toBe(0)
      expect(fixture.descendantPid()).toBeGreaterThan(0)
      expect(() => process.kill(fixture.descendantPid()!, 0)).not.toThrow()
    }
    catch (error) {
      errors.push(error)
    }
    finally {
      clearTimeout(deadlineTimer)
      try {
        await fixture.cleanup(runPromise)
      }
      catch (error) {
        errors.push(error)
      }
      finally {
        process.exitCode = previousExitCode
      }
    }
    if (errors.length === 1) {
      throw errors[0]
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Inherited stdio assertion and fixture cleanup failed.')
    }
  })

  it.each(['default', 'graceful'] as const)('fails a %s task that exceeds the configured task timeout', async (termination) => {
    const previousExitCode = process.exitCode
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-timeout-'))
    const startedFile = path.join(tempRoot, 'started')
    process.exitCode = undefined

    try {
      const exitCode = await runTaskSuite('e2e:test', [
        {
          label: 'timeout-task',
          command: process.execPath,
          args: ['-e', `
            const fs = require('node:fs');
            if (${JSON.stringify(termination)} === 'graceful') {
              process.on('SIGTERM', () => process.exit(0));
            }
            fs.writeFileSync(process.argv[1], 'started');
            setInterval(() => {}, 5000);
          `, startedFile],
          env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '1000' },
        },
      ], {
        writeReport: false,
      })

      expect(exitCode).toBe(1)
      expect(fs.readFileSync(startedFile, 'utf8')).toBe('started')
      expect(consoleError).toHaveBeenCalledWith('[e2e] task timeout after 1.0s: timeout-task')
    }
    finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      consoleError.mockRestore()
      process.exitCode = previousExitCode
    }
  }, 15_000)

  it.each(['node', 'pnpm'] as const)('preserves argument boundaries through %s', async (command) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite runner arguments '))
    const scriptPath = path.join(tempRoot, 'check arguments.cjs')
    const resultPath = path.join(tempRoot, 'result.json')
    const args = ['space separated', 'parentheses (kept)', 'quote "kept"', 'ampersand & pipe | redirect >', '', 'backslash\\']
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    fs.writeFileSync(scriptPath, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify({ args: process.argv.slice(3), cwd: process.cwd() }))')

    try {
      const setupTasks = []
      if (command === 'pnpm') {
        // pnpm 12 会校验整个工作区；使用无依赖 fixture，防止测试隐式重装运行中的仓库。
        fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ name: 'suite-runner-arguments-fixture', private: true }))
        fs.writeFileSync(path.join(tempRoot, 'pnpm-workspace.yaml'), 'packages: []\nverifyDepsBeforeRun: error\n')
        setupTasks.push({
          label: 'install-arguments-fixture',
          command,
          args: ['--dir', tempRoot, 'install', '--frozen-lockfile', '--offline', '--ignore-scripts'],
        })
      }
      const exitCode = await runTaskSuite('e2e:test', [...setupTasks, {
        label: `${command}-arguments`,
        command: command === 'node' ? process.execPath : command,
        args: [...(command === 'pnpm' ? ['--dir', tempRoot, 'exec', 'node'] : []), scriptPath, resultPath, ...args],
      }], { writeReport: false })

      expect(exitCode).toBe(0)
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as { args: string[], cwd: string }
      expect(result.args).toEqual(args)
      if (command === 'pnpm') {
        expect(result.cwd).toBe(fs.realpathSync(tempRoot))
      }
    }
    finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  })

  it('force kills a timed out task that ignores graceful termination', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-force-kill-'))
    const pidFile = path.join(tempRoot, 'child.pid')
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: 'force-kill-task',
        command: process.execPath,
        args: ['-e', `
          process.on('SIGTERM', () => {});
          require('node:fs').writeFileSync(process.argv[1], String(process.pid));
          setInterval(() => {}, 5000);
        `, pidFile],
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '1000' },
      }], { writeReport: false })

      const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
      expect(exitCode).toBe(1)
      await expect.poll(() => {
        try {
          process.kill(childPid, 0)
          return false
        }
        catch (error) {
          return (error as NodeJS.ErrnoException).code === 'ESRCH'
        }
      }, { timeout: 1000 }).toBe(true)
    }
    finally {
      if (fs.existsSync(pidFile)) {
        try {
          process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL')
        }
        catch {
        }
      }
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  }, 15_000)

  it('cleans up a timed out process tree after its entry process exits gracefully', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-process-tree-'))
    const parentPidFile = path.join(tempRoot, 'parent.pid')
    const childPidFile = path.join(tempRoot, 'child.pid')
    const childScript = path.join(tempRoot, 'child.cjs')
    const parentScript = path.join(tempRoot, 'parent.cjs')
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    fs.writeFileSync(childScript, `
      process.on('SIGTERM', () => {});
      require('node:fs').writeFileSync(process.argv[2], String(process.pid));
      setInterval(() => {}, 5000);
    `)
    fs.writeFileSync(parentScript, `
      const fs = require('node:fs');
      const { spawn } = require('node:child_process');
      process.on('SIGTERM', () => process.exit(0));
      fs.writeFileSync(process.argv[2], String(process.pid));
      spawn(process.execPath, [process.argv[3], process.argv[4]], { stdio: 'ignore' });
    `)

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: 'process-tree-timeout',
        command: process.execPath,
        args: [parentScript, parentPidFile, childScript, childPidFile],
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '2000' },
      }], { writeReport: false })

      expect(exitCode).toBe(1)
      for (const pidFile of [parentPidFile, childPidFile]) {
        const pid = Number(fs.readFileSync(pidFile, 'utf8'))
        await expect.poll(() => {
          try {
            process.kill(pid, 0)
            return false
          }
          catch (error) {
            return (error as NodeJS.ErrnoException).code === 'ESRCH'
          }
        }, { timeout: 2000 }).toBe(true)
      }
    }
    finally {
      for (const pidFile of [parentPidFile, childPidFile]) {
        if (fs.existsSync(pidFile)) {
          try {
            process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL')
          }
          catch {
          }
        }
      }
      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
    }
  }, 20_000)
})
