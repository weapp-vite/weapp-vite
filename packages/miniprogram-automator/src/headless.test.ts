import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import Launcher from './Launcher'
import { OperationLifecycle } from './operation'

describe('headless automator lifecycle contract', () => {
  const directories: string[] = []
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })

  function createProject() {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'automator-headless-'))
    directories.push(projectPath)
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

  it('exposes synchronous idempotent disconnect without closing another project', async () => {
    const launcher = new Launcher()
    const first = await launcher.launch({ projectPath: createProject(), runtimeProvider: 'headless' })
    const second = await launcher.launch({ projectPath: createProject(), runtimeProvider: 'headless' })
    try {
      expect(first.disconnect()).toBeUndefined()
      first.disconnect()
      await first.close()
      await expect(first.currentPage()).rejects.toThrow(/closed/i)
      const page = await second.reLaunch('/pages/detail/index')
      expect(await (await page.$('#title')).text()).toBe('detail')
      await second.close()
      expect(second.disconnect()).toBeUndefined()
    }
    finally {
      await first.close()
      await second.close()
    }
  })

  it('releases a real late launch result through the operation disposer', async () => {
    const lifecycle = new OperationLifecycle(10_000, 'headless launch')
    const reason = new Error('caller canceled launch')
    let program: Awaited<ReturnType<Launcher['launch']>>
    const result = lifecycle.run(scope => scope.step(async () => {
      program = await new Launcher().launch({ projectPath: createProject(), runtimeProvider: 'headless' })
      lifecycle.controller.abort(reason)
      return program
    }, { disposeLate: session => session.disconnect(), waitForExit: true }))
    try {
      await expect(result).rejects.toBe(reason)
      await expect(program.currentPage()).rejects.toThrow(/closed/i)
    }
    finally {
      await program?.close()
    }
  })
})
