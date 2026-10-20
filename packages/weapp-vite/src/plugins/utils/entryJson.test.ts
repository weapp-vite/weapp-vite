import type { CompilerContext } from '../../context'
import { describe, expect, it } from 'vitest'
import { isVueEntryJsonPublisher } from './entryJson'

describe('entry JSON publication ownership', () => {
  it.each([
    ['page.vue', 'page', {}, true],
    ['component.vue', 'component', {}, true],
    ['page.tsx', 'page', {}, true],
    ['component.jsx', 'component', {}, true],
    ['page.tsx', 'page', { react: true }, false],
    ['page.jsx', 'page', { react: { renderMode: 'dynamic' } }, false],
    ['page.vue', 'page', { vue: { enable: false } }, false],
    ['app.vue', 'app', {}, false],
    ['plugin.vue', 'plugin', {}, false],
  ])('selects the actual publisher for %s (%s)', (id, type, weappViteConfig, expected) => {
    expect(isVueEntryJsonPublisher(id, type, { weappViteConfig } as CompilerContext['configService'])).toBe(expected)
  })

  it('keeps a native script with paired Vue configuration owned by core', () => {
    // 配对的 Vue 文件只被 loader 用于配置回退，不能据此跳过真实脚本的 JSON。
    expect(isVueEntryJsonPublisher('pages/paired/index.ts', 'page', {
      weappViteConfig: {},
    } as CompilerContext['configService'])).toBe(false)
  })
})
