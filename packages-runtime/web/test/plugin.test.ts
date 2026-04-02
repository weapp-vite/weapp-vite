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
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const entryId = (plugin.resolveId as ((...args: any[]) => any))?.('/@weapp-vite/web/entry') as string
    expect(entryId).toBeTruthy()

    const code = (plugin.load as ((...args: any[]) => any))?.call({} as any, entryId) as string
    expect(code).toContain('initializePageRoutes(["pages/index/index"]')
    expect(code).toContain('"runtime":{"executionMode":"safe","warnings":{"level":"off","dedupe":false}}')
  })

  it('loads runtime polyfill from a Vite fs path in virtual entry modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-entry-polyfill-'))
    const srcRoot = join(root, 'src')
    const pageDir = join(srcRoot, 'pages/index')
    await mkdir(pageDir, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
    await writeFile(join(pageDir, 'index.js'), 'Page({})')
    await writeFile(join(pageDir, 'index.wxml'), '<view>index</view>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const entryId = (plugin.resolveId as ((...args: any[]) => any))?.('/@weapp-vite/web/entry') as string
    const code = (plugin.load as ((...args: any[]) => any))?.call({} as any, entryId) as string

    expect(code).toMatch(/from '\/@fs\/.*runtime\/(index\.mjs|polyfill\.ts)'/)
    expect(code).not.toContain('@weapp-vite/web/runtime/polyfill')
  })

  it('transforms app modules to import runtime polyfill through a Vite fs path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-transform-polyfill-'))
    const srcRoot = join(root, 'src')
    await mkdir(srcRoot, { recursive: true })
    await writeFile(join(srcRoot, 'app.js'), 'App({})')
    await writeFile(join(srcRoot, 'app.json'), JSON.stringify({ pages: [] }))

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await (plugin.configResolved as ((...args: any[]) => any))?.call({ warn() {} } as any, { root, command: 'serve' } as any)

    const transform = plugin.transform as (code: string, id: string) => Promise<any> | any
    const result = await transform.call({}, 'App({})', join(srcRoot, 'app.js'))

    expect(result?.code).toMatch(/from '\/@fs\/.*runtime\/(index\.mjs|polyfill\.ts)'/)
    expect(result?.code).toContain('registerApp')
    expect(result?.code).not.toContain('@weapp-vite/web/runtime/polyfill')
  })
})
