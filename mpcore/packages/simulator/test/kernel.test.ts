import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryArtifactSource,
  createOverlayArtifactSource,
  RuntimeKernel,
} from '../src/kernel'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('runtime kernel', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    vi.useRealTimers()
    cleanupTempDirs(tempDirs)
  })

  it('reads overlay artifacts before the compiled fallback', () => {
    const filePath = path.resolve('/artifact/pages/index/index.wxml')
    const fallback = createMemoryArtifactSource([[filePath, '<view>fallback</view>']])
    const overlay = createMemoryArtifactSource([[filePath, '<view>overlay</view>']])
    const source = createOverlayArtifactSource(overlay, fallback)

    expect(source.has(filePath)).toBe(true)
    expect(source.readText(filePath)).toBe('<view>overlay</view>')
  })

  it('records scheduled exceptions and clears pending work on close', async () => {
    vi.useFakeTimers()
    const kernel = new RuntimeKernel()
    const callback = vi.fn()
    kernel.scheduler.setTimeout(callback, 20)
    kernel.scheduler.setTimeout(() => {
      throw new Error('timer failed')
    }, 10)

    await vi.advanceTimersByTimeAsync(10)
    expect(kernel.diagnostics.getEntries()).toEqual([
      expect.objectContaining({
        args: [expect.objectContaining({ message: 'timer failed' })],
        level: 'exception',
      }),
    ])

    kernel.scheduler.queueMicrotask(callback)
    kernel.close()
    await vi.runAllTimersAsync()
    expect(callback).not.toHaveBeenCalled()
    expect(() => kernel.assertActive()).toThrow('closed')
  })

  it('invalidates page and node handles after session close', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })
    const page = await miniProgram.reLaunch('/pages/index/index')
    const node = await page.$('#greeting-button')

    await miniProgram.close()

    expect(() => page.path).toThrow('closed')
    await expect(node?.text()).rejects.toThrow('closed')
  })
})
