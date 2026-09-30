import { expect, it, vi } from 'vitest'
import { checkWorkersOptions } from './workers'

const loggerMock = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../../context/shared', () => ({ logger: loggerMock }))
function createMockConfigService() {
  return { weappViteConfig: {} } as any
}

it('checks workers options for plugin and normal targets', () => {
  const configService = createMockConfigService()
  const scanService = { workersDir: 'workers' } as any

  expect(checkWorkersOptions('plugin', configService, scanService)).toEqual({
    hasWorkersDir: false,
    workersDir: undefined,
  })

  expect(checkWorkersOptions('miniapp', configService, { workersDir: undefined } as any)).toEqual({
    hasWorkersDir: false,
    workersDir: undefined,
  })
})

it('throws when workers dir exists but worker.entry is missing', () => {
  const configService = createMockConfigService()
  const scanService = { workersDir: 'workers' } as any

  expect(() => checkWorkersOptions('miniapp', configService, scanService)).toThrow('请在 `vite.config.ts` / `weapp-vite.config.ts` 中设置 `weapp.worker.entry` 路径')
  expect(loggerMock.error).toHaveBeenCalledTimes(2)
})

it('returns workers info when worker.entry is configured', () => {
  const configService = createMockConfigService()
  configService.weappViteConfig.worker = {
    entry: ['index'],
  }
  const scanService = { workersDir: 'workers' } as any

  expect(checkWorkersOptions('miniapp', configService, scanService)).toEqual({
    hasWorkersDir: true,
    workersDir: 'workers',
  })
})
