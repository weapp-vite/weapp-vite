import type { HeadlessTestingPageHandle } from '../src/testing'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { createStatefulNativePageFiles } from './helpers/statefulNativePage'

describe('page method target parity', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each([{}, { routeOnly: true }])('preserves the native page receiver and nested methods with %j', async (options) => {
    const project = createBaseFixture()
    directories.push(project)
    fs.writeFileSync(path.join(project, 'dist/pages/index/index.js'), `
Page({
  data: { summary: '', calls: 0 },
  updateSummary(value) {
    this.setData({ summary: value, calls: this.data.calls + 1 })
    return this.data.summary
  },
  refreshLifecycleSummary(value) { return this.updateSummary(value) }
})
`)
    const miniProgram = await launch({ projectPath: project })
    try {
      const page = await miniProgram.reLaunch('/pages/index/index')
      await expect(page.callMethodWithOptions('refreshLifecycleSummary', options, 'finalized')).resolves.toBe('finalized')
      expect(await page.data('summary')).toBe('finalized')
      expect(await page.data('calls')).toBe(1)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('restricts Page protocol calls to the top page while routeOnly awaits the retained page Promise', async () => {
    const project = createBaseFixture()
    directories.push(project)
    fs.writeFileSync(path.join(project, 'dist/pages/index/index.js'), `
Page({
  data: { owner: '', calls: 0 },
  onLoad(query) {
    this.setData({ owner: query.owner || 'initial' })
    this.pending = new Promise(resolve => { this.finish = resolve })
  },
  identify() {
    this.setData({ calls: this.data.calls + 1 })
    return this.data.owner
  },
  waitForNavigation() { return this.pending },
  completeNavigation() { this.finish(this.data.owner) }
})
`)
    const miniProgram = await launch({ projectPath: project })
    try {
      const original = await miniProgram.reLaunch('/pages/index/index?owner=original')
      const top = await miniProgram.navigateTo('/pages/index/index?owner=top')
      await expect(original.callMethodWithOptions('identify', { fallback: false })).rejects.toThrow('page is not on top of page stack')
      expect(await original.data('calls')).toBe(0)
      expect(await top.data('calls')).toBe(0)
      await expect(top.callMethodWithOptions('identify', { fallback: false })).resolves.toBe('top')
      await expect(original.callMethodWithOptions('identify', { routeOnly: true, fallback: false })).resolves.toBe('original')
      await expect(original.callMethod('identify')).resolves.toBe('original')

      let settled = false
      const waiting = original.callMethodWithOptions('waitForNavigation', { routeOnly: true }).then((value) => {
        settled = true
        return value
      })
      await Promise.resolve()
      expect(settled).toBe(false)
      await original.callMethodWithOptions('completeNavigation', { routeOnly: true })
      await expect(waiting).resolves.toBe('original')
      expect((await miniProgram.currentPage())?.pageId).toBe(top.pageId)
      expect(await top.data('calls')).toBe(1)

      await miniProgram.reLaunch('/pages/index/index?owner=replacement')
      await expect(original.callMethodWithOptions('identify', { fallback: false })).rejects.toThrow('page is not on top')
      await expect(original.callMethodWithOptions('identify', { routeOnly: true })).resolves.toBeUndefined()
      expect(await (await miniProgram.currentPage())?.data('calls')).toBe(0)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('binds current native methods to preserved vendor state after HMR and rejects the replaced handle', async () => {
    const project = createBaseFixture()
    directories.push(project)
    for (const [file, source] of createStatefulNativePageFiles()) {
      if (file === 'project.config.json') {
        continue
      }
      const target = path.join(project, 'dist', file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const miniProgram = await launch({ projectPath: project })
    const baseline = 'runtime-vendor-hmr-baseline'
    const updated = 'runtime-vendor-hmr-updated'
    const nativeOptions = { fallback: false }
    const check = async (page: HeadlessTestingPageHandle, mode: string, calls: number, definitionMarker: string, marker = baseline) => {
      await expect(page.callMethodWithOptions('readVendorState', nativeOptions)).resolves.toEqual({ mode, calls, definitionMarker, marker })
      expect(await (await page.$('#mode'))?.text()).toBe(`当前模式 ${mode} 切换模式`)
      expect(await (await page.$('#vendor-marker'))?.text()).toBe(marker)
      expect(await (await page.$('#vendor-calls'))?.text()).toBe(String(calls))
    }
    try {
      const original = await miniProgram.reLaunch('/pages/external/index')
      await check(original, 'light', 0, baseline)
      await original.callMethodWithOptions('switchMode', nativeOptions)
      await check(original, 'dark', 1, baseline)
      await original.callMethodWithOptions('patchPage', nativeOptions)
      const current = (await miniProgram.currentPage())!
      expect(current.pageId).toBe(original.pageId)
      await check(current, 'dark', 1, updated)
      await current.callMethodWithOptions('switchMode', nativeOptions)
      await check(current, 'npm-dark', 2, updated)
      await current.callMethodWithOptions('restorePage', nativeOptions)
      await check(current, 'npm-dark', 2, baseline)
      await current.callMethodWithOptions('switchMode', nativeOptions)
      await check(current, 'light', 3, baseline)
      await current.callMethodWithOptions('patchPage', nativeOptions)
      await check(current, 'light', 3, updated)

      const replacement = await miniProgram.reLaunch('/pages/external/index')
      const fresh = (await miniProgram.currentPage())!
      expect(fresh.pageId).toBe(replacement.pageId)
      expect(fresh.pageId).not.toBe(original.pageId)
      await check(fresh, 'light', 0, updated, updated)
      await expect(current.callMethodWithOptions('switchMode', nativeOptions)).rejects.toThrow('page is not on top of page stack')
      await check(fresh, 'light', 0, updated, updated)
    }
    finally {
      await miniProgram.close()
    }
  })
})
