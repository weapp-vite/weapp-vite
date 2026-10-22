import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { resolveWechatInspectionTimeout } from '../devtoolsTarget/inspection'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from './index'

vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/devtools-runtime')>(),
  withMachineE2ELease: async (run: () => Promise<unknown>) => run(),
}))

const loaderBudget = 10_000
const inspectionBudget = resolveWechatInspectionTimeout(process.platform)
const journalLockBudget = 45_000
const settlementBudget = 5_000
// 查询和锁保留正式预算；外层仅为错误落盘、IPC 派发与文件操作留出余量。
const checkpoints = [
  { phase: 'bootstrapped', budget: loaderBudget },
  { phase: 'modules-loaded', budget: loaderBudget },
  { phase: 'writer-identified', budget: inspectionBudget + settlementBudget },
  { phase: 'journal-created', budget: journalLockBudget * 2 + settlementBudget },
  { phase: 'host-identified', budget: inspectionBudget + settlementBudget },
  { phase: 'lock-held', budget: journalLockBudget + settlementBudget },
] as const
const workerStopBudget = journalLockBudget * 2 + inspectionBudget + settlementBudget
// 两次恢复包含父 writer 自查、死锁 owner 核验及两次 host 核验，以及各次锁的获取和释放。
const recoveryBudget = inspectionBudget * 4 + journalLockBudget * 4 + settlementBudget
const testBudget = checkpoints.reduce((total, checkpoint) => total + checkpoint.budget, 0) + workerStopBudget + recoveryBudget

it('recovers a dead worker journal lock but retains window ownership when its listener disappeared', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-worker-recovery-'))
  const journalPath = path.join(directory, 'journal')
  const moduleUrl = (name: string) => pathToFileURL(path.join(import.meta.dirname, name)).href
  // 模拟官方回执已落盘的边界，随后在真实跨进程临界区中终止工作进程。
  // 假 CLI 从未创建；任何误发关闭命令都会直接使本测试失败。
  const script = `
    import net from 'node:net';
    const abort = new AbortController();
    process.on('message', message => {
      if (message?.type === 'stop-recovery-worker') abort.abort(new Error('Recovery worker stopped before its checkpoint'));
    });
    const checkpoint = async phase => {
      abort.signal.throwIfAborted();
      await new Promise((resolve, reject) => process.send({ type: 'managed-recovery-phase', phase }, error => error ? reject(error) : resolve()));
      abort.signal.throwIfAborted();
    };
    let server;
    try {
      await checkpoint('bootstrapped');
      const [{ beginManagedWechatProject, readManagedWechatProjectRecords }, { readManagedProcessIdentity }, { withManagedJournalLock, writeManagedRecord }, { readManagedJournalWriterIdentity }] = await Promise.all([
        import(${JSON.stringify(moduleUrl('index.ts'))}),
        import(${JSON.stringify(moduleUrl('host.ts'))}),
        import(${JSON.stringify(moduleUrl('journal.ts'))}),
        import(${JSON.stringify(moduleUrl('journal/writerIdentity.ts'))}),
      ]);
      await checkpoint('modules-loaded');
      await readManagedJournalWriterIdentity();
      await checkpoint('writer-identified');
      const input = JSON.parse(process.env.MANAGED_TEST_INPUT);
      const intent = await beginManagedWechatProject(input);
      await checkpoint('journal-created');
      server = net.createServer(socket => socket.destroy());
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const record = (await readManagedWechatProjectRecords())[0];
      record.state = 'owned';
      record.openedProjectWindow = true;
      record.port = server.address().port;
      record.host = await readManagedProcessIdentity(process.pid);
      await checkpoint('host-identified');
      await writeManagedRecord(record);
      await withManagedJournalLock(intent.journalPath, async () => {
        await checkpoint('lock-held');
        await new Promise((resolve, reject) => {
          abort.signal.addEventListener('abort', () => reject(abort.signal.reason), { once: true });
          if (abort.signal.aborted) reject(abort.signal.reason);
        });
      });
    }
    finally {
      server?.close();
      if (process.connected) process.disconnect();
    }
  `
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: {
      ...process.env,
      [MANAGED_PROJECT_JOURNAL_ENV]: journalPath,
      MANAGED_TEST_INPUT: JSON.stringify({
        target: { cliPath: path.join(directory, 'unavailable-cli'), appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), installationId: 'worker-fixture' },
        projectPath: path.join(directory, 'project'),
      }),
    },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  let exited = false
  let closed = false
  let spawnError: Error | undefined
  let stdout = ''
  let stderr = ''
  let stoppingRequested = false
  let checkpointIndex = 0
  const phases: string[] = []
  const started = Date.now()
  child.once('exit', () => {
    exited = true
  })
  child.on('error', (error) => {
    spawnError = error
  })
  const completion = new Promise<void>((resolve) => {
    child.once('close', () => {
      closed = true
      resolve()
    })
  })
  child.stdout!.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.stderr!.on('data', (chunk) => {
    stderr += String(chunk)
  })
  const requestStop = () => {
    if (child.connected) {
      child.send({ type: 'stop-recovery-worker' }, () => {})
    }
  }
  child.on('message', () => {
    // loader 超时前发出的取消可能早于 worker listener；首个实际阶段重新确认取消。
    if (stoppingRequested) {
      requestStop()
    }
  })
  const diagnostic = (reason: string) => new Error(`${reason}; phases=${JSON.stringify(phases)}; exitCode=${child.exitCode}; signal=${child.signalCode}; spawnError=${spawnError?.message ?? 'none'}; stdout=${JSON.stringify(stdout)}; stderr=${JSON.stringify(stderr)}`)
  let stopping: Promise<void> | undefined
  const stopChild = () => {
    stopping ??= (async () => {
      if (!exited && child.pid !== undefined) {
        if (checkpointIndex === checkpoints.length) {
          child.kill('SIGKILL')
        }
        else {
          // 中途失败等待在途正式查询结束，再退出，避免遗留 PowerShell 子进程。
          stoppingRequested = true
          requestStop()
        }
      }
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(diagnostic('Recovery worker cleanup exceeded its operation budget')), workerStopBudget)
        void completion.then(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    })()
    return stopping
  }
  let bodyFailed = false
  let bodyError: unknown
  let cleanupFailed = false
  let cleanupError: unknown
  try {
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      let settled = false
      const removeListeners: (() => void)[] = []
      const finish = (error?: Error) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        for (const removeListener of removeListeners) {
          removeListener()
        }
        if (error) {
          reject(error)
        }
        else {
          resolve()
        }
      }
      const schedule = () => {
        const checkpoint = checkpoints[checkpointIndex]!
        timer = setTimeout(() => finish(diagnostic(`Worker did not reach ${checkpoint.phase} within ${checkpoint.budget}ms`)), checkpoint.budget)
      }
      function onMessage(message: unknown) {
        const checkpoint = checkpoints[checkpointIndex]
        if (!checkpoint || !message || typeof message !== 'object' || !('type' in message) || message.type !== 'managed-recovery-phase'
          || !('phase' in message) || message.phase !== checkpoint.phase) {
          finish(diagnostic('Recovery worker sent an invalid or out-of-order checkpoint'))
          return
        }
        phases.push(`${checkpoint.phase}@${Date.now() - started}ms`)
        checkpointIndex++
        clearTimeout(timer)
        if (checkpointIndex === checkpoints.length) {
          finish()
        }
        else {
          schedule()
        }
      }
      function onClose() {
        finish(diagnostic('Worker exited before holding the journal lock'))
      }
      function onError() {
        finish(diagnostic('Worker process failed before holding the journal lock'))
      }
      removeListeners.push(
        () => {
          child.off('message', onMessage)
        },
        () => {
          child.off('close', onClose)
        },
        () => {
          child.off('error', onError)
        },
      )
      child.on('message', onMessage)
      child.once('close', onClose)
      child.once('error', onError)
      schedule()
      if (closed) {
        onClose()
      }
      else if (spawnError) {
        onError()
      }
    })
    await stopChild()
    const before = await readManagedWechatProjectRecords(journalPath)
    expect(before).toHaveLength(1)
    expect(before[0]).toMatchObject({ state: 'owned', ownerPid: child.pid })
    await expect(cleanupManagedWechatProjects({ journalPath })).rejects.toThrow('stop the acceptance lane')
    expect((await readManagedWechatProjectRecords(journalPath))[0]).toMatchObject({ id: before[0]!.id, state: 'failed', error: expect.stringContaining('listener exited without a confirmed project close') })
    await expect(fs.access(path.join(journalPath, '.ownership-lock'))).rejects.toThrow()
    await expect(cleanupManagedWechatProjects({ journalPath })).rejects.toThrow('stop the acceptance lane')
  }
  catch (error) {
    bodyFailed = true
    bodyError = error
  }
  finally {
    try {
      await stopChild()
      await fs.rm(directory, { recursive: true, force: true })
    }
    catch (error) {
      cleanupFailed = true
      cleanupError = error
    }
  }
  if (cleanupFailed) {
    const errors = bodyFailed && bodyError !== cleanupError ? [bodyError, cleanupError] : [cleanupError]
    throw new AggregateError(errors, diagnostic('Recovery worker cleanup failed; retaining its journal').message)
  }
  if (bodyFailed) {
    throw new AggregateError([bodyError], diagnostic('Recovery worker test failed').message)
  }
}, testBudget)
