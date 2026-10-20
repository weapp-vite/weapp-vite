import type { HeadlessSession } from '../src/runtime'
import type { HeadlessTestingSessionHandle } from '../src/testing'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { launch } from '../src/testing'
import { configReloadReadyLifecycle, configReloadRoute, configReloadTitles, createConfigReloadAppJson, createConfigReloadFiles } from './helpers/configReload'

it('replaces App and Page after each explicit config reload while preserving another testing session', async () => {
  const directories: string[] = []
  const handles: HeadlessTestingSessionHandle[] = []
  function createProject() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'config-reload-'))
    directories.push(directory)
    for (const [relative, source] of createConfigReloadFiles()) {
      const file = path.join(directory, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, source)
    }
    return directory
  }
  async function start(projectPath: string) {
    let runtime: HeadlessSession | undefined
    const handle = await launch({
      projectPath,
      configureSession(session) { runtime = session },
    })
    handles.push(handle)
    const page = (await handle.currentPage())!
    await expect.poll(() => page.data('ready')).toBe(true)
    return { handle, page, pageId: page.pageId, runtime: runtime!, app: runtime!.getApp()!, rawPage: runtime!.getCurrentPages()[0]! }
  }

  try {
    const project = createProject()
    const survivor = await start(createProject())
    const survivorButton = (await survivor.page.$('#increment'))!
    survivor.app.__e2eHmrInstanceMarker = 'survivor-app'
    survivor.rawPage.__e2eHmrInstanceMarker = 'survivor-page'
    await survivorButton.tap()
    let previous: Awaited<ReturnType<typeof start>> | undefined
    for (const [index, title] of configReloadTitles.entries()) {
      if (previous) {
        // 产物保存不等于运行态重载；明确关闭旧容器后才从新配置启动。
        fs.writeFileSync(path.join(project, 'app.json'), createConfigReloadAppJson(title))
        expect(previous.runtime.getCurrentPageNavigationBarTitle()).toBe(configReloadTitles[index - 1])
        expect(await previous.page.data('count')).toBe(1)
        const oldButton = (await previous.page.$('#increment'))!
        await previous.handle.close()
        await previous.handle.close()
        expect(previous.runtime.isClosed).toBe(true)
        expect(previous.app.globalData.lifecycle).toEqual([...configReloadReadyLifecycle, 'page:unload'])
        await expect(oldButton.text()).rejects.toThrow(/closed/i)
      }
      const current = await start(project)
      const pageId = current.page.pageId
      expect(current.page.path).toBe(configReloadRoute.slice(1))
      expect(current.app.globalData.lifecycle).toEqual(configReloadReadyLifecycle)
      expect(current.runtime.getCurrentPageNavigationBarTitle()).toBe(title)
      expect(await (await current.page.$('#title'))!.text()).toBe(title)
      expect(await (await current.page.$('#ready'))!.text()).toBe('true')
      expect(await (await current.page.$('#increment'))!.text()).toBe('0')
      expect(current.app.__e2eHmrInstanceMarker).toBeUndefined()
      expect(current.rawPage.__e2eHmrInstanceMarker).toBeUndefined()
      if (previous) {
        expect(current.app).not.toBe(previous.app)
        expect(current.rawPage).not.toBe(previous.rawPage)
        expect(pageId).not.toBe(previous.pageId)
        await expect(previous.handle.currentPage()).rejects.toThrow(/closed/i)
        await expect(previous.page.data()).rejects.toThrow(/closed/i)
        await expect(previous.page.callMethod('increment')).rejects.toThrow(/closed/i)
      }
      current.app.__e2eHmrInstanceMarker = `app-${index}`
      current.rawPage.__e2eHmrInstanceMarker = `page-${index}`
      await (await current.page.$('#increment'))!.tap()
      expect(await current.page.data('count')).toBe(1)
      expect(current.page.pageId).toBe(pageId)
      expect(current.runtime.getApp()).toBe(current.app)
      expect(current.runtime.getCurrentPages()).toEqual([current.rawPage])

      expect(survivor.runtime.getApp()).toBe(survivor.app)
      expect(survivor.runtime.getCurrentPages()).toEqual([survivor.rawPage])
      expect(survivor.app.__e2eHmrInstanceMarker).toBe('survivor-app')
      expect(survivor.rawPage.__e2eHmrInstanceMarker).toBe('survivor-page')
      expect(survivor.app.globalData.lifecycle).toEqual(configReloadReadyLifecycle)
      expect(survivor.runtime.getCurrentPageNavigationBarTitle()).toBe(configReloadTitles[0])
      expect(await (await survivor.page.$('#increment'))!.text()).toBe(String(index + 1))
      await survivorButton.tap()
      expect(await survivor.page.data('count')).toBe(index + 2)
      expect(await (await survivor.page.$('#increment'))!.text()).toBe(String(index + 2))
      expect(current.runtime.getDiagnostics()).toEqual([])
      previous = current
    }
    for (const [relative, source] of createConfigReloadFiles()) {
      expect(fs.readFileSync(path.join(project, relative), 'utf8')).toBe(source)
    }
  }
  finally {
    await Promise.all(handles.map(handle => handle.close()))
    for (const directory of directories) {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
})
