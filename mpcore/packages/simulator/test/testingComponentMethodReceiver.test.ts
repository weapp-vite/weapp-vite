import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs } from './helpers'
import { componentMethodReceiverFiles } from './helpers/componentMethodReceiver'

describe('testing bridge component method receivers', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  async function createSession() {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-method-receiver-'))
    directories.push(projectPath)
    for (const [file, source] of componentMethodReceiverFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return await launch({ projectPath })
  }

  it('calls the selected component handle once with its updated state and renders its result in isolation', async () => {
    const miniProgram = await createSession()
    try {
      const page = await miniProgram.currentPage()
      const first = await page!.selectComponent('#first')
      const second = await page!.selectComponent('#second')
      expect(first).not.toBeNull()
      expect(second).not.toBeNull()
      expect(first!.scopeId).not.toBe(second!.scopeId)

      await first!.callMethod('setData', { label: 'component-updated' })
      await expect(first!.callMethod('mark', 'component-method')).resolves.toBe('component:component-method')
      await expect(first!.snapshot()).resolves.toMatchObject({
        data: { label: 'component-method', previousLabel: 'component-updated', calls: 1 },
      })
      await expect(second!.snapshot()).resolves.toMatchObject({
        data: { label: 'component-initial', previousLabel: '', calls: 0 },
      })
      expect(await (await (await page!.$('#first'))!.$('.component-label'))?.text()).toBe('component-method')
      expect(await (await (await page!.$('#second'))!.$('.component-label'))?.text()).toBe('component-initial')
      expect((await page!.selectComponent('#first'))?.scopeId).toBe(first!.scopeId)
      expect((await page!.selectComponent('#second'))?.scopeId).toBe(second!.scopeId)
    }
    finally {
      await miniProgram.close()
    }
  })

  it.each(['sync', 'async'] as const)('propagates a %s component handle error after exactly one state mutation', async (failureMode) => {
    const miniProgram = await createSession()
    try {
      const page = await miniProgram.currentPage()
      const first = await page!.selectComponent('#first')
      const second = await page!.selectComponent('#second')
      const method = failureMode === 'sync' ? 'fail' : 'failAsync'
      const message = failureMode === 'sync' ? 'component-method-failed' : 'component-method-failed-async'
      await expect(first!.callMethod(method)).rejects.toThrow(message)
      await expect(first!.snapshot()).resolves.toMatchObject({
        data: {
          label: 'component-initial',
          syncFailures: failureMode === 'sync' ? 1 : 0,
          asyncFailures: failureMode === 'async' ? 1 : 0,
        },
      })
      await expect(second!.snapshot()).resolves.toMatchObject({
        data: { label: 'component-initial', syncFailures: 0, asyncFailures: 0 },
      })
    }
    finally {
      await miniProgram.close()
    }
  })

  it('keeps undefined results and awaits fulfilled component promises without repeating their mutations', async () => {
    const miniProgram = await createSession()
    try {
      const page = await miniProgram.currentPage()
      const first = await page!.selectComponent('#first')
      const second = await page!.selectComponent('#second')

      await expect(first!.callMethod('completeWithoutValue')).resolves.toBeUndefined()
      await expect(first!.snapshot()).resolves.toMatchObject({
        data: { label: 'undefined-method', undefinedCalls: 1, asyncCalls: 0 },
      })
      await expect(first!.callMethod('completeAsync', 'async-method')).resolves.toEqual({ label: 'async-method', calls: 1 })
      await expect(first!.snapshot()).resolves.toMatchObject({
        data: { label: 'async-method', undefinedCalls: 1, asyncCalls: 1 },
      })
      await expect(second!.snapshot()).resolves.toMatchObject({
        data: { label: 'component-initial', undefinedCalls: 0, asyncCalls: 0 },
      })
      expect(await (await (await page!.$('#first'))!.$('.component-label'))?.text()).toBe('async-method')
      expect(await (await (await page!.$('#second'))!.$('.component-label'))?.text()).toBe('component-initial')
    }
    finally {
      await miniProgram.close()
    }
  })
})
