import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'
import {
  extractBuiltinComponents,
  renderBuiltinComponents,
  updateBuiltinComponents,
  validateBuiltinComponents,
  WECHAT_COMPONENTS_URL,
} from './index'

const fixedTags = ['wxs', 'template', 'block', 'import', 'include']
const previousComponents = [...fixedTags, 'view', 'scroll-view', 'text']

function componentLink(name: string) {
  return `<a href="/miniprogram/dev/component/${name}.html">${name}</a>`
}

describe('WeChat builtin component extraction', () => {
  it.each(['ul', 'div'])('reads %s navigation children and preserves first occurrence order', (tag) => {
    const navigation = `<${tag} class="NavigationLevel__children"><li><span class="NavigationItem">
      ${componentLink('view')}${componentLink('scroll-view')}${componentLink('text')}
    </span></li></${tag}>`
    const html = `<main class="main-container"><aside class="sidebar">${navigation}</aside></main>${navigation}`
    expect(extractBuiltinComponents(html)).toEqual(['view', 'scroll-view', 'text'])
  })

  it('uses document links independently of navigation classes or element types', () => {
    const html = `<section>${componentLink('view')}
      <a href="scroll-view.html?lang=en#properties"> scroll-view </a>
      <a href="${WECHAT_COMPONENTS_URL.replace('ad.html', 'text.html')}"><span>text</span></a>
      <a href="//developers.weixin.qq.com/miniprogram/dev/component/button.html">button</a>
    </section>`
    expect(extractBuiltinComponents(html)).toEqual(['view', 'scroll-view', 'text', 'button'])
  })

  it('ignores categories, cross-origin links, unrelated docs, invalid names and malformed URLs', () => {
    const html = `${componentLink('view')}
      <a href="/miniprogram/dev/component/view.html">视图容器</a>
      <a href="/miniprogram/dev/component/">组件</a>
      <a href="https://example.com/miniprogram/dev/component/fake.html">fake</a>
      <a href="/miniprogram/dev/api/request.html">request</a>
      <a href="/miniprogram/dev/component/button.html">button extra</a>
      <a href="/miniprogram/dev/component/button/details.html">details</a>
      <a href="http://[invalid">fake</a>
      ${componentLink('View')}${componentLink('bad_name')}${componentLink('button-')}
      ${componentLink('bad--name')}${componentLink('1button')}
    `
    expect(extractBuiltinComponents(html)).toEqual(['view'])
  })

  it('retains fixed tags, deduplicates names and accepts new components', () => {
    expect(validateBuiltinComponents(['view', 'view', 'scroll-view', 'text', 'reward'], previousComponents))
      .toEqual([...previousComponents, 'reward'])
    expect(renderBuiltinComponents(['view'])).toContain('  \'view\',\n]\n')
  })
})

describe('WeChat builtin generation write boundary', () => {
  it.each(['', '<html><title>Access denied</title></html>', componentLink('view')])(
    'preserves the existing file for empty, error or partial documents (%s)',
    async (html) => {
      const writeSource = vi.fn()
      const log = vi.fn()
      await expect(updateBuiltinComponents({
        previousComponents,
        fetchHtml: async () => html,
        writeSource,
        log,
      })).rejects.toThrow(/No component names|Refusing to remove/)
      expect(writeSource).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('missing:'))
    },
  )

  it('reports the exact missing component even for a single deletion', async () => {
    const writeSource = vi.fn()
    await expect(updateBuiltinComponents({
      previousComponents,
      fetchHtml: async () => componentLink('view') + componentLink('text'),
      writeSource,
      log: vi.fn(),
    })).rejects.toThrow('scroll-view')
    expect(writeSource).not.toHaveBeenCalled()
  })

  it('does not write on network failure and bounds the real request timeout', async () => {
    const request = vi.spyOn(axios, 'get').mockRejectedValueOnce(new Error('request timed out'))
    const writeSource = vi.fn()
    try {
      await expect(updateBuiltinComponents({ previousComponents, writeSource, log: vi.fn() }))
        .rejects
        .toThrow('request timed out')
      expect(request).toHaveBeenCalledWith(WECHAT_COMPONENTS_URL, { responseType: 'text', timeout: 30_000 })
      expect(writeSource).not.toHaveBeenCalled()
    }
    finally {
      request.mockRestore()
    }
  })

  it('writes only a validated list and produces the same output on a second run', async () => {
    const writeSource = vi.fn().mockResolvedValue(undefined)
    const log = vi.fn()
    const fetchHtml = async () => ['view', 'scroll-view', 'text', 'reward'].map(componentLink).join('')
    const components = await updateBuiltinComponents({ previousComponents, fetchHtml, writeSource, log })
    await updateBuiltinComponents({ previousComponents: components, fetchHtml, writeSource, log })
    expect(writeSource).toHaveBeenCalledTimes(2)
    expect(writeSource.mock.calls[0]).toEqual(writeSource.mock.calls[1])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('added: reward; missing: (none)'))
    expect(components).toEqual([...previousComponents, 'reward'])
  })
})
