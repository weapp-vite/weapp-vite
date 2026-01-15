import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from './loadConfig'

const loadConfigFromFileMock = vi.hoisted(() => vi.fn())

vi.mock('vite', () => ({
  loadConfigFromFile: loadConfigFromFileMock,
}))

describe('loadConfig', () => {
  beforeEach(() => {
    loadConfigFromFileMock.mockReset()
  })

  it('prints ESM guidance when config uses CJS globals', async () => {
    loadConfigFromFileMock.mockRejectedValueOnce(new Error('ReferenceError: __dirname is not defined'))

    await expect(loadConfig('vite.config.ts')).rejects.toThrow(
      'vite.config.ts 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。',
    )
  })
})
