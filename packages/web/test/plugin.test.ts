import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { weappWebPlugin } from '../src/plugin'

describe('weappWebPlugin', () => {
  it('transforms wxml files to template modules', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '<view>{{msg}}</view>',
      '/foo/bar.wxml',
    )
    expect(result?.code).toContain(`import { html } from 'lit'`)
    expect(result?.code).toContain('export default render')
  })

  it('transforms wxss files to css injection helpers', async () => {
    const plugin = weappWebPlugin()
    const transform = plugin.transform
    expect(typeof transform).toBe('function')
    const result = await (transform as (code: string, id: string) => Promise<any> | any).call(
      {},
      '.page { width: 750rpx; }',
      '/foo/index.wxss',
    )
    expect(result?.code).toContain('injectStyle')
    expect(result?.code).toContain('export function useStyle')
  })

  it('injects runtime warning options into entry initializer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
    await writeFile(join(pageDir, 'index.js'), 'Page({})')
    await writeFile(join(pageDir, 'index.wxml'), '<view>index</view>')

    const plugin = weappWebPlugin({
      srcDir: 'src',
      runtime: {
        executionMode: 'safe',
        warnings: {
          level: 'off',
          dedupe: false,
        },
      },
    })
    await plugin.configResolved?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const entryId = plugin.resolveId?.('/@weapp-vite/web/entry') as string
    expect(entryId).toBeTruthy()

    const code = plugin.load?.call({} as any, entryId) as string
    expect(code).toContain('initializePageRoutes(["pages/index/index"]')
    expect(code).toContain('"runtime":{"executionMode":"safe","warnings":{"level":"off","dedupe":false}}')
  })
})
