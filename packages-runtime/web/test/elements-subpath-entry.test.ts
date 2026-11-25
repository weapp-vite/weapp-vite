// @vitest-environment happy-dom

import fs from 'node:fs'
import path from 'node:path'
import {
  defineElements,
  NATIVE_COMPONENT_STYLE,
  ROUTE_COUPLED_WEB_TAGS,
  setupRpx,
  setupWebViewport,
  WEB_VISUAL_COMPONENT_TAGS,
} from '@weapp-vite/web/elements'
import { describe, expect, it } from 'vitest'
import { VISUAL_WEB_COMPONENT_CONSTRUCTORS } from '../src/runtime/nativeComponents/registry'
import { getRuntimeRpxSize } from '../src/runtime/rpx'
import { NATIVE_COMPONENT_DESCRIPTORS } from '../src/shared/nativeComponents'

const srcDir = path.resolve(import.meta.dirname, '../src')

/**
 * 递归收集入口文件的运行时 import 图，类型-only 说明符会被剔除。
 */
function collectRuntimeGraph(entryFile: string) {
  const files = new Set<string>()
  const externals = new Set<string>()
  const stack = [entryFile]

  function resolveLocal(from: string, specifier: string) {
    const base = path.resolve(path.dirname(from), specifier)
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate) && !candidate.includes('.test.')) {
        return candidate
      }
    }
    return undefined
  }

  while (stack.length > 0) {
    const file = stack.pop() as string
    if (files.has(file)) {
      continue
    }
    files.add(file)
    const source = fs.readFileSync(file, 'utf8').replace(/import\s+type\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '')
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)[^;]{0,400}?from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) {
        const segments = specifier.split('/')
        externals.add(segments.slice(0, specifier.startsWith('@') ? 2 : 1).join('/'))
        continue
      }
      const resolved = resolveLocal(file, specifier)
      if (resolved) {
        stack.push(resolved)
      }
    }
  }

  return {
    externals: [...externals].sort(),
    relativeFiles: [...files].map(file => path.relative(srcDir, file).split(path.sep).join('/')).sort(),
  }
}

describe('elements 子路径入口', () => {
  const graph = collectRuntimeGraph(path.join(srcDir, 'elements.ts'))

  it('不引入构建期与小程序页面层模块', () => {
    const forbiddenDirs = ['compiler/', 'plugin/', 'css/', 'runtime/polyfill/', 'runtime/component/', 'runtime/legacyTemplate/']
    const polluted = graph.relativeFiles.filter(file => forbiddenDirs.some(dir => file.startsWith(dir)))
    expect(polluted).toEqual([])
    expect(graph.relativeFiles).not.toContain('runtime/index.ts')
  })

  it('不依赖打包器与响应式库', () => {
    const forbiddenExternals = [
      '@babel/parser',
      '@babel/traverse',
      '@babel/types',
      '@weapp-vite/wxml',
      'domhandler',
      'esbuild',
      'lit',
      'magic-string',
      'node:fs',
      'postcss',
      'rolldown',
      'vite',
      'wevu',
    ]
    const polluted = graph.externals.filter(name => forbiddenExternals.includes(name))
    expect(polluted).toEqual([])
  })

  it('注册表覆盖除路由耦合标签外的全部描述符', () => {
    const descriptorTags = NATIVE_COMPONENT_DESCRIPTORS.map(descriptor => descriptor.webTag)
    expect([...WEB_VISUAL_COMPONENT_TAGS].sort()).toEqual(
      descriptorTags.filter(tag => !ROUTE_COUPLED_WEB_TAGS.includes(tag as typeof ROUTE_COUPLED_WEB_TAGS[number])).sort(),
    )
  })

  it('按需注册只定义请求的标签', () => {
    defineElements(['weapp-view'])
    expect(customElements.get('weapp-view')).toBe(VISUAL_WEB_COMPONENT_CONSTRUCTORS['weapp-view'])
    expect(customElements.get('weapp-swiper')).toBeUndefined()
  })

  it('挂载元素后注入原生组件基础样式', () => {
    document.body.append(document.createElement('weapp-view'))
    const style = document.head.querySelector('#weapp-web-native-component-style')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('weapp-view')
  })

  it('全量注册跳过路由耦合标签且类身份一致', () => {
    defineElements()
    for (const tag of WEB_VISUAL_COMPONENT_TAGS) {
      expect(customElements.get(tag)).toBe(VISUAL_WEB_COMPONENT_CONSTRUCTORS[tag as keyof typeof VISUAL_WEB_COMPONENT_CONSTRUCTORS])
    }
    expect(customElements.get('weapp-navigator')).toBeUndefined()
  })

  it('不安装小程序全局对象', () => {
    const globalNames = ['wx', 'getApp', 'getCurrentPages'] as const
    for (const name of globalNames) {
      expect((globalThis as unknown as Record<string, unknown>)[name]).toBeUndefined()
    }
  })

  it('导出的样式常量与注入内容一致', () => {
    expect(NATIVE_COMPONENT_STYLE).toContain('weapp-swiper')
    expect(NATIVE_COMPONENT_STYLE).toContain('weapp-scroll-view')
  })

  it('rpx 的 CSS 变量与 JS 换算共用同一视口基准', () => {
    setupWebViewport({ mode: 'responsive' })
    setupRpx({ designWidth: 375, varName: '--contract-rpx' })
    expect(document.documentElement.getAttribute('data-weapp-viewport-mode')).toBe('responsive')
    expect(getRuntimeRpxSize()).toBeGreaterThan(0)
    expect(document.documentElement.style.getPropertyValue('--contract-rpx'))
      .toBe(`${getRuntimeRpxSize()}px`)
  })
})
