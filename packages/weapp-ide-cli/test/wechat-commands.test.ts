import { beforeEach, describe, expect, it, vi } from 'vitest'

const runWechatCliCommandMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/run-wechat-cli', () => ({
  runWechatCliCommand: runWechatCliCommandMock,
}))

describe('wechat command helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    runWechatCliCommandMock.mockReset()
    runWechatCliCommandMock.mockResolvedValue(undefined)
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
})
