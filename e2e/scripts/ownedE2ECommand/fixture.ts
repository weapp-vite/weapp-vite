import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

export type ShutdownScenario = 'leader-exits' | 'nested-runner' | 'orphaned-borrower' | 'natural-exit'

export interface ShutdownFixtureState {
  workerPid: number
  runnerPid?: number
  journalPath?: string
}

/** 只创建本测试的 Node 进程；嵌套场景使用真正的 suiteRunner 与机器租约。 */
export async function createShutdownFixture(scenario: ShutdownScenario) {
  const root = await mkdtemp(path.join(tmpdir(), 'owned-command-shutdown-'))
  const workerFile = path.join(root, 'worker.cjs')
  const leaderFile = path.join(root, 'leader.cjs')
  const runnerFile = path.join(root, 'runner.mjs')
  const readyFile = path.join(root, 'ready.json')
  const completedFile = path.join(root, 'completed')
  const journalEnv = 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL'
  await writeFile(workerFile, `
    const fs = require('node:fs');
    process.on('SIGTERM', () => {});
    setInterval(() => {}, 1000);
    fs.writeFileSync(${JSON.stringify(`${readyFile}.tmp`)}, JSON.stringify({
      workerPid: process.pid,
      runnerPid: ${scenario === 'nested-runner' ? 'process.ppid' : 'undefined'},
      journalPath: process.env.${journalEnv},
    }));
    fs.renameSync(${JSON.stringify(`${readyFile}.tmp`)}, ${JSON.stringify(readyFile)});
    process.send?.('ready');
  `)
  const suiteRunnerUrl = pathToFileURL(path.resolve(import.meta.dirname, '../suiteRunner.ts')).href
  await writeFile(runnerFile, `
    import { writeFile } from 'node:fs/promises';
    import { runTaskSuite } from ${JSON.stringify(suiteRunnerUrl)};
    const tasks = [{ label: 'owned-node-worker', command: process.execPath, args: [${JSON.stringify(workerFile)}] }];
    await runTaskSuite('e2e:shutdown-fixture', tasks, {
      writeReport: false,
      reportContext: { runId: 'shutdown-fixture', commitSha: 'fixture', workingTreeDirty: false, partial: false, strict: false, plannedTasks: tasks },
      afterAll: () => writeFile(${JSON.stringify(completedFile)}, 'runner-cleanup-finished'),
    });
  `)
  if (scenario === 'orphaned-borrower') {
    const machineUrl = pathToFileURL(path.resolve(import.meta.dirname, '../../../packages/devtools-runtime/src/lease/machine.ts')).href
    await writeFile(runnerFile, `
      import { writeFile } from 'node:fs/promises';
      import { acquireMachineE2ELease } from ${JSON.stringify(machineUrl)};
      await acquireMachineE2ELease();
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);
      await writeFile(${JSON.stringify(readyFile)}, JSON.stringify({ workerPid: process.pid }));
    `)
  }
  await writeFile(leaderFile, `
    const { spawn } = require('node:child_process');
    ${scenario === 'orphaned-borrower' ? 'process.on("SIGTERM", () => process.kill(process.pid, "SIGKILL"));' : ''}
    const child = spawn(process.execPath, ${JSON.stringify(scenario === 'nested-runner' || scenario === 'orphaned-borrower' ? ['--import', 'tsx', runnerFile] : [workerFile])}, {
      stdio: ${scenario === 'natural-exit' ? '["ignore", "inherit", "inherit", "ipc"]' : '"inherit"'},
      detached: ${scenario === 'orphaned-borrower'},
    });
    ${scenario === 'natural-exit' ? 'child.once("message", () => process.exit(0));' : ''}
  `)
  return {
    leaderFile,
    completedFile,
    async ready(): Promise<ShutdownFixtureState> {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        try {
          return JSON.parse(await readFile(readyFile, 'utf8')) as ShutdownFixtureState
        }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
        }
        await setTimeout(20)
      }
      throw new Error('Owned shutdown fixture did not become ready.')
    },
    dispose: () => rm(root, { recursive: true, force: true }),
  }
}
