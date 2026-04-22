import { beforeEach, describe, expect, it, vi } from 'vitest'

const runWechatCliCommandMock = vi.hoisted(() => vi.fn())
const resetWechatIdeFileUtilsByHttpMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/run-wechat-cli', () => ({
  runWechatCliCommand: runWechatCliCommandMock,
}))

vi.mock('../src/cli/http', () => ({
  resetWechatIdeFileUtilsByHttp: resetWechatIdeFileUtilsByHttpMock,
}))

describe('wechat command helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    runWechatCliCommandMock.mockReset()
    runWechatCliCommandMock.mockResolvedValue(undefined)
    resetWechatIdeFileUtilsByHttpMock.mockReset()
    resetWechatIdeFileUtilsByHttpMock.mockResolvedValue(undefined)
  })

  it('builds login argv with normalized output paths', async () => {
    const { loginWechatIde } = await import('../src/cli/wechat-commands')

    await loginWechatIde({
      qrFormat: 'image',
      qrOutput: './tmp/qr.png',
      qrSize: '280',
      resultOutput: './tmp/result.json',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'login',
      '--qr-format',
      'image',
      '--qr-output',
      expect.stringMatching(/tmp\/qr\.png$/),
      '--qr-size',
      '280',
      '--result-output',
      expect.stringMatching(/tmp\/result\.json$/),
    ])
  })

  it('builds open argv with project locator and trust-project flag', async () => {
    const { openWechatIde } = await import('../src/cli/wechat-commands')

    await openWechatIde({
      platform: 'weapp',
      projectPath: './dist/dev/mp-weixin',
      trustProject: true,
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'open',
      '--project',
      expect.stringMatching(/dist\/dev\/mp-weixin$/),
      '--platform',
      'weapp',
      '--trust-project',
    ])
  })

  it('runs islogin through official cli wrapper', async () => {
    const { isWechatIdeLoggedIn } = await import('../src/cli/wechat-commands')

    await isWechatIdeLoggedIn()

    expect(runWechatCliCommandMock).toHaveBeenCalledWith(['islogin'])
  })

  it('builds npm through official cli wrapper with normalized project path', async () => {
    const { buildWechatIdeNpm } = await import('../src/cli/wechat-commands')

    await buildWechatIdeNpm({
      compileType: 'miniprogram',
      projectPath: './dist/dev/mp-weixin',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'build-npm',
      '--project',
      expect.stringMatching(/dist\/dev\/mp-weixin$/),
      '--compile-type',
      'miniprogram',
    ])
  })

  it('builds preview argv with normalized project and output paths', async () => {
    const { previewWechatIde } = await import('../src/cli/wechat-commands')

    await previewWechatIde({
      compileCondition: 'test-condition',
      infoOutput: './tmp/info.json',
      projectPath: './dist/dev/mp-weixin',
      qrFormat: 'image',
      qrOutput: './tmp/qr.png',
      qrSize: '280',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'preview',
      '--project',
      expect.stringMatching(/dist\/dev\/mp-weixin$/),
      '--qr-format',
      'image',
      '--qr-output',
      expect.stringMatching(/tmp\/qr\.png$/),
      '--qr-size',
      '280',
      '--info-output',
      expect.stringMatching(/tmp\/info\.json$/),
      '--compile-condition',
      'test-condition',
    ])
  })

  it('builds auto-preview argv with appid and normalized info output', async () => {
    const { autoPreviewWechatIde } = await import('../src/cli/wechat-commands')

    await autoPreviewWechatIde({
      appid: 'wx123',
      compileCondition: 'ci-condition',
      extAppid: 'wx456',
      infoOutput: './tmp/auto-preview.json',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'auto-preview',
      '--appid',
      'wx123',
      '--ext-appid',
      'wx456',
      '--info-output',
      expect.stringMatching(/tmp\/auto-preview\.json$/),
      '--compile-condition',
      'ci-condition',
    ])
  })

  it('builds auto argv with project locator and trust-project flag', async () => {
    const { autoWechatIde } = await import('../src/cli/wechat-commands')

    await autoWechatIde({
      account: 'tester',
      port: '9421',
      projectPath: './dist/dev/mp-weixin',
      testTicket: 'ticket-a',
      ticket: 'ticket-b',
      trustProject: true,
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'auto',
      '--project',
      expect.stringMatching(/dist\/dev\/mp-weixin$/),
      '--auto-port',
      '9421',
      '--auto-account',
      'tester',
      '--test-ticket',
      'ticket-a',
      '--ticket',
      'ticket-b',
      '--trust-project',
    ])
  })

  it('builds auto-replay argv with normalized replay config path', async () => {
    const { autoReplayWechatIde } = await import('../src/cli/wechat-commands')

    await autoReplayWechatIde({
      appid: 'wx123',
      replayAll: true,
      replayConfigPath: './tmp/replay.json',
      trustProject: true,
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'auto-replay',
      '--appid',
      'wx123',
      '--replay-all',
      '--replay-config-path',
      expect.stringMatching(/tmp\/replay\.json$/),
      '--trust-project',
    ])
  })

  it('builds upload argv with required fields and normalized info output', async () => {
    const { uploadWechatIde } = await import('../src/cli/wechat-commands')

    await uploadWechatIde({
      desc: 'release build',
      infoOutput: './tmp/upload.json',
      projectPath: './dist/build/mp-weixin',
      version: '1.0.0',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'upload',
      '--project',
      expect.stringMatching(/dist\/build\/mp-weixin$/),
      '--version',
      '1.0.0',
      '--desc',
      'release build',
      '--info-output',
      expect.stringMatching(/tmp\/upload\.json$/),
    ])
  })

  it('runs close through official cli wrapper', async () => {
    const { closeWechatIdeProject } = await import('../src/cli/wechat-commands')

    await closeWechatIdeProject()

    expect(runWechatCliCommandMock).toHaveBeenCalledWith(['close'])
  })

  it('runs quit through official cli wrapper', async () => {
    const { quitWechatIde } = await import('../src/cli/wechat-commands')

    await quitWechatIde()

    expect(runWechatCliCommandMock).toHaveBeenCalledWith(['quit'])
  })

  it('runs cache through official cli wrapper', async () => {
    const { clearWechatIdeCache } = await import('../src/cli/wechat-commands')

    await clearWechatIdeCache({ clean: 'network' })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith(['cache', '--clean', 'network'])
  })

  it('runs open-other through official cli wrapper', async () => {
    const { openWechatIdeOtherProject } = await import('../src/cli/wechat-commands')

    await openWechatIdeOtherProject()

    expect(runWechatCliCommandMock).toHaveBeenCalledWith(['open-other'])
  })

  it('resets fileutils through http helper with normalized project path', async () => {
    const { resetWechatIdeFileUtils } = await import('../src/cli/wechat-commands')

    await resetWechatIdeFileUtils({
      projectPath: './dist/dev/mp-weixin',
    })

    expect(resetWechatIdeFileUtilsByHttpMock).toHaveBeenCalledWith(
      expect.stringMatching(/dist\/dev\/mp-weixin$/),
    )
  })

  it('builds build-apk argv with normalized file paths', async () => {
    const { buildWechatIdeApk } = await import('../src/cli/wechat-commands')

    await buildWechatIdeApk({
      desc: 'release apk',
      isUploadResourceBundle: true,
      keyAlias: 'demo',
      keyPass: 'key-pass',
      keyStore: './certs/demo.keystore',
      output: './dist/apk',
      resourceBundleDesc: 'rb-desc',
      resourceBundleVersion: '1.2.3',
      storePass: 'store-pass',
      useAab: true,
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'build-apk',
      '--key-store',
      expect.stringMatching(/certs\/demo\.keystore$/),
      '--key-alias',
      'demo',
      '--key-pass',
      'key-pass',
      '--store-pass',
      'store-pass',
      '--output',
      expect.stringMatching(/dist\/apk$/),
      '--use-aab',
      'true',
      '--desc',
      'release apk',
      '--isUploadResourceBundle',
      '--resourceBundleVersion',
      '1.2.3',
      '--resourceBundleDesc',
      'rb-desc',
    ])
  })

  it('builds build-ipa argv with normalized optional file paths', async () => {
    const { buildWechatIdeIpa } = await import('../src/cli/wechat-commands')

    await buildWechatIdeIpa({
      certificateName: 'Apple Demo',
      isDistribute: true,
      isRemoteBuild: false,
      isUploadBeta: true,
      isUploadResourceBundle: true,
      output: './dist/ipa',
      p12Password: 'secret',
      p12Path: './certs/demo.p12',
      profilePath: './certs/demo.mobileprovision',
      resourceBundleDesc: 'rb-desc',
      resourceBundleVersion: '2.0.0',
      tpnsProfilePath: './certs/demo.tpns',
      versionCode: 12,
      versionDesc: 'ipa desc',
      versionName: '1.2.0',
    })

    expect(runWechatCliCommandMock).toHaveBeenCalledWith([
      'build-ipa',
      '--output',
      expect.stringMatching(/dist\/ipa$/),
      '--isDistribute',
      'true',
      '--isRemoteBuild',
      'false',
      '--profilePath',
      expect.stringMatching(/certs\/demo\.mobileprovision$/),
      '--certificateName',
      'Apple Demo',
      '--p12Path',
      expect.stringMatching(/certs\/demo\.p12$/),
      '--p12Password',
      'secret',
      '--tpnsProfilePath',
      expect.stringMatching(/certs\/demo\.tpns$/),
      '--isUploadBeta',
      'true',
      '--isUploadResourceBundle',
      '--resourceBundleVersion',
      '2.0.0',
      '--resourceBundleDesc',
      'rb-desc',
      '--versionName',
      '1.2.0',
      '--versionCode',
      '12',
      '--versionDesc',
      'ipa desc',
    ])
  })
})
