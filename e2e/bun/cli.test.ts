import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
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
        if (dev && dev.exitCode === null && dev.signalCode === null) {
          if (devOutput.includes('BUN_RUNTIME ')) {
            await requestBunShutdown(project, devOutput)
          }
          dev.kill('SIGTERM', { forceKillAfterDelay: 5_000 })
          await dev
        }
      }
      finally {
        await writeFile(path.join(report, 'cli.log'), output)
        await rm(project, { recursive: true, force: true })
      }
    }
  }, 150_000)

  it('restores the stateful watcher lease and private config on shutdown', async () => {
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
      await access(path.join(project, '.weapp-vite/ide-asset-watch.json'))
      expect(await readFile(path.join(project, 'project.private.config.json'), 'utf8')).not.toBe(privateConfig)
      await requestBunShutdown(project, output)
      const result = await dev
      expect(result.exitCode, output).toBe(143)
      expect(await readFile(path.join(project, 'cleanup.log'), 'utf8')).toBe('closed\n')
      expect(await readFile(path.join(project, 'project.private.config.json'), 'utf8')).toBe(privateConfig)
      await expect(access(path.join(project, '.weapp-vite/ide-asset-watch.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    }
    finally {
      if (dev.exitCode === null && dev.signalCode === null) {
        if (output.includes('BUN_RUNTIME ')) {
          await requestBunShutdown(project, output)
        }
        dev.kill('SIGTERM', { forceKillAfterDelay: 5_000 })
        await dev
      }
      await mkdir(path.resolve(import.meta.dirname, '../../.tmp/bun-cli'), { recursive: true })
      await writeFile(path.resolve(import.meta.dirname, '../../.tmp/bun-cli/stateful.log'), output)
      await rm(project, { recursive: true, force: true })
    }
  }, 120_000)
})
