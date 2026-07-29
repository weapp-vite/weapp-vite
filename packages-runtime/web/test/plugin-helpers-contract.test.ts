import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { wrapPageTemplate } from '../src/plugin/layout'
import { mergeNavigationConfig, pickNavigationConfig } from '../src/plugin/navigation'
import {
  collectComponentTagsFromConfig,
  collectComponentTagsFromJson,
  mergeComponentTags,
} from '../src/plugin/scanConfig'

describe('web plugin helper contracts', () => {
  it('picks string navigation fields and merges explicit overrides', () => {
    expect(pickNavigationConfig(undefined)).toEqual({})
    expect(pickNavigationConfig({
      navigationBarBackgroundColor: '#fff',
      navigationBarTextStyle: 'black',
      navigationBarTitleText: 'Home',
      navigationStyle: 'custom',
    })).toEqual({
      backgroundColor: '#fff',
      navigationStyle: 'custom',
      textStyle: 'black',
      title: 'Home',
    })
    expect(pickNavigationConfig({
      navigationBarBackgroundColor: 1,
      navigationBarTextStyle: false,
      navigationBarTitleText: null,
      navigationStyle: {},
    })).toEqual({})
    expect(mergeNavigationConfig({ title: 'Base', textStyle: 'white' }, { title: 'Page' }))
      .toEqual({ title: 'Page', textStyle: 'white' })
  })

  it('wraps layouts with shared props, aliases and fallback content', () => {
    expect(wrapPageTemplate('<view />', [])).toBe('<view />')
    const wrapped = wrapPageTemplate('<view>page</view>', [
      { name: 'default', tag: 'wv-layout-default', template: '{{pageTitle}}{{item}}{{index}}{{camelCase}}' },
      { name: 'empty', tag: 'wv-layout-empty' },
    ] as any)
    expect(wrapped).toContain('wx:if="{{!__wv_page_layout_name')
    expect(wrapped).toContain('wx:elif="{{__wv_page_layout_name === \'empty\'}}"')
    expect(wrapped).toContain('page-title="{{(__wv_page_layout_props&&__wv_page_layout_props.pageTitle)}}"')
    expect(wrapped).toContain('camel-case="{{(__wv_page_layout_props&&__wv_page_layout_props.camelCase)}}"')
    expect(wrapped).not.toContain('__wv_page_layout_props.item')
    expect(wrapped).toContain('<block wx:else><view>page</view></block>')

    expect(wrapPageTemplate('page', [{ name: 'plain', tag: 'wv-layout-plain' }] as any))
      .toContain('<wv-layout-plain>page</wv-layout-plain>')
  })

  it('collects valid component config entries and reports unresolved scripts', async () => {
    const warn = vi.fn()
    const collectComponent = vi.fn()
    const onResolved = vi.fn()
    const resolveComponentScript = vi.fn(async (raw: string) => raw === '/card' ? '/src/card.ts' : undefined)
    const base = {
      collectComponent,
      getComponentTag: (script: string) => `tag:${script}`,
      importerDir: '/src/pages',
      jsonPath: '/src/pages/index.json',
      onResolved,
      resolveComponentScript,
      warn,
    }
    await expect(collectComponentTagsFromConfig({ ...base, json: {} })).resolves.toEqual({})
    await expect(collectComponentTagsFromConfig({ ...base, json: { usingComponents: 'invalid' } })).resolves.toEqual({})
    const tags = await collectComponentTagsFromConfig({
      ...base,
      json: {
        usingComponents: {
          ' CARD ': '/card',
          ' ': '/blank',
          'invalid': 1,
          'missing': '/missing',
        },
      },
    })
    expect(tags).toEqual({ card: 'tag:/src/card.ts' })
    expect(onResolved).toHaveBeenCalledWith(tags)
    expect(collectComponent).toHaveBeenCalledWith('/card', '/src/pages')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing'))

    await collectComponentTagsFromConfig({
      ...base,
      json: { usingComponents: { card: '/card' } },
      onResolved: undefined,
    })
  })

  it('loads component JSON configs and merges empty or overriding tag maps', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-plugin-config-'))
    const validBase = join(root, 'valid')
    const invalidBase = join(root, 'invalid')
    await writeFile(`${validBase}.json`, '{"usingComponents":{"card":"/card"}}')
    await writeFile(`${invalidBase}.json`, '{invalid')
    const collectFromConfig = vi.fn(async () => ({ card: 'wv-card' }))
    const options = {
      collectFromConfig,
      importerDir: root,
      warn: vi.fn(),
    }
    await expect(collectComponentTagsFromJson({ ...options, jsonBasePath: join(root, 'missing.json') }))
      .resolves
      .toEqual({})
    await expect(collectComponentTagsFromJson({ ...options, jsonBasePath: `${invalidBase}.json` }))
      .resolves
      .toEqual({})
    await expect(collectComponentTagsFromJson({ ...options, jsonBasePath: `${validBase}.json` }))
      .resolves
      .toEqual({ card: 'wv-card' })
    expect(collectFromConfig).toHaveBeenCalledWith(
      { usingComponents: { card: '/card' } },
      root,
      `${validBase}.json`,
      options.warn,
    )

    expect(mergeComponentTags({}, {})).toEqual({})
    expect(mergeComponentTags({ card: 'base' }, { card: 'override', panel: 'panel' }))
      .toEqual({ card: 'override', panel: 'panel' })
  })
})
