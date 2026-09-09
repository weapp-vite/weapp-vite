import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('testing navigation diagnostics', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  it.each(['reLaunch', 'navigateTo', 'redirectTo', 'switchTab'] as const)('rejects %s failures even when the old page remains active', async (method) => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const miniProgram = await launch({ projectPath })
    try {
      const initial = await miniProgram.currentPage()
      expect(initial?.path).toBe('pages/index/index')
      await expect(miniProgram[method]('/pages/missing/index')).rejects.toThrow('Unknown route for headless runtime navigation: /pages/missing/index')
      expect((await miniProgram.currentPage())?.path).toBe(initial?.path)
    }
    finally {
      await miniProgram.close()
    }
  })

  it('preserves the original page module exception after reLaunch empties the stack', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.json'), JSON.stringify({ pages: ['pages/index/index', 'pages/broken/index'] }))
    fs.mkdirSync(path.join(projectPath, 'dist/pages/broken'), { recursive: true })
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.js'), 'throw new Error("Missing component dependency: dialog-content")')
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.json'), '{}')
    fs.writeFileSync(path.join(projectPath, 'dist/pages/broken/index.wxml'), '<view>broken page</view>')
    const miniProgram = await launch({ projectPath })
    try {
      await expect(miniProgram.reLaunch('/pages/broken/index')).rejects.toMatchObject({
        message: expect.stringContaining('Missing component dependency: dialog-content'),
        cause: { message: 'Missing component dependency: dialog-content' },
      })
      expect(await miniProgram.currentPage()).toBeNull()
    }
    finally {
      await miniProgram.close()
    }
  })

  it('retains the standard errMsg object from a failing navigation callback', async () => {
    const projectPath = createBaseFixture()
    directories.push(projectPath)
    const miniProgram = await launch({ projectPath })
    try {
      await miniProgram.evaluate(() => {
        const runtime = globalThis as typeof globalThis & { wx: { navigateBack: (options: { fail: (error: { errMsg: string }) => void }) => void } }
        runtime.wx.navigateBack = options => options.fail({ errMsg: 'navigateBack:fail denied by guard' })
      })
      await expect(miniProgram.navigateBack()).rejects.toMatchObject({
        message: expect.stringContaining('navigateBack:fail denied by guard'),
        cause: { errMsg: 'navigateBack:fail denied by guard' },
      })
    }
    finally {
      await miniProgram.close()
    }
  })
})
