import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { weappWebPlugin } from '../src/plugin'
import { slugify } from '../src/shared/slugify'

describe('compileWxml component mapping', () => {
  it('replaces custom component tags with provided mapping', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<HelloWorld links="{{items}}" class="hero" />',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
      componentTags: {
        helloworld: 'wv-component-hello-world',
      },
    })

    expect(result.code).toContain('wv-component-hello-world')
    expect(result.code).toContain('.links=${')
    expect(result.code).toContain('class=${')
  })

  it('keeps slot elements in output', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<view><slot name="header">fallback</slot></view>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })

    expect(result.code).toContain('<slot')
    expect(result.code).toContain('</slot>')
  })

  it('preserves slot attribute binding for custom components', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: '<Card><FancyTitle slot="header" title="Hello" /></Card>',
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
      componentTags: {
        card: 'wv-component-card',
        fancytitle: 'wv-component-fancy-title',
      },
    })

    expect(result.code).toContain('wv-component-card')
    expect(result.code).toContain('wv-component-fancy-title')
    expect(result.code).toContain('.title=${')
    expect(result.code).toContain(' slot=${')
    expect(result.code).not.toContain('.slot=${')
  })

  it('prefers page usingComponents over app mapping', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-'))
    const srcRoot = join(root, 'src')
    await mkdir(join(srcRoot, 'pages/index'), { recursive: true })
    await mkdir(join(srcRoot, 'components/Foo'), { recursive: true })
    await mkdir(join(srcRoot, 'components/Bar'), { recursive: true })

    await writeFile(
      join(srcRoot, 'app.json'),
      JSON.stringify({
        pages: ['pages/index/index'],
        usingComponents: {
          Shared: '/components/Foo/Foo',
        },
      }),
    )
    await writeFile(join(srcRoot, 'pages/index/index.ts'), 'Page({})')
    await writeFile(join(srcRoot, 'pages/index/index.wxml'), '<Shared />')
    await writeFile(
      join(srcRoot, 'pages/index/index.json'),
      JSON.stringify({
        usingComponents: {
          Shared: '/components/Bar/Bar',
        },
      }),
    )

    await writeFile(join(srcRoot, 'components/Foo/Foo.ts'), 'Component({})')
    await writeFile(join(srcRoot, 'components/Foo/Foo.wxml'), '<view>foo</view>')
    await writeFile(join(srcRoot, 'components/Bar/Bar.ts'), 'Component({})')
    await writeFile(join(srcRoot, 'components/Bar/Bar.wxml'), '<view>bar</view>')

    const plugin = weappWebPlugin({ srcDir: 'src' })
    await plugin.configResolved?.call({ warn() {} } as any, { root, command: 'build' } as any)

    const transform = plugin.transform as (code: string, id: string) => Promise<{ code: string } | null>
    const result = await transform.call(
      { addWatchFile() {}, warn() {} },
      '<Shared />',
      join(srcRoot, 'pages/index/index.wxml'),
    )

    const expectedTag = slugify('components/Bar/Bar', 'wv-component')
    expect(result?.code).toContain(expectedTag)
  })
})
