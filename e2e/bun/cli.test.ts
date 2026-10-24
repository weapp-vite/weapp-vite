import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createBunProject, expectBunOutputs, readBunJavaScript, requestBunShutdown, runBunScript, updateBunPage } from '../utils/bunProject'

describe('Bun CLI / issue #1222', () => {
  it('builds and keeps non-IPC dev alive through an edit and graceful shutdown', async () => {
    const project = await createBunProject()
    const report = path.resolve(import.meta.dirname, '../../.tmp/bun-cli')
    await mkdir(report, { recursive: true })
    let output = ''
    let devOutput = ''
    let dev: ReturnType<typeof runBunScript> | undefined
    try {
      const build = await runBunScript(project, 'build')
      output += build.all || ''
      expect(build.exitCode, output).toBe(0)
      expect(output).toContain('BUN_RUNTIME')
      await expectBunOutputs(project, 'bun-initial')
      await rm(path.join(project, 'dist'), { recursive: true, force: true })
      const privateConfig = await readFile(path.join(project, 'project.private.config.json'), 'utf8')
      dev = runBunScript(project, 'dev')
      dev.all?.on('data', (chunk) => {
        output += String(chunk)
        devOutput += String(chunk)
      })
      let exited = false
      void dev.then(() => exited = true)
      await Promise.race([
        expect.poll(() => devOutput.includes('开发服务已就绪'), { timeout: 90_000 }).toBe(true),
        dev.then((result) => { throw new Error(`Bun dev exited before ready: ${result.exitCode}\n${output}`) }),
      ])
      expect(devOutput).toMatch(/BUN_RUNTIME .*"connected":false,"ipc":false/)
      await expectBunOutputs(project, 'bun-initial')
      await updateBunPage(project)
      await expect.poll(async () => {
        expect(exited, output).toBe(false)
        return readBunJavaScript(project).catch(() => '')
      }, { timeout: 30_000 }).toContain('bun-updated')
      await requestBunShutdown(project, devOutput)
      const result = await dev
      expect(result.exitCode, output).toBe(143)
      expect(await readFile(path.join(project, 'cleanup.log'), 'utf8')).toBe('closed\n')
      expect(await readFile(path.join(project, 'project.private.config.json'), 'utf8')).toBe(privateConfig)
      await expect(access(path.join(project, '.weapp-vite/ide-asset-watch.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expectBunOutputs(project, 'bun-updated')
    }
    finally {
      try {
        if (dev && dev.nodeChildProcess.exitCode === null && dev.nodeChildProcess.signalCode === null) {
          if (devOutput.includes('BUN_RUNTIME ')) {
            await requestBunShutdown(project, devOutput)
          }
          dev.kill('SIGTERM')
          await dev
        }
      }
      finally {
        await writeFile(path.join(report, 'cli.log'), output)
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 150_000)

  it('restores startup classic ownership for an explicit stateful request on shutdown', async () => {
    const project = await createBunProject()
    const privateConfig = await readFile(path.join(project, 'project.private.config.json'), 'utf8')
    const dev = runBunScript(project, 'dev', 'stateful-experimental')
    let output = ''
    dev.all?.on('data', chunk => output += String(chunk))
    try {
      await Promise.race([
        expect.poll(() => output.includes('开发服务已就绪'), { timeout: 90_000 }).toBe(true),
        dev.then((result) => { throw new Error(`Bun dev exited before ready: ${result.exitCode}\n${output}`) }),
      ])
      const ready = output.match(/\[weapp-vite\] HMR classic ready (\{[^\r\n]*\})/g) ?? []
      expect(ready, output).toHaveLength(1)
      expect(JSON.parse(ready[0]!.slice('[weapp-vite] HMR classic ready '.length)) as unknown).toEqual({
        reason: 'ide-classic-handoff',
        requested: 'stateful-experimental',
        actual: 'classic',
        phase: 'classic',
      })
      const lease = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
      const activeConfig = await readFile(path.join(project, 'project.private.config.json'), 'utf8')
      expect(activeConfig).not.toBe(privateConfig)
      expect(JSON.parse(activeConfig) as unknown).toMatchObject({ setting: { compileHotReLoad: false } })
      expect(JSON.parse(await readFile(lease, 'utf8')) as unknown).toEqual({
        owner: expect.any(String),
        original: privateConfig,
        installed: activeConfig,
      })
      const statefulFiles = ['.weapp-vite/ide-asset-watch.json', ...[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE].map(file => `dist/${file}`)]
      for (const file of statefulFiles) {
        await expect(access(path.join(project, file))).rejects.toMatchObject({ code: 'ENOENT' })
      }
      await requestBunShutdown(project, output)
      const result = await dev
      expect(result.exitCode, output).toBe(143)
      expect(await readFile(path.join(project, 'cleanup.log'), 'utf8')).toBe('closed\n')
      expect(await readFile(path.join(project, 'project.private.config.json'), 'utf8')).toBe(privateConfig)
      await expect(access(lease)).rejects.toMatchObject({ code: 'ENOENT' })
      for (const file of statefulFiles) {
        await expect(access(path.join(project, file))).rejects.toMatchObject({ code: 'ENOENT' })
      }
      await expectBunOutputs(project, 'bun-initial')
    }
    finally {
      if (dev.nodeChildProcess.exitCode === null && dev.nodeChildProcess.signalCode === null) {
        if (output.includes('BUN_RUNTIME ')) {
          await requestBunShutdown(project, output)
        }
        dev.kill('SIGTERM')
        await dev
      }
      await mkdir(path.resolve(import.meta.dirname, '../../.tmp/bun-cli'), { recursive: true })
      await writeFile(path.resolve(import.meta.dirname, '../../.tmp/bun-cli/stateful.log'), output)
      await rm(project, { recursive: true, force: true })
    }
  }, 120_000)
})
