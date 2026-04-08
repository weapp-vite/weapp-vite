import { beforeEach, describe, expect, it, vi } from 'vitest'

const outputJsonMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/shared', () => ({
  fs: {
    outputJson: outputJsonMock,
  },
}))

describe('autoImport manifest outputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes only runtime resolver components into manifest', async () => {
    const { writeManifestFile } = await import('./manifest')

    const registry = new Map<string, any>([
      ['local-card', {
        kind: 'local',
        value: {
          name: 'local-card',
          from: '/components/local-card/index',
        },
      }],
    ])
    const manifestCache = new Map<string, string>()
    const scheduleHtmlCustomDataWrite = vi.fn()

    await writeManifestFile({
      outputPath: '/project/.weapp-vite/components.manifest.json',
      collectRuntimeResolverComponents: () => ({
        'van-button': '@vant/weapp/button',
      }),
      registry,
      manifestCache,
      scheduleHtmlCustomDataWrite,
    })

    expect(outputJsonMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/components.manifest.json',
      {
        'local-card': '/components/local-card/index',
        'van-button': '@vant/weapp/button',
      },
      { spaces: 2 },
    )
    expect(manifestCache).toEqual(new Map([
      ['van-button', '@vant/weapp/button'],
      ['local-card', '/components/local-card/index'],
    ]))
    expect(scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
  })
})
