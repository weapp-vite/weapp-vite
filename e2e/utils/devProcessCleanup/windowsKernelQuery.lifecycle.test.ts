import { on } from 'node:events'
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Worker } from 'node:worker_threads'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 Node 进程验证失败恢复与真实 Unicode 可执行文件身份。
import { execaSync } from 'execa'
import { expect, it } from 'vitest'
import { runWithCleanup } from '../runWithCleanup'

interface WorkerReport {
  type: string
  message?: string
  queryMilliseconds?: number
}

async function waitForWorkerReport(worker: Worker, type: string, timeoutMs: number): Promise<WorkerReport> {
  for await (const [value] of on(worker, 'message', { signal: AbortSignal.timeout(timeoutMs) })) {
    const report = value as WorkerReport
    if (report.type === 'drain-failed' || (type !== 'drained' && report.type === 'failed')) {
      throw new Error(report.message ?? 'Windows kernel query worker failed.')
    }
    if (report.type === type) {
      return report
    }
  }
  throw new Error(`Windows kernel query worker closed before ${type}.`)
}

it.runIf(process.platform === 'win32')('removes concurrent prebuilt-query executables before its worker is terminated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kernel-query-lifetime-'))
  let safeToRemove = true
  await runWithCleanup(async () => {
    const source = `
      import assert from 'node:assert/strict';
      import { readdir } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { parentPort } from 'node:worker_threads';
      import { drainWindowsKernelQueries, queryWindowsKernelProcesses } from ${JSON.stringify(new URL('./windowsKernelQuery.ts', import.meta.url).href)};
      import { parseWindowsProcessRows } from ${JSON.stringify(new URL('./windowsProcessRows.ts', import.meta.url).href)};
      let queries;
      parentPort.on('message', async message => {
        if (message !== 'close') return;
        try {
          // 取消保留原始查询失败；必须等同一原生 child close 与目录排空后才回执。
          await drainWindowsKernelQueries(new Error('Worker owner is closing.')).catch(() => {});
          await queries.catch(() => {});
          assert.deepEqual(await readdir(tmpdir()), []);
          parentPort.postMessage({ type: 'drained' });
        } catch (error) {
          parentPort.postMessage({ type: 'drain-failed', message: String(error) });
        }
      });
      queries = (async () => {
        const started = performance.now();
        const fullQuery = queryWindowsKernelProcesses();
        const requestedPids = [process.pid];
        const selectedQuery = queryWindowsKernelProcesses(requestedPids);
        requestedPids.length = 0;
        const results = await Promise.all([fullQuery, selectedQuery]);
        const queryMilliseconds = performance.now() - started;
        for (const result of results) assert.equal(result.exitCode, 0);
        const full = parseWindowsProcessRows(results[0].stdout);
        const selected = parseWindowsProcessRows(results[1].stdout);
        assert.equal(selected.length, 1);
        assert.equal(selected[0].ProcessId, process.pid);
        assert.equal(selected[0].ParentProcessId, process.ppid);
        assert.deepEqual(full.filter(row => row.ProcessId === process.pid), selected);
        parentPort.postMessage({ type: 'queried', queryMilliseconds });
      })();
      void queries.catch(error => parentPort.postMessage({ type: 'failed', message: String(error) }));
      setInterval(() => {}, 1000);
    `
    const worker = new Worker(source, {
      eval: true,
      execArgv: ['--import', 'tsx', '--input-type=module'],
      env: {
        ...process.env,
        TMP: directory,
        TEMP: directory,
        TSX_DISABLE_CACHE: '1',
        WEAPP_VITE_E2E_CLEANUP_TRACE: '0',
      },
    })
    safeToRemove = false
    try {
      const report = await waitForWorkerReport(worker, 'queried', 20_000)
      expect(await readdir(directory)).toEqual([])
      expect(report.queryMilliseconds).toEqual(expect.any(Number))
      process.stdout.write(`Concurrent prebuilt kernel queries: ${report.queryMilliseconds!.toFixed(2)}ms; executable files removed before worker termination.\n`)
    }
    finally {
      const drained = waitForWorkerReport(worker, 'drained', 10_000)
      worker.postMessage('close')
      await drained
      await worker.terminate()
      safeToRemove = true
    }
    expect(await readdir(directory)).toEqual([])
  }, async () => {
    if (!safeToRemove) {
      throw new Error(`Kernel query worker did not confirm native cleanup; its directory is retained: ${directory}`)
    }
    await rm(directory, { recursive: true, force: true })
  })
}, 40_000)

it.runIf(process.platform === 'win32')('drains an active owned inspector executable before acknowledging worker closure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kernel-query-active-close-'))
  let safeToRemove = true
  await runWithCleanup(async () => {
    const source = `
      import assert from 'node:assert/strict';
      import { once } from 'node:events';
      import { copyFile, readdir } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      import { parentPort } from 'node:worker_threads';
      import { execa } from 'execa';
      import { withWindowsInspectorDirectory } from ${JSON.stringify(new URL('./windowsInspectorOperation.ts', import.meta.url).href)};
      const controller = new AbortController();
      let nativeClosed = false;
      const operation = withWindowsInspectorDirectory(async (directory, settle) => {
        const executable = join(directory, 'snapshot.exe');
        await copyFile(process.execPath, executable);
        // 使用本测试独占的长驻映像锁定 active 状态，不修改共享 C# 工具或依赖执行竞速。
        const subprocess = execa(executable, ['-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000)'], {
          stdin: 'ignore', reject: false, windowsHide: true, cancelSignal: controller.signal,
        });
        const child = subprocess.nodeChildProcess;
        child.once('close', () => nativeClosed = true);
        const ready = once(child.stdout, 'data');
        const result = settle(subprocess);
        await ready;
        parentPort.postMessage({ type: 'active', pid: child.pid });
        return result;
      });
      void operation.catch(error => parentPort.postMessage({ type: 'failed', message: String(error) }));
      parentPort.on('message', async message => {
        if (message !== 'close') return;
        controller.abort(new Error('Worker owner is closing.'));
        try {
          const result = await operation;
          assert.equal(result.isCanceled, true);
          assert.equal(nativeClosed, true);
          assert.deepEqual(await readdir(tmpdir()), []);
          parentPort.postMessage({ type: 'drained' });
        } catch (error) {
          parentPort.postMessage({ type: 'drain-failed', message: String(error) });
        }
      });
      setInterval(() => {}, 1000);
    `
    const worker = new Worker(source, {
      eval: true,
      execArgv: ['--import', 'tsx', '--input-type=module'],
      env: { ...process.env, TMP: directory, TEMP: directory, TSX_DISABLE_CACHE: '1' },
    })
    safeToRemove = false
    try {
      await waitForWorkerReport(worker, 'active', 20_000)
      expect(await readdir(directory)).toHaveLength(1)
    }
    finally {
      const drained = waitForWorkerReport(worker, 'drained', 10_000)
      worker.postMessage('close')
      await drained
      await worker.terminate()
      safeToRemove = true
    }
    expect(await readdir(directory)).toEqual([])
  }, async () => {
    if (!safeToRemove) {
      throw new Error(`Active inspector cleanup is unconfirmed; its directory is retained: ${directory}`)
    }
    await rm(directory, { recursive: true, force: true })
  })
}, 40_000)

it.runIf(process.platform === 'win32')('does not let an isolated missing artifact poison a later Unicode process inspection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kernel-query-recovery-'))
  const executable = join(directory, '节点 with space.exe')
  const queryDirectory = join(directory, 'query-temp')
  let safeToRemove = true
  await runWithCleanup(async () => {
    await mkdir(queryDirectory)
    await copyFile(process.execPath, executable)
    const source = `
      import assert from 'node:assert/strict';
      import { readdir } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      import { readWindowsKernelInspector } from ${JSON.stringify(new URL('./windowsKernelArtifact.ts', import.meta.url).href)};
      import { queryWindowsKernelProcesses } from ${JSON.stringify(new URL('./windowsKernelQuery.ts', import.meta.url).href)};
      import { parseWindowsProcessRows } from ${JSON.stringify(new URL('./windowsProcessRows.ts', import.meta.url).href)};
      // 负向读取只针对本测试的临时根，不能篡改共享预构建产物。
      assert.throws(() => readWindowsKernelInspector(join(tmpdir(), 'missing-artifact-workspace')), error => {
        assert.ok(error instanceof Error, error);
        assert.match(error.message, /pnpm e2e:build-tools/);
        assert.ok(error.cause instanceof Error, error);
        assert.equal(error.cause.code, 'ENOENT', error);
        return true;
      });
      assert.deepEqual(await readdir(tmpdir()), []);
      const result = await queryWindowsKernelProcesses([process.pid]);
      assert.equal(result.exitCode, 0);
      const rows = parseWindowsProcessRows(result.stdout);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].ProcessId, process.pid);
      assert.equal(rows[0].ParentProcessId, process.ppid);
      assert.equal(rows[0].ExecutablePath, process.execPath);
      assert.deepEqual(await readdir(tmpdir()), []);
    `
    // 外层等待覆盖原 30 秒查询及进程启动/排空；检查器查询本身不增加预算。
    safeToRemove = false
    execaSync(executable, ['--import', 'tsx', '--input-type=module', '-e', source], {
      stdin: 'ignore',
      timeout: 40_000,
      windowsHide: true,
      env: {
        TMP: queryDirectory,
        TEMP: queryDirectory,
        TSX_DISABLE_CACHE: '1',
        WEAPP_VITE_E2E_CLEANUP_TRACE: undefined,
      },
    })
    safeToRemove = true
    expect(await readdir(queryDirectory)).toEqual([])
  }, async () => {
    if (!safeToRemove && (await readdir(queryDirectory)).length) {
      throw new Error(`Unicode inspection did not confirm native cleanup; its directory is retained: ${directory}`)
    }
    // 只重试可执行文件，避免递归目录与子文件分别重试而超出测试预算。
    await rm(executable, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    await rm(directory, { recursive: true, force: true })
  })
}, 50_000)
