import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { fixtureProcessSource, isFixtureProcessAlive, parseFixturePid, requestFixtureCleanup } from './fixtureProcessControl'

it.each(['registered', 'missing-binding'] as const)('handles an exiting nested runner with %s cleanup ownership', async (binding) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-exit-cleanup-'))
  const childPidFile = path.join(tempRoot, 'child.pid')
  const cleanupFile = path.join(tempRoot, 'cleanup')
  const runnerPidFile = path.join(tempRoot, 'runner.pid')
  const outerPidFile = path.join(tempRoot, 'outer.pid')
  const runnerScript = path.join(tempRoot, 'runner.mjs')
  const outerScript = path.join(tempRoot, 'outer.mjs')
  const preloadScript = path.join(tempRoot, 'isolated-home.mjs')
  const preloadUrl = pathToFileURL(preloadScript).href
  const resultFile = path.join(tempRoot, 'result.json')
  const nextTaskFile = path.join(tempRoot, 'next-task')
  const suiteRunnerUrl = pathToFileURL(path.resolve(import.meta.dirname, '../suiteRunner.ts')).href
  // 故意 process.exit 留下未封存 scope；只有预先绑定的资源允许父任务接管。
  fs.writeFileSync(preloadScript, `
    import os from 'node:os';
    import { syncBuiltinESMExports } from 'node:module';
    os.homedir = () => ${JSON.stringify(tempRoot)};
    syncBuiltinESMExports();
  `)
  fs.writeFileSync(runnerScript, `
    import fs from 'node:fs';
    import { runTaskSuite } from ${JSON.stringify(suiteRunnerUrl)};
    ${fixtureProcessSource(runnerPidFile, cleanupFile, 15_000)}
    void runTaskSuite('e2e:test', [{
      label: 'ignores-termination',
      command: process.execPath,
      args: ['-e', 'process.on("SIGTERM", () => {});' + ${JSON.stringify(fixtureProcessSource(childPidFile, cleanupFile, 15_000))} + '; setInterval(() => {}, 5000)'],
    }], { writeReport: false });
    setInterval(() => {
      if (fs.existsSync(${JSON.stringify(childPidFile)})) {
        if (${JSON.stringify(binding)} === 'missing-binding') {
          const directory = ${JSON.stringify(path.join(tempRoot, '.local/state/weapp-agent/machine-e2e/scopes'))};
          for (const file of fs.readdirSync(directory)) {
            const record = JSON.parse(fs.readFileSync(directory + '/' + file, 'utf8'));
            if (record.ancestors.length) {
              delete record.cleanupKey;
              fs.writeFileSync(directory + '/' + file, JSON.stringify(record));
            }
          }
        }
        process.exit(0);
      }
    }, 10);
  `)
  fs.writeFileSync(outerScript, `
    import fs from 'node:fs';
    import { runTaskSuite } from ${JSON.stringify(suiteRunnerUrl)};
    ${fixtureProcessSource(outerPidFile, cleanupFile, 15_000)}
    let scopesBeforeNextTask;
    try {
      const exitCode = await runTaskSuite('e2e:runner-exit-fixture', [{
        label: 'exiting-runner',
        command: process.execPath,
        args: ${JSON.stringify(['--import', 'tsx', '--import', preloadUrl, runnerScript])},
        env: { WEAPP_VITE_E2E_TASK_TIMEOUT_MS: '5000' },
      }, {
        label: 'after-recovery',
        command: process.execPath,
        args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "started")', ${JSON.stringify(nextTaskFile)}],
      }], {
        writeReport: false, failOnTaskFailure: false, stopOnTaskFailure: false,
        beforeEachTask: task => {
          if (task.label !== 'after-recovery') return;
          const directory = ${JSON.stringify(path.join(tempRoot, '.local/state/weapp-agent/machine-e2e/scopes'))};
          const credential = JSON.parse(task.env.WEAPP_VITE_E2E_MACHINE_LEASE);
          scopesBeforeNextTask = fs.readdirSync(directory)
            .filter(file => file !== credential.scopes.at(-1) + '.json')
            .map(file => JSON.parse(fs.readFileSync(directory + '/' + file, 'utf8')));
        },
      });
      fs.writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify({ exitCode, scopesBeforeNextTask }));
      process.exitCode = exitCode;
    }
    catch (error) {
      fs.writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify({ blocked: true, error: error.message }));
      process.exitCode = 1;
    }
  `)

  const errors: unknown[] = []
  try {
    const running = promisify(execFile)(process.execPath, ['--import', 'tsx', '--import', preloadUrl, outerScript], {
      cwd: path.resolve(import.meta.dirname, '../../..'),
      env: {
        ...process.env,
        WEAPP_VITE_E2E_MACHINE_LEASE: '',
        WEAPP_IDE_MANAGED_PROJECT_JOURNAL: path.join(tempRoot, 'journals'),
      },
      timeout: 10_000,
      killSignal: 'SIGKILL',
    })
    if (binding === 'missing-binding') {
      await expect(running).rejects.toMatchObject({ code: 1 })
    }
    else {
      await expect(running).resolves.toHaveProperty('stdout')
    }
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8')) as {
      exitCode?: number
      blocked?: boolean
      error?: string
      scopesBeforeNextTask?: { sealed: boolean, completed: boolean, cleanupKey?: string }[]
    }
    if (binding === 'missing-binding') {
      expect(result).toMatchObject({ blocked: true, error: expect.stringContaining('unfinished cleanup') })
      expect(fs.existsSync(nextTaskFile)).toBe(false)
    }
    else {
      expect(result.exitCode).toBe(0)
      expect(fs.readFileSync(nextTaskFile, 'utf8')).toBe('started')
      expect(result.scopesBeforeNextTask).toHaveLength(2)
      expect(result.scopesBeforeNextTask?.every(scope => scope.sealed && scope.completed && typeof scope.cleanupKey === 'string')).toBe(true)
    }
    const childPid = parseFixturePid(fs.readFileSync(childPidFile, 'utf8'))
    await expect.poll(() => !isFixtureProcessAlive(childPid), { timeout: 2000 }).toBe(true)
    const leaseDirectory = path.join(tempRoot, '.local', 'state', 'weapp-agent', 'machine-e2e')
    if (binding === 'missing-binding') {
      expect(fs.existsSync(path.join(leaseDirectory, 'owner.json'))).toBe(true)
      const scopesDirectory = path.join(leaseDirectory, 'scopes')
      const scopes = fs.readdirSync(scopesDirectory).map(file => JSON.parse(fs.readFileSync(path.join(scopesDirectory, file), 'utf8')) as { completed: boolean })
      expect(scopes.length).toBeGreaterThanOrEqual(2)
      expect(scopes.every(scope => !scope.completed)).toBe(true)
    }
    else {
      expect(fs.existsSync(leaseDirectory)).toBe(false)
    }
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    try {
      await requestFixtureCleanup({ cleanupFile, pidFiles: [outerPidFile, runnerPidFile, childPidFile], timeoutMs: 2000 })
      // 只在本 fixture 注册的进程均已停止后删除控制文件和隔离租约。
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
    catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Nested runner assertion and fixture cleanup failed.')
  }
}, 15_000)
