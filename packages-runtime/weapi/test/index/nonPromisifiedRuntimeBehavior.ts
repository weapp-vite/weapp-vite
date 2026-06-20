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

    it('uses WeChat FileSystemManager file APIs without touching deprecated wx file methods', async () => {
      const saveFile = vi.fn((options: any) => {
        options.success?.({ errMsg: 'saveFile:ok', savedFilePath: '/saved/demo.txt' })
      })
      const removeSavedFile = vi.fn((options: any) => {
        options.success?.({ errMsg: 'removeSavedFile:ok' })
      })
      const deprecatedSaveFileAccess = vi.fn()
      const deprecatedRemoveSavedFileAccess = vi.fn()
      const adapter: Record<string, any> = {
        getFileSystemManager: vi.fn(() => ({
          removeSavedFile,
          saveFile,
        })),
      }

      Object.defineProperties(adapter, {
        removeSavedFile: {
          get() {
            deprecatedRemoveSavedFileAccess()
            return vi.fn()
          },
        },
        saveFile: {
          get() {
            deprecatedSaveFileAccess()
            return vi.fn()
          },
        },
      })

      const api = createTestWeapi({
        adapter,
        platform: 'wx',
      }) as Record<string, any>

      expect(api.supports('saveFile')).toBe(true)
      expect(api.supports('removeSavedFile')).toBe(true)
      await expect(api.saveFile({ tempFilePath: '/tmp/demo.txt' })).resolves.toMatchObject({
        errMsg: 'saveFile:ok',
        savedFilePath: '/saved/demo.txt',
      })
      await expect(api.removeSavedFile({ filePath: '/saved/demo.txt' })).resolves.toMatchObject({
        errMsg: 'removeSavedFile:ok',
      })
      expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ tempFilePath: '/tmp/demo.txt' }))
      expect(removeSavedFile).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/saved/demo.txt' }))
      expect(deprecatedSaveFileAccess).not.toHaveBeenCalled()
      expect(deprecatedRemoveSavedFileAccess).not.toHaveBeenCalled()
    })
  })
}
