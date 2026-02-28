import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCwd = '/workspace/project'

// Mock dependencies
const launchAutomatorMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}))

vi.mock('../src/cli/automator', () => ({
  launchAutomator: launchAutomatorMock,
  isAutomatorLoginError: vi.fn(() => false),
  isDevtoolsHttpPortError: vi.fn(() => false),
  formatAutomatorLoginError: vi.fn(),
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
  colors: {
    cyan: (value: string) => value,
  },
}))

async function loadCommands() {
  return import('../src/cli/commands')
}

describe('automator commands', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)
    launchAutomatorMock.mockReset()
    loggerMock.info.mockReset()
    loggerMock.error.mockReset()
    loggerMock.success.mockReset()
  })

  afterEach(() => {
    cwdSpy.mockRestore()
  })

  describe('navigation commands', () => {
    const mockMiniProgram = {
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
      navigateBack: vi.fn(),
      reLaunch: vi.fn(),
      switchTab: vi.fn(),
      close: vi.fn(),
    }

    beforeEach(() => {
      mockMiniProgram.navigateTo.mockReset()
      mockMiniProgram.redirectTo.mockReset()
      mockMiniProgram.navigateBack.mockReset()
      mockMiniProgram.reLaunch.mockReset()
      mockMiniProgram.switchTab.mockReset()
      mockMiniProgram.close.mockReset()
      launchAutomatorMock.mockResolvedValue(mockMiniProgram)
    })

    it('navigateTo calls miniProgram.navigateTo with url', async () => {
      const { navigateTo } = await loadCommands()

      await navigateTo({ projectPath: mockCwd, url: 'pages/detail/detail' })

      expect(mockMiniProgram.navigateTo).toHaveBeenCalledWith('pages/detail/detail')
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('redirectTo calls miniProgram.redirectTo with url', async () => {
      const { redirectTo } = await loadCommands()

      await redirectTo({ projectPath: mockCwd, url: 'pages/login/login' })

      expect(mockMiniProgram.redirectTo).toHaveBeenCalledWith('pages/login/login')
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('navigateBack calls miniProgram.navigateBack', async () => {
      const { navigateBack } = await loadCommands()

      await navigateBack({ projectPath: mockCwd })

      expect(mockMiniProgram.navigateBack).toHaveBeenCalled()
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('reLaunch calls miniProgram.reLaunch with url', async () => {
      const { reLaunch } = await loadCommands()

      await reLaunch({ projectPath: mockCwd, url: 'pages/index/index' })

      expect(mockMiniProgram.reLaunch).toHaveBeenCalledWith('pages/index/index')
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('switchTab calls miniProgram.switchTab with url', async () => {
      const { switchTab } = await loadCommands()

      await switchTab({ projectPath: mockCwd, url: 'pages/home/home' })

      expect(mockMiniProgram.switchTab).toHaveBeenCalledWith('pages/home/home')
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('closes miniProgram even on error', async () => {
      const { navigateTo } = await loadCommands()
      mockMiniProgram.navigateTo.mockRejectedValue(new Error('Navigation failed'))

      await expect(navigateTo({ projectPath: mockCwd, url: 'pages/test/test' })).rejects.toThrow('Navigation failed')

      expect(mockMiniProgram.close).toHaveBeenCalled()
    })
  })

  describe('page info commands', () => {
    const mockPage = {
      path: 'pages/index/index',
      query: { id: '123' },
      data: vi.fn(),
    }

    const mockMiniProgram = {
      currentPage: vi.fn(),
      pageStack: vi.fn(),
      systemInfo: vi.fn(),
      close: vi.fn(),
    }

    beforeEach(() => {
      mockPage.data.mockReset()
      mockMiniProgram.currentPage.mockReset()
      mockMiniProgram.pageStack.mockReset()
      mockMiniProgram.systemInfo.mockReset()
      mockMiniProgram.close.mockReset()
      launchAutomatorMock.mockResolvedValue(mockMiniProgram)
    })

    it('pageStack returns page stack info', async () => {
      const { pageStack } = await loadCommands()
      mockMiniProgram.pageStack.mockResolvedValue([mockPage])

      const result = await pageStack({ projectPath: mockCwd })

      expect(result).toEqual([{ path: 'pages/index/index', query: { id: '123' } }])
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('currentPage returns current page info', async () => {
      const { currentPage } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)

      const result = await currentPage({ projectPath: mockCwd })

      expect(result).toEqual({ path: 'pages/index/index', query: { id: '123' } })
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('systemInfo returns system info', async () => {
      const { systemInfo } = await loadCommands()
      const systemInfoData = { brand: 'devtools', model: 'iPhone 12', SDKVersion: '3.7.12' }
      mockMiniProgram.systemInfo.mockResolvedValue(systemInfoData)

      const result = await systemInfo({ projectPath: mockCwd })

      expect(result).toEqual(systemInfoData)
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('pageData returns page data', async () => {
      const { pageData } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)
      mockPage.data.mockResolvedValue({ count: 1, name: 'test' })

      await pageData({ projectPath: mockCwd })

      expect(mockPage.data).toHaveBeenCalled()
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('pageData passes path argument to data()', async () => {
      const { pageData } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)
      mockPage.data.mockResolvedValue('test value')

      await pageData({ projectPath: mockCwd, path: 'userInfo.name' })

      expect(mockPage.data).toHaveBeenCalledWith('userInfo.name')
    })
  })

  describe('interaction commands', () => {
    const mockElement = {
      tap: vi.fn(),
      input: vi.fn(),
    }

    const mockPage = {
      $: vi.fn(),
    }

    const mockMiniProgram = {
      currentPage: vi.fn(),
      pageScrollTo: vi.fn(),
      close: vi.fn(),
    }

    beforeEach(() => {
      mockElement.tap.mockReset()
      mockElement.input.mockReset()
      mockPage.$.mockReset()
      mockMiniProgram.currentPage.mockReset()
      mockMiniProgram.pageScrollTo.mockReset()
      mockMiniProgram.close.mockReset()
      launchAutomatorMock.mockResolvedValue(mockMiniProgram)
    })

    it('tap calls element.tap()', async () => {
      const { tap } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)
      mockPage.$.mockResolvedValue(mockElement)

      await tap({ projectPath: mockCwd, selector: '.submit-btn' })

      expect(mockPage.$).toHaveBeenCalledWith('.submit-btn')
      expect(mockElement.tap).toHaveBeenCalled()
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('tap throws error when element not found', async () => {
      const { tap } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)
      mockPage.$.mockResolvedValue(null)

      await expect(tap({ projectPath: mockCwd, selector: '.not-exist' })).rejects.toThrow('未找到元素: .not-exist')

      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('input calls element.input() with value', async () => {
      const { input } = await loadCommands()
      mockMiniProgram.currentPage.mockResolvedValue(mockPage)
      mockPage.$.mockResolvedValue(mockElement)

      await input({ projectPath: mockCwd, selector: '.input-field', value: 'Hello World' })

      expect(mockPage.$).toHaveBeenCalledWith('.input-field')
      expect(mockElement.input).toHaveBeenCalledWith('Hello World')
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('scrollTo calls miniProgram.pageScrollTo()', async () => {
      const { scrollTo } = await loadCommands()

      await scrollTo({ projectPath: mockCwd, scrollTop: 500 })

      expect(mockMiniProgram.pageScrollTo).toHaveBeenCalledWith(500)
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })
  })

  describe('audit and remote commands', () => {
    const mockMiniProgram = {
      stopAudits: vi.fn(),
      remote: vi.fn(),
      close: vi.fn(),
    }

    beforeEach(() => {
      mockMiniProgram.stopAudits.mockReset()
      mockMiniProgram.remote.mockReset()
      mockMiniProgram.close.mockReset()
      launchAutomatorMock.mockResolvedValue(mockMiniProgram)
    })

    it('audit calls stopAudits and returns result', async () => {
      const { audit } = await loadCommands()
      mockMiniProgram.stopAudits.mockResolvedValue({ score: 100, issues: [] })

      const result = await audit({ projectPath: mockCwd })

      expect(mockMiniProgram.stopAudits).toHaveBeenCalled()
      expect(result).toEqual({ score: 100, issues: [] })
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('remote enables remote debugging by default', async () => {
      const { remote } = await loadCommands()

      await remote({ projectPath: mockCwd })

      expect(mockMiniProgram.remote).toHaveBeenCalledWith(true)
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })

    it('remote disables remote debugging with enable: false', async () => {
      const { remote } = await loadCommands()

      await remote({ projectPath: mockCwd, enable: false })

      expect(mockMiniProgram.remote).toHaveBeenCalledWith(false)
      expect(mockMiniProgram.close).toHaveBeenCalled()
    })
  })
})
