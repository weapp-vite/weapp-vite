import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { createDependencyContext } from '../src/compiler/wxml/dependency'
import { renderer } from '../src/compiler/wxml/renderer'

vi.mock('../src/compiler/wxml/parser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/compiler/wxml/parser')>()
  return {
    ...actual,
    parseWxml(source: string) {
      if (source === 'THROW_ERROR') {
        throw new Error('invalid dependency')
      }
      if (source === 'THROW_EMPTY_ERROR') {
        // eslint-disable-next-line unicorn/error-message -- 覆盖空错误消息的 fallback。
        throw new Error('')
      }
      if (source === 'THROW_VALUE') {
        // eslint-disable-next-line no-throw-literal -- 覆盖 parser 抛出非 Error 值的兼容路径。
        throw 'invalid dependency'
      }
      return actual.parseWxml(source)
    },
  }
})

function resolveTemplate(raw: string, importer: string) {
  return posix.resolve(posix.dirname(importer), raw)
}

const resolveWxsPath = (raw: string, importer: string) => posix.resolve(posix.dirname(importer), raw)

function resolveNativePath(raw: string, importer: string) {
  return resolve(dirname(importer), raw)
}

describe('compileWxml branch contract', () => {
  it('does not render dependency sources during recursive dependency scanning', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-compile-render-'))
    const renderNodes = vi.spyOn(renderer, 'renderNodes')
    try {
      const entry = join(root, 'index.wxml')
      const dependency = join(root, 'part.wxml')
      await writeFile(dependency, '<view />')
      const result = compileWxml({
        id: entry,
        resolveTemplatePath: resolveNativePath,
        resolveWxsPath,
        source: '<include src="./part.wxml" /><view />',
      })

      expect(result.dependencies).toEqual([dependency])
      expect(renderNodes).toHaveBeenCalledTimes(1)
    }
    finally {
      renderNodes.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves dependency diagnostics, grouped order and skipped subtrees', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-dependency-semantics-'))
    try {
      const entry = join(root, 'index.wxml')
      const part = join(root, 'part.wxml')
      const imported = join(root, 'imported.wxml')
      const included = join(root, 'included.wxml')
      const external = join(root, 'external.wxs')
      await writeFile(part, `
        <map /><map />
        <wx-include src="./included.wxml" />
        <import src="./imported.wxml"><include src="./ignored-import.wxml" /></import>
        <wxs src="./ignored.wxs" />
        <wxs module="helpers"><include src="./ignored-inline.wxml" /></wxs>
        <wxs module="helpers" src="./external.wxs" />
      `)
      await Promise.all([imported, included, external].map(path => writeFile(path, '')))
      const resolvePath = vi.fn(resolveNativePath)
      const result = compileWxml({
        id: entry,
        resolveTemplatePath: resolvePath,
        resolveWxsPath: resolvePath,
        source: '<include src="./part.wxml" />',
      })

      expect(result.dependencies).toEqual([part, imported, included, external])
      expect(resolvePath.mock.calls.map(([raw]) => raw)).toEqual([
        './part.wxml',
        './included.wxml',
        './imported.wxml',
        './external.wxs',
      ])
      expect(result.warnings).toEqual([
        expect.stringContaining('小程序组件 <map>'),
        expect.stringContaining('WXS 模块名重复: helpers'),
      ])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not retain partial dependency edges when a resolver throws', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-dependency-failure-'))
    try {
      const part = join(root, 'part.wxml')
      await writeFile(part, '<include src="./ok.wxml" /><include src="./forbidden.wxml" />')
      const result = compileWxml({
        id: join(root, 'index.wxml'),
        resolveTemplatePath(raw, importer) {
          if (raw === './forbidden.wxml') {
            throw new Error('forbidden dependency')
          }
          return resolveNativePath(raw, importer)
        },
        resolveWxsPath: resolveNativePath,
        source: '<include src="./part.wxml" />',
      })

      expect(result.dependencies).toEqual([part])
      expect(result.warnings).toEqual([expect.stringContaining('forbidden dependency')])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not expand dependencies before the root renders successfully', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-render-failure-'))
    const renderNodes = vi.spyOn(renderer, 'renderNodes').mockImplementation(() => {
      throw new Error('render failed')
    })
    try {
      await writeFile(join(root, 'part.wxml'), '<include src="./leaf.wxml" />')
      const resolvePath = vi.fn(resolveNativePath)
      expect(() => compileWxml({
        id: join(root, 'index.wxml'),
        resolveTemplatePath: resolvePath,
        resolveWxsPath: resolvePath,
        source: '<include src="./part.wxml" />',
      })).toThrow('render failed')
      expect(resolvePath.mock.calls.map(([raw]) => raw)).toEqual(['./part.wxml'])
    }
    finally {
      renderNodes.mockRestore()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('handles visited dependencies, query imports and direct-only expansion', () => {
    const dependencyContext = createDependencyContext()
    const id = '/src/pages/index.wxml'
    const visited = '/src/pages/visited.wxml'
    dependencyContext.visited.add(visited)
    const result = compileWxml({
      dependencyContext,
      expandDependencies: true,
      id,
      resolveTemplatePath: resolveTemplate,
      resolveWxsPath,
      source: '<include src="./visited.wxml" /><import src="./card.wxml?raw=1" />',
    })
    expect(result.code).toContain('card.wxml?raw=1&weapp-web-template')
    expect(result.dependencies).toEqual(['/src/pages/card.wxml?raw=1', visited])

    const direct = compileWxml({
      dependencyContext: createDependencyContext(),
      expandDependencies: false,
      id,
      resolveTemplatePath: resolveTemplate,
      resolveWxsPath,
      source: '<include src="./visited.wxml" />',
    })
    expect(direct.dependencies).toEqual([visited])
  })

  it('reports only dependency parse errors with useful Error messages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weapp-web-compile-errors-'))
    const entry = join(root, 'index.wxml')
    const dependencies = [
      ['error.wxml', 'THROW_ERROR'],
      ['empty-error.wxml', 'THROW_EMPTY_ERROR'],
      ['value.wxml', 'THROW_VALUE'],
    ] as const
    await mkdir(root, { recursive: true })
    for (const [name, source] of dependencies) {
      await writeFile(join(root, name), source)
    }
    const result = compileWxml({
      id: entry,
      resolveTemplatePath: resolveNativePath,
      resolveWxsPath: resolveNativePath,
      source: dependencies.map(([name]) => `<include src="./${name}" />`).join(''),
    })
    expect(result.warnings).toEqual([
      expect.stringContaining('error.wxml invalid dependency'),
    ])
  })

  it('emits navigation warnings and both external and empty inline WXS modules', () => {
    const result = compileWxml({
      id: '/src/pages/index.wxml',
      navigationBar: { config: { title: 'App' } },
      resolveTemplatePath: resolveTemplate,
      resolveWxsPath,
      source: `
        <view>before metadata</view>
        <page-meta><navigation-bar title="First" /></page-meta>
        <page-meta><navigation-bar title="Second" /></page-meta>
        <wxs module="external" src="./external.wxs" />
        <wxs module="empty"></wxs>
      `,
    })
    expect(result.warnings?.some(warning => warning.includes('page-meta'))).toBe(true)
    expect(result.code).toContain(`from './external.wxs'`)
    expect(result.code).toContain('function __wxs_1() { return {} }')
  })
})
