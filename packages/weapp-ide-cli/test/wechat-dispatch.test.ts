import { beforeEach, describe, expect, it, vi } from 'vitest'

const autoPreviewWechatIdeMock = vi.hoisted(() => vi.fn())
const autoReplayWechatIdeMock = vi.hoisted(() => vi.fn())
const autoWechatIdeMock = vi.hoisted(() => vi.fn())
const buildWechatIdeApkMock = vi.hoisted(() => vi.fn())
const buildWechatIdeIpaMock = vi.hoisted(() => vi.fn())
const buildWechatIdeNpmMock = vi.hoisted(() => vi.fn())
const clearWechatIdeCacheMock = vi.hoisted(() => vi.fn())
const closeWechatIdeProjectMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoggedInMock = vi.hoisted(() => vi.fn())
const loginWechatIdeMock = vi.hoisted(() => vi.fn())
const openWechatIdeMock = vi.hoisted(() => vi.fn())
const openWechatIdeOtherProjectMock = vi.hoisted(() => vi.fn())
const previewWechatIdeMock = vi.hoisted(() => vi.fn())
const quitWechatIdeMock = vi.hoisted(() => vi.fn())
const resetWechatIdeFileUtilsMock = vi.hoisted(() => vi.fn())
const runWechatIdeEngineBuildMock = vi.hoisted(() => vi.fn())
const uploadWechatIdeMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/engine', () => ({
  runWechatIdeEngineBuild: runWechatIdeEngineBuildMock,
}))

vi.mock('../src/cli/wechat-commands', () => ({
  autoReplayWechatIde: autoReplayWechatIdeMock,
  autoWechatIde: autoWechatIdeMock,
  autoPreviewWechatIde: autoPreviewWechatIdeMock,
  buildWechatIdeApk: buildWechatIdeApkMock,
  buildWechatIdeIpa: buildWechatIdeIpaMock,
  buildWechatIdeNpm: buildWechatIdeNpmMock,
  clearWechatIdeCache: clearWechatIdeCacheMock,
  closeWechatIdeProject: closeWechatIdeProjectMock,
  isWechatIdeLoggedIn: isWechatIdeLoggedInMock,
  loginWechatIde: loginWechatIdeMock,
  openWechatIde: openWechatIdeMock,
  openWechatIdeOtherProject: openWechatIdeOtherProjectMock,
  previewWechatIde: previewWechatIdeMock,
  quitWechatIde: quitWechatIdeMock,
  resetWechatIdeFileUtils: resetWechatIdeFileUtilsMock,
  uploadWechatIde: uploadWechatIdeMock,
}))

describe('dispatchWechatCliCommand', () => {
  beforeEach(() => {
    vi.resetModules()
    autoReplayWechatIdeMock.mockReset()
    autoWechatIdeMock.mockReset()
    autoPreviewWechatIdeMock.mockReset()
    buildWechatIdeApkMock.mockReset()
    buildWechatIdeIpaMock.mockReset()
    buildWechatIdeNpmMock.mockReset()
    clearWechatIdeCacheMock.mockReset()
    closeWechatIdeProjectMock.mockReset()
    isWechatIdeLoggedInMock.mockReset()
    loginWechatIdeMock.mockReset()
    openWechatIdeMock.mockReset()
    openWechatIdeOtherProjectMock.mockReset()
    previewWechatIdeMock.mockReset()
    quitWechatIdeMock.mockReset()
    resetWechatIdeFileUtilsMock.mockReset()
    runWechatIdeEngineBuildMock.mockReset()
    uploadWechatIdeMock.mockReset()
    autoReplayWechatIdeMock.mockResolvedValue(undefined)
    autoWechatIdeMock.mockResolvedValue(undefined)
    autoPreviewWechatIdeMock.mockResolvedValue(undefined)
    buildWechatIdeApkMock.mockResolvedValue(undefined)
    buildWechatIdeIpaMock.mockResolvedValue(undefined)
    buildWechatIdeNpmMock.mockResolvedValue(undefined)
    clearWechatIdeCacheMock.mockResolvedValue(undefined)
    closeWechatIdeProjectMock.mockResolvedValue(undefined)
    isWechatIdeLoggedInMock.mockResolvedValue(undefined)
    loginWechatIdeMock.mockResolvedValue(undefined)
    openWechatIdeMock.mockResolvedValue(undefined)
    openWechatIdeOtherProjectMock.mockResolvedValue(undefined)
    previewWechatIdeMock.mockResolvedValue(undefined)
    quitWechatIdeMock.mockResolvedValue(undefined)
    resetWechatIdeFileUtilsMock.mockResolvedValue(undefined)
    runWechatIdeEngineBuildMock.mockResolvedValue(undefined)
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

  it('dispatches open argv to open helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'open',
      '--project',
      '/tmp/demo',
      '--platform',
      'weapp',
      '--trust-project',
    ])

    expect(handled).toBe(true)
    expect(openWechatIdeMock).toHaveBeenCalledWith({
      appid: undefined,
      extAppid: undefined,
      platform: 'weapp',
      projectPath: '/tmp/demo',
      trustProject: true,
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

  it('dispatches auto argv to auto helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'auto',
      '--project',
      '/tmp/demo',
      '--auto-port',
      '9421',
      '--auto-account',
      'tester',
      '--trust-project',
    ])

    expect(handled).toBe(true)
    expect(autoWechatIdeMock).toHaveBeenCalledWith({
      account: 'tester',
      appid: undefined,
      extAppid: undefined,
      port: '9421',
      projectPath: '/tmp/demo',
      testTicket: undefined,
      ticket: undefined,
      trustProject: true,
    })
  })

  it('dispatches auto-replay argv to auto-replay helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'auto-replay',
      '--appid',
      'wx123',
      '--replay-all',
      '--replay-config-path',
      '/tmp/replay.json',
    ])

    expect(handled).toBe(true)
    expect(autoReplayWechatIdeMock).toHaveBeenCalledWith({
      account: undefined,
      appid: 'wx123',
      extAppid: undefined,
      port: undefined,
      projectPath: undefined,
      replayAll: true,
      replayConfigPath: '/tmp/replay.json',
      testTicket: undefined,
      ticket: undefined,
      trustProject: false,
    })
  })

  it('dispatches cache argv to cache helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand(['cache', '--clean', 'all'])

    expect(handled).toBe(true)
    expect(clearWechatIdeCacheMock).toHaveBeenCalledWith({ clean: 'all' })
  })

  it('dispatches build-apk argv to build-apk helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'build-apk',
      '--output',
      '/tmp/out',
      '--key-store',
      '/tmp/demo.keystore',
      '--key-alias',
      'demo',
      '--key-pass',
      'key-pass',
      '--store-pass',
      'store-pass',
      '--use-aab',
      'true',
    ])

    expect(handled).toBe(true)
    expect(buildWechatIdeApkMock).toHaveBeenCalledWith({
      desc: undefined,
      isUploadResourceBundle: false,
      keyAlias: 'demo',
      keyPass: 'key-pass',
      keyStore: '/tmp/demo.keystore',
      output: '/tmp/out',
      resourceBundleDesc: undefined,
      resourceBundleVersion: undefined,
      storePass: 'store-pass',
      useAab: true,
    })
  })

  it('dispatches build-ipa argv to build-ipa helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'build-ipa',
      '--output',
      '/tmp/out',
      '--isDistribute',
      'true',
      '--versionCode',
      '12',
    ])

    expect(handled).toBe(true)
    expect(buildWechatIdeIpaMock).toHaveBeenCalledWith({
      certificateName: undefined,
      isDistribute: true,
      isRemoteBuild: false,
      isUploadBeta: false,
      isUploadResourceBundle: false,
      output: '/tmp/out',
      p12Password: undefined,
      p12Path: undefined,
      profilePath: undefined,
      resourceBundleDesc: undefined,
      resourceBundleVersion: undefined,
      tpnsProfilePath: undefined,
      versionCode: 12,
      versionDesc: undefined,
      versionName: undefined,
    })
  })

  it('dispatches official short aliases to stable helpers', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const loginHandled = await dispatchWechatCliCommand([
      'login',
      '-f',
      'image',
      '-o',
      '/tmp/qr.png',
      '-r',
      '/tmp/result.json',
    ])
    const previewHandled = await dispatchWechatCliCommand([
      'preview',
      '-p',
      '/tmp/demo',
      '-f',
      'base64',
      '-o',
      '/tmp/preview.png',
      '-i',
      '/tmp/info.json',
    ])
    const uploadHandled = await dispatchWechatCliCommand([
      'upload',
      '-p',
      '/tmp/demo',
      '-v',
      '1.0.0',
      '-d',
      'release',
      '-i',
      '/tmp/upload.json',
    ])
    const buildApkHandled = await dispatchWechatCliCommand([
      'build-apk',
      '-o',
      '/tmp/out',
      '-ks',
      '/tmp/demo.keystore',
      '-ka',
      'demo',
      '-kp',
      'key-pass',
      '-sp',
      'store-pass',
      '-u',
    ])

    expect(loginHandled).toBe(true)
    expect(previewHandled).toBe(true)
    expect(uploadHandled).toBe(true)
    expect(buildApkHandled).toBe(true)

    expect(loginWechatIdeMock).toHaveBeenCalledWith({
      qrFormat: 'image',
      qrOutput: '/tmp/qr.png',
      qrSize: undefined,
      resultOutput: '/tmp/result.json',
    })
    expect(previewWechatIdeMock).toHaveBeenCalledWith({
      appid: undefined,
      compileCondition: undefined,
      extAppid: undefined,
      infoOutput: '/tmp/info.json',
      projectPath: '/tmp/demo',
      qrFormat: 'base64',
      qrOutput: '/tmp/preview.png',
      qrSize: undefined,
    })
    expect(uploadWechatIdeMock).toHaveBeenCalledWith({
      appid: undefined,
      desc: 'release',
      extAppid: undefined,
      infoOutput: '/tmp/upload.json',
      projectPath: '/tmp/demo',
      version: '1.0.0',
    })
    expect(buildWechatIdeApkMock).toHaveBeenCalledWith({
      desc: undefined,
      isUploadResourceBundle: false,
      keyAlias: 'demo',
      keyPass: 'key-pass',
      keyStore: '/tmp/demo.keystore',
      output: '/tmp/out',
      resourceBundleDesc: undefined,
      resourceBundleVersion: undefined,
      storePass: 'store-pass',
      useAab: true,
    })
  })

  it('dispatches build-ipa boolean flags in official yargs style', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'build-ipa',
      '-o',
      '/tmp/out',
      '--isDistribute',
      '--isRemoteBuild',
      '--isUploadBeta=false',
    ])

    expect(handled).toBe(true)
    expect(buildWechatIdeIpaMock).toHaveBeenCalledWith({
      certificateName: undefined,
      isDistribute: true,
      isRemoteBuild: true,
      isUploadBeta: false,
      isUploadResourceBundle: false,
      output: '/tmp/out',
      p12Password: undefined,
      p12Path: undefined,
      profilePath: undefined,
      resourceBundleDesc: undefined,
      resourceBundleVersion: undefined,
      tpnsProfilePath: undefined,
      versionCode: undefined,
      versionDesc: undefined,
      versionName: undefined,
    })
  })

  it('dispatches reset-fileutils argv to http-backed helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'reset-fileutils',
      '--project',
      '/tmp/demo',
    ])

    expect(handled).toBe(true)
    expect(resetWechatIdeFileUtilsMock).toHaveBeenCalledWith({
      projectPath: '/tmp/demo',
    })
  })

  it('dispatches engine build argv to engine helper', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand([
      'engine',
      'build',
      '/tmp/demo',
      '--logPath',
      '/tmp/engine.log',
    ])

    expect(handled).toBe(true)
    expect(runWechatIdeEngineBuildMock).toHaveBeenCalledWith('/tmp/demo', {
      logPath: '/tmp/engine.log',
    })
  })

  it('returns false when upload argv misses required fields', async () => {
    const { dispatchWechatCliCommand } = await import('../src/cli/wechat-dispatch')

    const handled = await dispatchWechatCliCommand(['upload', '--project', '/tmp/demo'])

    expect(handled).toBe(false)
    expect(uploadWechatIdeMock).not.toHaveBeenCalled()
  })
})
