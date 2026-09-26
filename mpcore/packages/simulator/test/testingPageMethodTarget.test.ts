import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('page method target parity', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

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
})
