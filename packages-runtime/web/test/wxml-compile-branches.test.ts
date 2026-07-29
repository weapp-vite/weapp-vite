import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { createDependencyContext } from '../src/compiler/wxml/dependency'

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
  return resolve(dirname(importer), raw)
}

const resolveWxsPath = (raw: string, importer: string) => resolve(dirname(importer), raw)

describe('compileWxml branch contract', () => {
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
      resolveTemplatePath: resolveTemplate,
      resolveWxsPath,
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
