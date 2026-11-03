import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fixtureProcessSource, isFixtureProcessAlive, readFixturePid, requestFixtureCleanup } from './fixtureProcessControl'

/** 真实后代继承 stdout/stderr；记录启动阶段，失败时通过隔离控制文件请求 fixture 自退出。 */
export function createStdioLeakFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-child-exit-'))
  const parentPidFile = path.join(root, 'parent.pid')
  const cleanupFile = path.join(root, 'cleanup')
  const childPidFile = path.join(root, 'spawned-child.pid')
  const readyPidFile = path.join(root, 'ready-child.pid')
  const eventsFile = path.join(root, 'events.jsonl')
  const scriptPath = path.join(root, 'leak-stdio.cjs')
  const descendantScriptPath = path.join(root, 'descendant.cjs')
  const diagnostics = `
    const fs = require('node:fs');
    const record = (phase, detail) => fs.appendFileSync(${JSON.stringify(eventsFile)}, JSON.stringify({ pid: process.pid, phase, detail, at: Date.now() }) + '\\n');
    process.on('exit', code => record('exit', code));
  `
  fs.writeFileSync(descendantScriptPath, `
    ${diagnostics}
    ${fixtureProcessSource(readyPidFile, cleanupFile, 10_000)}
    record('descendant-start');
    setTimeout(() => {}, 10000);
    process.on('disconnect', () => record('descendant-disconnect'));
    process.send('ready', error => record('ready-sent', error?.message));
  `)
  fs.writeFileSync(scriptPath, `
    ${diagnostics}
    ${fixtureProcessSource(parentPidFile, cleanupFile, 10_000)}
    record('parent-start');
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, [${JSON.stringify(descendantScriptPath)}], {
      detached: true,
      windowsHide: true,
      stdio: ['ignore', 1, 2, 'ipc'],
    });
    if (child.pid) {
      fs.writeFileSync(${JSON.stringify(`${childPidFile}.pending`)}, String(child.pid));
      fs.renameSync(${JSON.stringify(`${childPidFile}.pending`)}, ${JSON.stringify(childPidFile)});
    }
    record('spawn-returned', child.pid);
    child.once('spawn', () => record('spawn-event'));
    child.once('error', error => { record('spawn-error', error.message); process.exitCode = 1; });
    child.once('exit', (code, signal) => record('descendant-exit', { code, signal }));
    child.once('message', message => {
      record('ready-received', message);
      child.disconnect();
      record('disconnect-returned');
      child.unref();
      record('parent-exit-request');
      process.exit(0);
    });
  `)

  const alive = (file: string) => {
    const pid = readFixturePid(file)
    return pid !== undefined && isFixtureProcessAlive(pid)
  }
  const snapshot = () => ({
    root,
    parent: { pid: readFixturePid(parentPidFile), alive: alive(parentPidFile) },
    descendant: { pid: readFixturePid(childPidFile), alive: alive(childPidFile), readyPid: readFixturePid(readyPidFile) },
    events: fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8') : '',
  })

  return {
    scriptPath,
    snapshot,
    descendantPid: () => readFixturePid(readyPidFile),
    async cleanup(runPromise: Promise<number>) {
      let runnerSettled = false
      let runnerError: unknown
      void runPromise.then(() => {
        runnerSettled = true
      }, (error: unknown) => {
        runnerError = error
        runnerSettled = true
      })
      // 同一两秒预算包含 fixture 自退出和 runner 终结；未知注册保留控制文件。
      await requestFixtureCleanup({ cleanupFile, pidFiles: [parentPidFile, readyPidFile], timeoutMs: 2000, runnerSettled: () => runnerSettled })
      if (runnerError) {
        throw runnerError
      }
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}
