import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { cleanupManagedWechatProjects, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from './index'

vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/devtools-runtime')>(),
  withMachineE2ELease: async (run: () => Promise<unknown>) => run(),
}))

it('recovers a dead worker journal lock but retains window ownership when its listener disappeared', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-worker-recovery-'))
  const journalPath = path.join(directory, 'journal')
  const moduleUrl = (name: string) => pathToFileURL(path.join(import.meta.dirname, name)).href
  // 模拟官方回执已落盘的边界，随后在真实跨进程临界区中终止工作进程。
  // 假 CLI 从未创建；任何误发关闭命令都会直接使本测试失败。
  const script = `
    import net from 'node:net';
    import { beginManagedWechatProject, readManagedWechatProjectRecords } from ${JSON.stringify(moduleUrl('index.ts'))};
    import { readManagedProcessIdentity } from ${JSON.stringify(moduleUrl('host.ts'))};
    import { withManagedJournalLock, writeManagedRecord } from ${JSON.stringify(moduleUrl('journal.ts'))};
    const input = JSON.parse(process.env.MANAGED_TEST_INPUT);
    const intent = await beginManagedWechatProject(input);
    const server = net.createServer(socket => socket.destroy());
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const record = (await readManagedWechatProjectRecords())[0];
    record.state = 'owned';
    record.openedProjectWindow = true;
    record.port = server.address().port;
    record.host = await readManagedProcessIdentity(process.pid);
    await writeManagedRecord(record);
    await withManagedJournalLock(intent.journalPath, async () => {
      process.stdout.write('journal-locked\\n');
      await new Promise(() => {});
    });
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
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let exited = false
  let output = ''
  const exit = once(child, 'exit').then(() => {
    exited = true
  })
  child.stderr.on('data', (chunk) => {
    output += String(chunk)
  })
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Worker did not acquire the journal: ${output}`)), 10_000)
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes('journal-locked')) {
          clearTimeout(timer)
          resolve()
        }
      })
      void exit.then(() => {
        clearTimeout(timer)
        reject(new Error(`Worker exited before the checkpoint: ${output}`))
      })
    })
    child.kill('SIGKILL')
    await exit
    const before = await readManagedWechatProjectRecords(journalPath)
    expect(before).toHaveLength(1)
    expect(before[0]).toMatchObject({ state: 'owned', ownerPid: child.pid })
    await expect(cleanupManagedWechatProjects({ journalPath })).rejects.toThrow('stop the acceptance lane')
    expect((await readManagedWechatProjectRecords(journalPath))[0]).toMatchObject({ id: before[0]!.id, state: 'failed', error: expect.stringContaining('listener exited without a confirmed project close') })
    await expect(fs.access(path.join(journalPath, '.ownership-lock'))).rejects.toThrow()
    await expect(cleanupManagedWechatProjects({ journalPath })).rejects.toThrow('stop the acceptance lane')
  }
  finally {
    if (!exited) {
      child.kill('SIGKILL')
      await exit
    }
    await fs.rm(directory, { recursive: true, force: true })
  }
})
