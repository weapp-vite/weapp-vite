import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { createDependencyContext } from '../src/compiler/wxml/dependency'
import { renderer } from '../src/compiler/wxml/renderer'

function resolvePath(raw: string, importer: string) {
  return resolve(dirname(importer), raw)
}

describe('WXML dependency analysis', () => {
  it('collects the recursive graph without rendering dependency templates or bodies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-dependency-scan-'))
    const renderNodes = vi.spyOn(renderer, 'renderNodes')
    try {
      const card = join(root, 'card.wxml')
      const leaf = join(root, 'leaf.wxml')
      await writeFile(card, `
        <template name="card"><view>{{ card.title }}</view></template>
        <include src="./leaf.wxml" />
        <view wx:for="{{ items }}">{{ item }}</view>
      `)
      await writeFile(leaf, '<template name="leaf"><view /></template><view />')

      const result = compileWxml({
        id: join(root, 'index.wxml'),
        source: '<import src="./card.wxml" /><include src="./card.wxml" /><view />',
        resolveTemplatePath: resolvePath,
        resolveWxsPath: resolvePath,
      })

      expect(result.dependencies).toEqual([card, leaf])
      expect(result.warnings).toBeUndefined()
      expect(renderNodes).toHaveBeenCalledTimes(1)
      expect(result.code).toContain('from \'./card.wxml?weapp-web-template\'')
      expect(result.code).toContain('export function render(scope, ctx)')
      expect(result.code).not.toContain('card.title')
    }
    finally {
      renderNodes.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves diagnostics, grouped dependency order and special-node subtree boundaries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-dependency-boundaries-'))
    try {
      const entry = join(root, 'index.wxml')
      const part = join(root, 'part.wxml')
      const imported = join(root, 'imported.wxml')
      const included = join(root, 'included.wxml')
      const external = join(root, 'external.wxs')
      await writeFile(part, `
        <map /><map />
        <template name="card"><view><wx-include src="./included.wxml" /></view></template>
        <import src="./imported.wxml"><include src="./ignored-import.wxml" /></import>
        <include src="./unresolved.wxml" />
        <wxs src="./ignored.wxs" />
        <wxs module="helpers"><include src="./ignored-inline.wxml" /></wxs>
        <wxs module="helpers" src="./external.wxs" />
      `)
      await Promise.all([imported, included, external].map(path => writeFile(path, '')))
      const resolveDependency = vi.fn((raw: string, importer: string) => raw === './unresolved.wxml'
        ? undefined
        : resolvePath(raw, importer))
      const result = compileWxml({
        id: entry,
        source: '<include src="./part.wxml" />',
        resolveTemplatePath: resolveDependency,
        resolveWxsPath: resolveDependency,
      })

      expect(result.dependencies).toEqual([part, imported, included, external])
      expect(resolveDependency.mock.calls.map(([raw]) => raw)).toEqual([
        './part.wxml',
        './included.wxml',
        './imported.wxml',
        './unresolved.wxml',
        './external.wxs',
      ])
      expect(result.warnings).toEqual([
        expect.stringContaining('小程序组件 <map>'),
        expect.stringContaining('无法解析模板依赖: ./unresolved.wxml'),
        expect.stringContaining('WXS 模块名重复: helpers'),
      ])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('continues after a resolver failure without retaining partial edges or active nodes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-dependency-failure-'))
    try {
      const part = join(root, 'part.wxml')
      const sibling = join(root, 'sibling.wxml')
      const leaf = join(root, 'leaf.wxml')
      await writeFile(part, '<include src="./ok.wxml" /><include src="./forbidden.wxml" />')
      await writeFile(sibling, '<include src="./leaf.wxml" />')
      await writeFile(leaf, '<view />')
      const dependencyContext = createDependencyContext()
      const result = compileWxml({
        id: join(root, 'index.wxml'),
        source: '<include src="./part.wxml" /><include src="./sibling.wxml" />',
        dependencyContext,
        expandDependencies: true,
        resolveTemplatePath(raw, importer) {
          if (raw === './forbidden.wxml') {
            throw new Error('forbidden dependency')
          }
          return resolvePath(raw, importer)
        },
        resolveWxsPath: resolvePath,
      })

      expect(result.dependencies).toEqual([part, sibling, leaf])
      expect(result.warnings).toEqual([expect.stringContaining('forbidden dependency')])
      expect(dependencyContext.active.size).toBe(0)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not expand dependencies before the root renders successfully', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-root-render-failure-'))
    const renderNodes = vi.spyOn(renderer, 'renderNodes').mockImplementation(() => {
      throw new Error('render failed')
    })
    try {
      await writeFile(join(root, 'part.wxml'), '<include src="./leaf.wxml" />')
      const resolveDependency = vi.fn(resolvePath)
      expect(() => compileWxml({
        id: join(root, 'index.wxml'),
        source: '<include src="./part.wxml" />',
        resolveTemplatePath: resolveDependency,
        resolveWxsPath: resolveDependency,
      })).toThrow('render failed')
      expect(resolveDependency.mock.calls.map(([raw]) => raw)).toEqual(['./part.wxml'])
    }
    finally {
      renderNodes.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not register root dependencies when navigation configuration throws', () => {
    const dependencyContext = createDependencyContext()
    const resolveDependency = vi.fn(resolvePath)
    expect(() => compileWxml({
      id: join('src', 'index.wxml'),
      source: '<include src="./part.wxml" />',
      dependencyContext,
      navigationBar: {
        config: {
          get title(): string {
            throw new Error('navigation configuration failed')
          },
        },
      },
      resolveTemplatePath: resolveDependency,
      resolveWxsPath: resolveDependency,
    })).toThrow('navigation configuration failed')

    expect(resolveDependency).toHaveBeenCalledTimes(1)
    expect(dependencyContext.dependencies).toEqual([])
    expect(dependencyContext.dependencySet.size).toBe(0)
    expect(dependencyContext.visited.size).toBe(0)
    expect(dependencyContext.active.size).toBe(0)
  })
})
