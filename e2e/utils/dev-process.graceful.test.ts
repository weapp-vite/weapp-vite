import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { expect, it } from 'vitest'
import { cleanupTrackedDevProcesses, startDevProcess } from './dev-process'
import { DevProcessGracefulShutdownError } from './devProcessCleanup/shutdown'

const shutdownModule = new URL('../../packages/weapp-vite/src/devLifecycle/shutdown.ts', import.meta.url).href
const ownerModule = new URL('../../packages/weapp-vite/src/runtime/classicIdeConfig/index.ts', import.meta.url).href

it('fails forced teardown after an IPC stop when the classic session has not released its lease', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'dev-process-classic-incomplete-'))
  const config = path.join(project, 'project.private.config.json')
  const journal = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
  const original = '{\r\n\t"setting": { "compileHotReLoad": true }\r\n}\r\n'
  await writeFile(config, original)
  const dev = startDevProcess(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { DevShutdownScope } from ${JSON.stringify(shutdownModule)};
    import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerModule)};
    const owner = new ClassicIdeConfigOwner();
    const scope = new DevShutdownScope();
    const hold = setInterval(() => {}, 30_000);
    process.once('disconnect', () => console.log('fixture IPC stop received'));
    scope.own(async () => {
      console.log('fixture session close started');
      // 模拟尚未结算的构建关闭；强杀不能冒充后端关闭和配置租约恢复完成。
      await new Promise(() => {});
      await owner.close();
      clearInterval(hold);
      console.log('fixture classic lease released');
    });
    await scope.run('startup', () => owner.activate(${JSON.stringify(config)}));
    console.log('fixture classic owner ready');
    await scope.done;
  `])
  try {
    await dev.waitForOutput('fixture classic owner ready', 'classic config acquisition', 10_000)
    const installed = await readFile(config, 'utf8')
    const savedJournal = await readFile(journal, 'utf8')
    const failure: unknown = await dev.stop(500, { gracefulTimeoutMs: 500 }).catch(error => error)
    const repeated: unknown = await dev.stop(500).catch(error => error)
    const output = dev.getOutput()
    expect(output).toContain('fixture IPC stop received')
    expect(output).toContain('fixture session close started')
    expect(output).not.toContain('fixture classic lease released')
    expect(await readFile(journal, 'utf8')).toBe(savedJournal)
    expect(await readFile(config, 'utf8')).toBe(installed)
    const { ClassicIdeConfigOwner } = await import('../../packages/weapp-vite/src/runtime/classicIdeConfig')
    const next = new ClassicIdeConfigOwner()
    const conflict: unknown = await next.activate(config).catch(error => error)
    expect(conflict).toMatchObject({ code: 'EEXIST' })
    await expect(next.close()).rejects.toBe(conflict)
    expect(await readFile(journal, 'utf8')).toBe(savedJournal)
    expect(await readFile(config, 'utf8')).toBe(installed)
    await expect(cleanupTrackedDevProcesses(0)).resolves.toBeUndefined()
    // 进程已终结仍须报告未完成收尾，后续 stop 不能把首错改写为成功。
    expect(failure).toBeInstanceOf(DevProcessGracefulShutdownError)
    expect(failure).toMatchObject({ evidence: { gracefulTimeoutMs: 500 } })
    expect(repeated).toBe(failure)
    await expect(dev.stop(500)).rejects.toBe(failure)
  }
  finally {
    await dev.stop(500).catch(() => {})
    await rm(project, { recursive: true, force: true })
  }
})

it.each([
  undefined,
  '{\r\n\t"setting": { "compileHotReLoad": true, "urlCheck": false }\r\n}\r\n',
])('normally closes a direct Node development session and permits a second owner (original=%s)', async (original) => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'dev-process-classic-close-'))
  const config = path.join(project, 'project.private.config.json')
  const journal = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
  if (original !== undefined) {
    await writeFile(config, original)
  }
  try {
    for (let generation = 0; generation < 2; generation++) {
      const dev = startDevProcess(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        import { DevShutdownScope } from ${JSON.stringify(shutdownModule)};
        import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerModule)};
        process.once('exit', code => console.log('normal development exit=' + code));
        const owner = new ClassicIdeConfigOwner();
        const scope = new DevShutdownScope();
        const hold = setInterval(() => {}, 30_000);
        scope.own(async () => { await owner.close(); clearInterval(hold); });
        await scope.run('startup', () => owner.activate(${JSON.stringify(config)}));
        console.log('classic owner ready');
        await scope.done;
      `])
      try {
        await dev.waitForOutput('classic owner ready', 'classic config acquisition', 10_000)
        expect((JSON.parse(await readFile(config, 'utf8')) as { setting: { compileHotReLoad: boolean } }).setting.compileHotReLoad).toBe(false)
        expect(JSON.parse(await readFile(journal, 'utf8'))).toHaveProperty('owner')
      }
      finally {
        await dev.stop(10_000)
      }
      // SIGTERM 与强杀都不能冒充跨平台的正常退出证据。
      expect(dev.getOutput()).toContain('normal development exit=0')
      await expect(readFile(journal)).rejects.toMatchObject({ code: 'ENOENT' })
      if (original === undefined) {
        await expect(readFile(config)).rejects.toMatchObject({ code: 'ENOENT' })
      }
      else {
        expect(await readFile(config, 'utf8')).toBe(original)
      }
    }
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})

it('reports a real shutdown cleanup failure after restoring resources without retaining global tracking', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'dev-process-classic-close-failure-'))
  const config = path.join(project, 'project.private.config.json')
  const journal = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
  const original = '{\r\n\t"setting": { "compileHotReLoad": true }\r\n}\r\n'
  await writeFile(config, original)
  const dev = startDevProcess(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { DevShutdownScope } from ${JSON.stringify(shutdownModule)};
    import { ClassicIdeConfigOwner } from ${JSON.stringify(ownerModule)};
    process.once('exit', code => console.log('failed development exit=' + code));
    const owner = new ClassicIdeConfigOwner();
    const scope = new DevShutdownScope({ reportError: error => console.error('shutdown cleanup failure: ' + error.message) });
    const hold = setInterval(() => {}, 30_000);
    scope.own(async () => {
      await owner.close();
      clearInterval(hold);
      console.log('classic owner released before shutdown failure');
      throw new Error('fixture cleanup failed');
    });
    await scope.run('startup', () => owner.activate(${JSON.stringify(config)}));
    console.log('classic owner ready');
    await scope.done;
  `])
  try {
    await dev.waitForOutput('classic owner ready', 'classic config acquisition', 10_000)
    const stopping = dev.stop(10_000)
    const failure: unknown = await stopping.catch(error => error)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({
      message: expect.stringContaining('graceful shutdown: exitCode=1, signal=none'),
      cause: { exitCode: 1, stderr: expect.stringContaining('shutdown cleanup failure: fixture cleanup failed') },
    })
    expect((failure as Error).message).toContain('classic owner released before shutdown failure')
    expect(dev.getOutput()).toContain('failed development exit=1')
    await expect(readFile(journal)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(config, 'utf8')).toBe(original)
    expect(dev.stop(10_000)).toBe(stopping)
    await expect(dev.stop(10_000)).rejects.toBe(failure)
    await expect(cleanupTrackedDevProcesses(0)).resolves.toBeUndefined()
  }
  finally {
    await dev.stop(10_000).catch(() => {})
    await rm(project, { recursive: true, force: true })
  }
})
