import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSidecarWatchOptions, createViteWatchIgnored, resolvePollingWatchOptions } from './options'

describe('runtime sidecar watch options', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps base options when polling is not configured', () => {
    expect(createSidecarWatchOptions({ inlineConfig: {} } as any, {
      persistent: true,
      ignoreInitial: true,
    })).toEqual({
      persistent: true,
      ignoreInitial: true,
    })
  })

  it('inherits polling options from build.watch.chokidar', () => {
    expect(createSidecarWatchOptions({
      inlineConfig: {
        build: {
          watch: {
            chokidar: {
              usePolling: true,
              interval: 100,
              binaryInterval: 200,
            },
          },
        },
      },
    } as any, {
      persistent: true,
    })).toEqual({
      persistent: true,
      backend: 'polling',
      pollingInterval: 100,
      pollingBinaryInterval: 200,
    })
  })

  it('prefers canonical backend options within each source and build options over server options', () => {
    const config = {
      inlineConfig: {
        build: { watch: { chokidar: { backend: 'native-recursive', usePolling: true, pollingInterval: 25, interval: 50 } } },
        server: { watch: { backend: 'polling', pollingInterval: 100, pollingBinaryInterval: 200 } },
      },
    } as any
    expect(createSidecarWatchOptions(config, {})).toEqual({
      backend: 'native-recursive',
      pollingInterval: 25,
      pollingBinaryInterval: 200,
    })
    expect(resolvePollingWatchOptions(config)).toEqual({ usePolling: false, interval: 25, binaryInterval: 200 })
  })

  it('maps explicit legacy native options and preserves canonical auto', () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
    expect(createSidecarWatchOptions({ inlineConfig: { server: { watch: { usePolling: false } } } } as any, {}))
      .toEqual({ backend: 'native' })
    const automatic = { inlineConfig: { server: { watch: { backend: 'auto', usePolling: true } } } } as any
    expect(createSidecarWatchOptions(automatic, {}))
      .toEqual({ backend: 'auto' })
    expect(resolvePollingWatchOptions(automatic)).toMatchObject({ usePolling: false })
  })

  it('inherits polling options from chokidar environment variables', () => {
    vi.stubEnv('CHOKIDAR_USEPOLLING', '1')
    vi.stubEnv('CHOKIDAR_INTERVAL', '120')
    vi.stubEnv('CHOKIDAR_BINARY_INTERVAL', '240')

    expect(createSidecarWatchOptions({ inlineConfig: {} } as any, {
      persistent: true,
    })).toEqual({
      persistent: true,
      backend: 'polling',
      pollingInterval: 120,
      pollingBinaryInterval: 240,
    })
  })
})

describe('Vite watch ignored', () => {
  it('keeps user ignores and excludes generated output across Windows path formats', () => {
    const userMatcher = (id: string) => id.endsWith('.generated.ts')
    const ignored = createViteWatchIgnored(
      'C:\\project',
      'C:\\project\\dist',
      ['**/.cache/**', /ignored-package/, userMatcher],
    ) as Array<string | RegExp | ((id: string) => boolean)>

    expect(ignored.slice(0, 3)).toEqual(['**/.cache/**', /ignored-package/, userMatcher])
    const outDirMatcher = ignored[3] as (id: string) => boolean
    expect(outDirMatcher('dist\\miniprogram_npm\\@vant\\weapp\\field\\index.json')).toBe(true)
    expect(outDirMatcher('C:\\project\\dist\\pages\\index.js')).toBe(true)
    expect(outDirMatcher('C:/project/dist-other/app.json')).toBe(false)
    expect(outDirMatcher('C:\\project\\pages\\index.ts')).toBe(false)
  })

  it('resolves relative output directories from POSIX and Windows roots', () => {
    const posixIgnored = createViteWatchIgnored('/', 'dist') as Array<(id: string) => boolean>
    const windowsIgnored = createViteWatchIgnored('C:\\', 'dist') as Array<(id: string) => boolean>

    expect(posixIgnored[0]!('/dist/app.js')).toBe(true)
    expect(posixIgnored[0]!('/dist-other/app.js')).toBe(false)
    expect(windowsIgnored[0]!('C:\\dist\\app.js')).toBe(true)
    expect(windowsIgnored[0]!('C:\\dist-other\\app.js')).toBe(false)
  })
})
