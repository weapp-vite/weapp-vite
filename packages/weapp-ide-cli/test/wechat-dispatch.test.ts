import { beforeEach, describe, expect, it, vi } from 'vitest'

const autoPreviewWechatIdeMock = vi.hoisted(() => vi.fn())
const buildWechatIdeNpmMock = vi.hoisted(() => vi.fn())
const clearWechatIdeCacheMock = vi.hoisted(() => vi.fn())
const closeWechatIdeProjectMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoggedInMock = vi.hoisted(() => vi.fn())
const loginWechatIdeMock = vi.hoisted(() => vi.fn())
const openWechatIdeOtherProjectMock = vi.hoisted(() => vi.fn())
const previewWechatIdeMock = vi.hoisted(() => vi.fn())
const quitWechatIdeMock = vi.hoisted(() => vi.fn())
const uploadWechatIdeMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/wechat-commands', () => ({
  autoPreviewWechatIde: autoPreviewWechatIdeMock,
  buildWechatIdeNpm: buildWechatIdeNpmMock,
  clearWechatIdeCache: clearWechatIdeCacheMock,
  closeWechatIdeProject: closeWechatIdeProjectMock,
  isWechatIdeLoggedIn: isWechatIdeLoggedInMock,
  loginWechatIde: loginWechatIdeMock,
  openWechatIdeOtherProject: openWechatIdeOtherProjectMock,
  previewWechatIde: previewWechatIdeMock,
  quitWechatIde: quitWechatIdeMock,
  uploadWechatIde: uploadWechatIdeMock,
}))

describe('dispatchWechatCliCommand', () => {
  beforeEach(() => {
    vi.resetModules()
    autoPreviewWechatIdeMock.mockReset()
    buildWechatIdeNpmMock.mockReset()
    clearWechatIdeCacheMock.mockReset()
    closeWechatIdeProjectMock.mockReset()
    isWechatIdeLoggedInMock.mockReset()
    loginWechatIdeMock.mockReset()
    openWechatIdeOtherProjectMock.mockReset()
    previewWechatIdeMock.mockReset()
    quitWechatIdeMock.mockReset()
    uploadWechatIdeMock.mockReset()
    autoPreviewWechatIdeMock.mockResolvedValue(undefined)
    buildWechatIdeNpmMock.mockResolvedValue(undefined)
    clearWechatIdeCacheMock.mockResolvedValue(undefined)
    closeWechatIdeProjectMock.mockResolvedValue(undefined)
    isWechatIdeLoggedInMock.mockResolvedValue(undefined)
    loginWechatIdeMock.mockResolvedValue(undefined)
    openWechatIdeOtherProjectMock.mockResolvedValue(undefined)
    previewWechatIdeMock.mockResolvedValue(undefined)
    quitWechatIdeMock.mockResolvedValue(undefined)
    uploadWechatIdeMock.mockResolvedValue(undefined)
  })

  it('dispatches preview argv to preview helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'preview',
      '--project',
      '/tmp/demo',
      '--qr-format',
      'image',
      '--qr-output',
      '/tmp/qr.png',
    ])

    expect(handled).toBe(true)
    expect(previewWechatIdeMock).toHaveBeenCalledWith({
      appid: undefined,
      compileCondition: undefined,
      extAppid: undefined,
      infoOutput: undefined,
      projectPath: '/tmp/demo',
      qrFormat: 'image',
      qrOutput: '/tmp/qr.png',
      qrSize: undefined,
    })
  })

  it('dispatches upload argv to upload helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'upload',
      '--project',
      '/tmp/demo',
      '--version',
      '1.0.0',
      '--desc',
      'release',
    ])

    expect(handled).toBe(true)
    expect(uploadWechatIdeMock).toHaveBeenCalledWith({
      appid: undefined,
      desc: 'release',
      extAppid: undefined,
      infoOutput: undefined,
      projectPath: '/tmp/demo',
      version: '1.0.0',
    })
  })

  it('dispatches cache argv to cache helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand(['cache', '--clean', 'all'])

    expect(handled).toBe(true)
    expect(clearWechatIdeCacheMock).toHaveBeenCalledWith({ clean: 'all' })
  })

  it('returns false when upload argv misses required fields', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand(['upload', '--project', '/tmp/demo'])

    expect(handled).toBe(false)
    expect(uploadWechatIdeMock).not.toHaveBeenCalled()
  })
})
