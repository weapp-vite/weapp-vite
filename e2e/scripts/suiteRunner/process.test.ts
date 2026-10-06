import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { runTaskSuite as runTaskSuiteWithOptions } from '../suiteRunner'

let machine: IsolatedMachineLease
beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(machine.environment)) {
    vi.stubEnv(key, value)
  }
})
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

function terminateTestChild(pid: number) {
  try {
    process.kill(pid)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
}

describe('suiteRunner real process and machine lease integration', () => {
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
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-child-exit-'))
    const pidFile = path.join(tempRoot, 'child.pid')
    const previousExitCode = process.exitCode
    process.exitCode = undefined

    const leakStdoutScriptPath = path.join(tempRoot, 'leak-stdio.cjs')
    const descendantScriptPath = path.join(tempRoot, 'descendant.cjs')
    fs.writeFileSync(descendantScriptPath, `
      require('node:fs').writeFileSync(process.argv[2], String(process.pid));
      setTimeout(() => {}, 10000);
      process.send('ready');
    `)
    fs.writeFileSync(leakStdoutScriptPath, `
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, [${JSON.stringify(descendantScriptPath)}, ${JSON.stringify(pidFile)}], {
        detached: true,
        windowsHide: true,
        stdio: ['ignore', 1, 2, 'ipc'],
      });
      child.once('message', () => {
        child.disconnect();
        child.unref();
        process.exit(0);
      });
    `)

    try {
      const result = await Promise.race([
        runTaskSuite('e2e:test', [
          {
            label: 'pipe-leak-task',
            command: process.execPath,
            args: [leakStdoutScriptPath],
          },
        ], {
          writeReport: false,
        }),
        new Promise<'timeout'>(resolve => setTimeout(resolve, 1000, 'timeout')),
      ])

      expect(result).toBe(0)
      expect(() => process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 0)).not.toThrow()
    }
    finally {
      if (fs.existsSync(pidFile)) {
        const childPid = Number(fs.readFileSync(pidFile, 'utf8'))
        if (Number.isInteger(childPid) && childPid > 0) {
          terminateTestChild(childPid)
        }
      }

      fs.rmSync(tempRoot, { recursive: true, force: true })
      process.exitCode = previousExitCode
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
    fs.writeFileSync(scriptPath, 'require("node:fs").writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))')

    try {
      const exitCode = await runTaskSuite('e2e:test', [{
        label: `${command}-arguments`,
        command: command === 'node' ? process.execPath : command,
        args: [...(command === 'pnpm' ? ['exec', 'node'] : []), scriptPath, resultPath, ...args],
      }], { writeReport: false })

      expect(exitCode).toBe(0)
      expect(JSON.parse(fs.readFileSync(resultPath, 'utf8'))).toEqual(args)
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
