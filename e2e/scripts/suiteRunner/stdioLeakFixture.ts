import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

function readPid(file: string) {
  if (!fs.existsSync(file)) {
    return undefined
  }
  const pid = Number(fs.readFileSync(file, 'utf8'))
  return Number.isInteger(pid) && pid > 0 ? pid : undefined
}

function isAlive(pid: number | undefined) {
  if (pid === undefined) {
    return false
  }
  try {
    process.kill(pid, 0)
    if (process.platform === 'linux') {
      // Linux runner 的 init 可能延迟收尸；僵尸已退出，不再执行 fixture 或持有管道。
      const status = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const state = status.slice(status.lastIndexOf(') ') + 2, status.lastIndexOf(') ') + 3)
      return state !== 'Z' && state !== 'X'
    }
    return true
  }
  catch (error) {
    if (['ESRCH', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      return false
    }
    throw error
  }
}

function stopPid(pid: number | undefined) {
  if (pid === undefined) {
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error
    }
  }
}

/** 真实后代继承 stdout/stderr；记录启动阶段，失败时只回收本 fixture 登记的 PID。 */
export function createStdioLeakFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-runner-child-exit-'))
  const parentPidFile = path.join(root, 'parent.pid')
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
    fs.writeFileSync(${JSON.stringify(readyPidFile)}, String(process.pid));
    record('descendant-start');
    setTimeout(() => {}, 10000);
    process.on('disconnect', () => record('descendant-disconnect'));
    process.send('ready', error => record('ready-sent', error?.message));
  `)
  fs.writeFileSync(scriptPath, `
    ${diagnostics}
    fs.writeFileSync(${JSON.stringify(parentPidFile)}, String(process.pid));
    record('parent-start');
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, [${JSON.stringify(descendantScriptPath)}], {
      detached: true,
      windowsHide: true,
      stdio: ['ignore', 1, 2, 'ipc'],
    });
    if (child.pid) fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid));
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

  const snapshot = () => ({
    root,
    parent: { pid: readPid(parentPidFile), alive: isAlive(readPid(parentPidFile)) },
    descendant: { pid: readPid(childPidFile), alive: isAlive(readPid(childPidFile)), readyPid: readPid(readyPidFile) },
    events: fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8') : '',
  })

  return {
    scriptPath,
    snapshot,
    descendantPid: () => readPid(readyPidFile),
    async cleanup(runPromise: Promise<number>) {
      let runnerSettled = false
      let runnerError: unknown
      void runPromise.then(() => {
        runnerSettled = true
      }, (error: unknown) => {
        runnerError = error
        runnerSettled = true
      })
      // 同一两秒收尾预算包含精确 PID 回收和 runner 终结，不能再次无界 await 掩盖首错。
      const deadline = Date.now() + 2000
      stopPid(readPid(parentPidFile))
      stopPid(readPid(childPidFile))
      while (true) {
        if (runnerSettled && !isAlive(readPid(parentPidFile)) && !isAlive(readPid(childPidFile))) {
          break
        }
        if (Date.now() >= deadline) {
          throw new Error(`Inherited stdio fixture cleanup was not confirmed; retained evidence: ${JSON.stringify(snapshot())}`)
        }
        await delay(20)
      }
      if (runnerError) {
        throw runnerError
      }
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}
