import { once } from 'node:events'
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Worker } from 'node:worker_threads'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 Node 进程验证失败恢复与真实 Unicode 可执行文件身份。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { runWithCleanup } from '../runWithCleanup'

it.runIf(process.platform === 'win32')('removes concurrent cold-query executables before its worker is terminated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kernel-query-lifetime-'))
  await runWithCleanup(async () => {
    const source = `
      import assert from 'node:assert/strict';
      import { parentPort } from 'node:worker_threads';
      import { queryWindowsKernelProcesses } from ${JSON.stringify(new URL('./windowsKernelQuery.ts', import.meta.url).href)};
      import { parseWindowsProcessRows } from ${JSON.stringify(new URL('./windowsProcessRows.ts', import.meta.url).href)};
      const rootKey = Object.keys(process.env).find(key => key.toLowerCase() === 'systemroot')
        ?? Object.keys(process.env).find(key => key.toLowerCase() === 'windir');
      assert.ok(rootKey);
      const systemRoot = process.env[rootKey];
      for (const key of Object.keys(process.env)) {
        if (['systemroot', 'windir'].includes(key.toLowerCase())) delete process.env[key];
      }
      process.env.sYsTeMrOoT = systemRoot;
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
      parentPort.postMessage({ queryMilliseconds });
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
    try {
      const [report] = await once(worker, 'message', { signal: AbortSignal.timeout(20_000) })
      expect(await readdir(directory)).toEqual([])
      process.stdout.write(`Cold concurrent kernel queries: ${report.queryMilliseconds.toFixed(2)}ms; executable files removed before worker termination.\n`)
    }
    finally {
      await worker.terminate()
    }
    expect(await readdir(directory)).toEqual([])
  }, async () => rm(directory, { recursive: true, force: true }))
}, 30_000)

it.runIf(process.platform === 'win32')('preserves a compiler failure without poisoning a later explicit inspection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kernel-query-recovery-'))
  await runWithCleanup(async () => {
    const queryDirectory = join(directory, 'query-temp')
    const executable = join(directory, '节点 with space.exe')
    await mkdir(queryDirectory)
    await copyFile(process.execPath, executable)
    const source = `
      import assert from 'node:assert/strict';
      import { readdir } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      import { queryWindowsKernelProcesses } from ${JSON.stringify(new URL('./windowsKernelQuery.ts', import.meta.url).href)};
      import { parseWindowsProcessRows } from ${JSON.stringify(new URL('./windowsProcessRows.ts', import.meta.url).href)};
      const systemRoot = process.env.SystemRoot;
      process.env.SystemRoot = join(tmpdir(), 'missing-framework');
      try {
        await assert.rejects(queryWindowsKernelProcesses([process.pid]), error => {
          assert.equal(error.cause?.code, 'ENOENT');
          return true;
        });
        assert.deepEqual(await readdir(tmpdir()), []);
      } finally {
        if (systemRoot === undefined) delete process.env.SystemRoot;
        else process.env.SystemRoot = systemRoot;
      }
      const result = await queryWindowsKernelProcesses([process.pid]);
      assert.equal(result.exitCode, 0);
      const rows = parseWindowsProcessRows(result.stdout);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].ProcessId, process.pid);
      assert.equal(rows[0].ParentProcessId, process.ppid);
      assert.equal(rows[0].ExecutablePath, process.execPath);
      assert.deepEqual(await readdir(tmpdir()), []);
    `
    await execa(executable, ['--import', 'tsx', '--input-type=module', '-e', source], {
      stdin: 'ignore',
      timeout: 20_000,
      windowsHide: true,
      env: {
        TMP: queryDirectory,
        TEMP: queryDirectory,
        TSX_DISABLE_CACHE: '1',
        WEAPP_VITE_E2E_CLEANUP_TRACE: undefined,
      },
    })
    expect(await readdir(queryDirectory)).toEqual([])
  }, async () => rm(directory, { recursive: true, force: true }))
}, 30_000)
