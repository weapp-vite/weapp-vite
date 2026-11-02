import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Launcher from './Launcher'
import { OperationLifecycle } from './operation'

type HeadlessProgram = Awaited<ReturnType<(typeof import('./headless'))['launchHeadlessAutomator']>>

function createHeadlessTestResources() {
  const directories = new Set<string>()
  const programs = new Set<HeadlessProgram>()

  function createProject() {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'automator-headless-'))
    directories.add(projectPath)
    const files: Record<string, string> = {
      'project.config.json': JSON.stringify({ appid: 'wx123', miniprogramRoot: 'dist' }),
      'dist/app.json': JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] }),
      'dist/app.js': 'App({})',
    }
    for (const route of ['index', 'detail']) {
      files[`dist/pages/${route}/index.js`] = `Page({ data: { title: '${route}' } })`
      files[`dist/pages/${route}/index.json`] = '{}'
      files[`dist/pages/${route}/index.wxml`] = '<view id="title">{{title}}</view>'
    }
    for (const [name, source] of Object.entries(files)) {
      const filename = path.join(projectPath, name)
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      fs.writeFileSync(filename, source)
    }
    return projectPath
  }

  return {
    createProject,
    async launch(launcher = new Launcher(), projectPath = createProject()) {
      const program: HeadlessProgram = await launcher.launch({ projectPath, runtimeProvider: 'headless' })
      programs.add(program)
      return program
    },
    async close() {
      const closed = await Promise.allSettled([...programs].map(async (program) => {
        await program.close()
        programs.delete(program)
      }))
      const closeErrors = closed.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
      if (closeErrors.length) {
        throw new AggregateError(closeErrors, 'Headless test session cleanup failed; fixture directories retained')
      }
      const removed = await Promise.allSettled([...directories].map(async (directory) => {
        await fs.promises.rm(directory, { recursive: true, force: true })
        directories.delete(directory)
      }))
      const removeErrors = removed.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
      if (removeErrors.length) {
        throw new AggregateError(removeErrors, 'Headless test fixture cleanup failed')
      }
    },
  }
}

describe('headless automator lifecycle contract', () => {
  const resources = createHeadlessTestResources()
  beforeAll(async () => {
    // 冷加载 simulator 源码属于套件准备，不占用生命周期断言的默认五秒预算。
    await import('../../../mpcore/packages/simulator/src/testing/launch')
  }, 30_000)
  afterEach(async () => {
    try {
      await resources.close()
    }
    finally {
      vi.restoreAllMocks()
    }
  })

  it('starts disconnect synchronously and shares its completion without closing another project', async () => {
    const launcher = new Launcher()
    const first = await resources.launch(launcher)
    const second = await resources.launch(launcher)
    const pending = first.disconnect()
    expect(pending).toBeInstanceOf(Promise)
    expect(first.disconnect()).toBe(pending)
    await expect(first.currentPage()).rejects.toThrow(/closed/i)
    await pending
    await first.close()
    const page = await second.reLaunch('/pages/detail/index')
    expect(await (await page.$('#title'))?.text()).toBe('detail')
    await second.close()
    await expect(second.disconnect()).resolves.toBeUndefined()
  })

  it('closes the first session before removing fixtures when the second launch fails', async () => {
    const firstProject = resources.createProject()
    const secondProject = resources.createProject()
    const first = await resources.launch(new Launcher(), firstProject)
    const closeFirst = first.close.bind(first)
    const close = vi.spyOn(first, 'close').mockImplementation(async () => {
      expect(fs.existsSync(firstProject)).toBe(true)
      expect(fs.existsSync(secondProject)).toBe(true)
      await closeFirst()
    })
    fs.writeFileSync(path.join(secondProject, 'dist/app.js'), 'throw new Error("second launch failed")')

    await expect(resources.launch(new Launcher(), secondProject)).rejects.toThrow('second launch failed')
    await resources.close()

    expect(close).toHaveBeenCalledOnce()
    await expect(first.currentPage()).rejects.toThrow(/closed/i)
    expect(fs.existsSync(firstProject)).toBe(false)
    expect(fs.existsSync(secondProject)).toBe(false)
  })

  it('attempts every session close and retains fixtures when cleanup fails', async () => {
    const firstProject = resources.createProject()
    const secondProject = resources.createProject()
    const first = await resources.launch(new Launcher(), firstProject)
    const second = await resources.launch(new Launcher(), secondProject)
    const failure = new Error('session cleanup failed')
    const closeFirst = vi.spyOn(first, 'close').mockRejectedValueOnce(failure)
    const closeSecond = vi.spyOn(second, 'close')

    await expect(resources.close()).rejects.toMatchObject({ errors: [failure] })

    expect(closeFirst).toHaveBeenCalledOnce()
    expect(closeSecond).toHaveBeenCalledOnce()
    await expect(second.currentPage()).rejects.toThrow(/closed/i)
    expect(fs.existsSync(firstProject)).toBe(true)
    expect(fs.existsSync(secondProject)).toBe(true)
    await resources.close()
    expect(closeFirst).toHaveBeenCalledTimes(2)
    expect(closeSecond).toHaveBeenCalledOnce()
    expect(fs.existsSync(firstProject)).toBe(false)
    expect(fs.existsSync(secondProject)).toBe(false)
  })

  it('releases a real late launch result through the operation disposer', async () => {
    const lifecycle = new OperationLifecycle(10_000, 'headless launch')
    const reason = new Error('caller canceled launch')
    let program: HeadlessProgram | undefined
    const result = lifecycle.run(scope => scope.step(async () => {
      program = await resources.launch()
      lifecycle.controller.abort(reason)
      return program
    }, { disposeLate: session => session.disconnect(), waitForExit: true }))
    await expect(result).rejects.toBe(reason)
    expect(program).toBeDefined()
    await expect(program!.currentPage()).rejects.toThrow(/closed/i)
  })
})
