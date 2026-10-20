import fs from 'node:fs/promises'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 集成验证只启动本测试持有的 JXA/Node，不启动 IDE 或 ps。
import { execa } from 'execa'
import { describe, expect, it, vi } from 'vitest'
import { readDarwinSnapshot } from './darwinSnapshot'
import { darwinSnapshotScript } from './darwinSnapshotScript'
import { inspectorLines } from './inspectorProtocol'

const row = (pid: number) => `${pid} 1 10 S Mon Oct 19 10:00:00 2026`

describe.skipIf(process.platform !== 'darwin')('real Foundation inspector protocol without RSS sampling', () => {
  it('round-trips one known live PID through real JXA and releases it after synthetic frames', async () => {
    const read = vi.fn(async () => ({ stdout: row(process.pid), inspectorPid: 1 }))
    const snapshot = await readDarwinSnapshot(Date.now() + 10_000, read)
    expect(snapshot.paths.get(process.pid)).toBe(await fs.realpath(process.execPath))
    expect(read).toHaveBeenCalledTimes(2)
  })

  it.each(['{"pids":[1,1]}\n', '{"pids":[0]}\n', '{"pids":[]}\n{}\n', '{}\n'])('rejects malformed single requests and exits (%s)', async (input) => {
    const child = execa('/usr/bin/osascript', ['-l', 'JavaScript', '-e', darwinSnapshotScript], { input, reject: false, timeout: 5_000 })
    const result = await child
    expect(result.exitCode).not.toBe(0)
    expect(result.timedOut).toBe(false)
    expect(result.stdout).toBe('{"phase":"ready"}')
  })

  it('releases its actual JXA child when the owning runner receives SIGTERM', async () => {
    const moduleUrl = new URL('./darwinSnapshot.ts', import.meta.url).href
    const source = `
      import childProcess from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      let held;
      const original = childProcess.spawn;
      childProcess.spawn = function(...args) {
        const child = original.apply(this, args);
        if (args[0] === '/usr/bin/osascript') held = child;
        return child;
      };
      syncBuiltinESMExports();
      const { readDarwinSnapshot } = await import(${JSON.stringify(moduleUrl)});
      await readDarwinSnapshot(Date.now() + 5000, async () => {
        console.log(JSON.stringify({ pid: held.pid }));
        await new Promise(() => {});
      });
    `
    const runner = execa(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source], { reject: false, timeout: 10_000 })
    const terminal = Promise.resolve(runner)
    const lines = inspectorLines(runner.nodeChildProcess.stdout, terminal)
    let inspectorPid: number | undefined
    try {
      const identity: unknown = JSON.parse(await lines.next(5_000))
      if (!identity || typeof identity !== 'object' || !('pid' in identity) || typeof identity.pid !== 'number' || !Number.isSafeInteger(identity.pid) || identity.pid <= 0) {
        throw new Error('Fixture runner did not expose its held child identity.')
      }
      inspectorPid = identity.pid
      runner.kill('SIGTERM')
      expect((await terminal).signal).toBe('SIGTERM')
      // 此处仅观察已登记子进程的消失，不按报告 PID 发清理信号。
      await vi.waitFor(() => {
        expect(() => process.kill(inspectorPid!, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
      }, { timeout: 5_000 })
    }
    finally {
      lines.dispose()
      if (runner.nodeChildProcess.exitCode === null && runner.nodeChildProcess.signalCode === null) {
        runner.kill('SIGTERM')
      }
      await terminal
    }
  })
})
