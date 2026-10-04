import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { observeProcessTree } from './processTree'

const fixture = `
const { fork } = require('node:child_process');
globalThis.allocation = Buffer.alloc(16 * 1024 * 1024, 1);
const depth = Number(process.argv[2]);
const child = depth > 0 ? fork(__filename, [String(depth - 1)], {
  execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc']
}) : undefined;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    process.exit(0);
  }
  child.once('exit', (code, signal) => process.exit(code === 0 && signal === null ? 0 : 1));
  if (child.connected) child.send('stop');
  else child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 2000).unref();
}
process.on('message', stop);
process.on('disconnect', stop);
process.on('SIGTERM', stop);
if (child) {
  child.once('message', message => process.send({ pids: [process.pid, ...message.pids] }));
  child.once('error', () => process.exit(1));
  child.once('exit', code => { if (!stopping) process.exit(code || 1); });
} else {
  process.send({ pids: [process.pid] });
}
`

async function closeTree(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    if (child.exitCode !== 0 || child.signalCode !== null) {
      throw new Error(`Owned process fixture did not close gracefully (${child.exitCode}, ${child.signalCode})`)
    }
    return
  }
  const stopped = Promise.withResolvers<void>()
  child.once('exit', (code, signal) => {
    if (code === 0 && signal === null) {
      stopped.resolve()
    }
    else {
      stopped.reject(new Error(`Owned process fixture did not close gracefully (${code}, ${signal})`))
    }
  })
  const terminate = setTimeout(() => child.kill('SIGTERM'), 4000)
  const kill = setTimeout(() => child.kill('SIGKILL'), 8000)
  if (child.connected) {
    child.send('stop')
  }
  else {
    child.kill('SIGTERM')
  }
  try {
    await stopped.promise
  }
  finally {
    clearTimeout(terminate)
    clearTimeout(kill)
  }
}

// 原生 Windows 采样在实际 runner 冷启动，单测中的平台模拟不能代替此检查。
it.runIf(process.platform === 'win32')('reads a live owned Windows tree and counts working sets in bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'process-tree-observation-'))
  let child: ChildProcess | undefined
  try {
    const file = path.join(root, 'tree.cjs')
    await writeFile(file, fixture)
    child = fork(file, ['2'], { execArgv: [], stdio: ['ignore', 'ignore', 'inherit', 'ipc'], windowsHide: true })
    const ready = Promise.withResolvers<number[]>()
    const timer = setTimeout(() => ready.reject(new Error('Owned process fixture did not start')), 5000)
    child.once('message', (message: { pids: number[] }) => ready.resolve(message.pids))
    child.once('error', ready.reject)
    child.once('exit', (code, signal) => ready.reject(new Error(`Owned process fixture exited before observation (${code}, ${signal})`)))
    let pids: number[]
    try {
      pids = await ready.promise
    }
    finally {
      clearTimeout(timer)
    }
    const observation = await observeProcessTree(child.pid!)
    console.info('Windows process-tree observation', { observationMs: observation.observationMs, processCount: observation.processCount })
    expect(observation.processCount).toBe(3)
    expect(observation.members.map(row => row.pid).sort((a, b) => a - b)).toEqual([...pids].sort((a, b) => a - b))
    for (const [index, pid] of pids.entries()) {
      const row = observation.members.find(row => row.pid === pid)!
      expect(row.rssBytes).toBeGreaterThanOrEqual(16 * 1024 * 1024)
      if (index > 0) {
        expect(row.parentPid).toBe(pids[index - 1])
      }
    }
    expect(observation.members.some(row => row.pid === process.pid)).toBe(false)
    expect(observation.rssBytes).toBe(observation.members.reduce((sum, row) => sum + row.rssBytes, 0))
  }
  finally {
    try {
      if (child) {
        await closeTree(child)
      }
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }
}, 30_000)
