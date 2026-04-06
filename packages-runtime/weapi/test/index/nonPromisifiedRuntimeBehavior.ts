import { createTestWeapi } from '../helpers/createTestWeapi'

/**
 * @description 校验同步句柄类 API 在运行时不会被错误包装成 Promise。
 */
export function registerWeapiIndexNonPromisifiedRuntimeBehaviorTests() {
  describe('weapi non-promisified runtime behavior', () => {
    it('keeps synchronous utility and manager APIs as direct return values', () => {
      const updateManager = {
        onCheckForUpdate: vi.fn(),
        onUpdateReady: vi.fn(),
        onUpdateFailed: vi.fn(),
        applyUpdate: vi.fn(),
      }
      const selectorQuery = {
        in: vi.fn(),
      }
      const logManager = {
        info: vi.fn(),
      }
      const videoContext = {
        play: vi.fn(),
      }

      const api = createTestWeapi({
        adapter: {
          canIUse: vi.fn(() => false),
          getUpdateManager: vi.fn(() => updateManager),
          createSelectorQuery: vi.fn(() => selectorQuery),
          getLogManager: vi.fn(() => logManager),
          createVideoContext: vi.fn(() => videoContext),
        },
        platform: 'wx',
      }) as Record<string, any>

      expect(api.canIUse('getUpdateManager')).toBe(false)
      expect(api.getUpdateManager()).toBe(updateManager)
      expect(api.createSelectorQuery()).toBe(selectorQuery)
      expect(api.getLogManager({ level: 1 })).toBe(logManager)
      expect(api.createVideoContext('demo')).toBe(videoContext)
    })
  })
}
