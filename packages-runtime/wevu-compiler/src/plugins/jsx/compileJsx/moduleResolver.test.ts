import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CompilerDiagnosticCodes } from '../../../types/diagnostics'
import { createJsxModuleResolver } from './moduleResolver'
import { compileJsxTemplate } from './template'

describe('createJsxModuleResolver', () => {
  it('resolves extensionless jsx modules, index modules and named exports', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-resolver-'))
    const importer = path.join(root, 'page.tsx')
    await writeFile(importer, 'export default {}')
    await writeFile(path.join(root, 'panel.tsx'), 'export const panel = <view>panel</view>')
    await mkdir(path.join(root, 'group'))
    await writeFile(path.join(root, 'group', 'index.jsx'), 'export const item = <text>item</text>')

    const resolver = createJsxModuleResolver()
    const panel = resolver.resolveImport(importer, './panel', 'panel')
    expect(panel?.params).toEqual([])
    expect(panel?.expression.type).toBe('JSXElement')

    const item = resolver.resolveImport(importer, './group', 'item')
    expect(item?.expression.type).toBe('JSXElement')
  })

  it('attributes imported JSX diagnostics to the dependency source', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-resolver-'))
    const importer = path.join(root, 'page.tsx')
    const dependency = path.join(root, 'shared.tsx')
    const dependencySource = 'export const panel = <Teleport />'
    await writeFile(dependency, dependencySource)

    const result = compileJsxTemplate(
      'import { panel } from "./shared"; export default { render() { return panel } }',
      importer,
    )
    const diagnostic = result.diagnostics.find(item =>
      item.code === CompilerDiagnosticCodes.jsxUnsupportedSyntax,
    )

    expect(diagnostic?.filename).toBe(dependency)
    expect(diagnostic?.loc?.start.offset).toBe(dependencySource.indexOf('<Teleport'))
    expect(dependencySource.slice(
      diagnostic?.loc?.start.offset,
      diagnostic?.loc?.end.offset,
    )).toBe('<Teleport />')
  })

  it('follows default, namespace and barrel re-exports and substitutes factory params', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-resolver-'))
    const importer = path.join(root, 'page.tsx')
    const shared = path.join(root, 'shared.tsx')
    const barrel = path.join(root, 'barrel.tsx')
    await writeFile(importer, 'export default {}')
    await writeFile(shared, [
      'export const panel = (title: string) => <view><text>{title}</text></view>',
      'export default <text>default</text>',
    ].join('\n'))
    await writeFile(barrel, 'export { panel } from "./shared"')
    const resolver = createJsxModuleResolver()

    expect(resolver.resolveImport(importer, './barrel', 'panel')?.params).toEqual(['title'])
    expect(resolver.resolveImport(importer, './shared', 'default')?.expression.type).toBe('JSXElement')
    expect(resolver.resolveImport(importer, './shared', 'missing')).toBeUndefined()
  })

  it('warns on cycles and invalid or external imports without throwing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-resolver-'))
    const importer = path.join(root, 'page.tsx')
    await writeFile(importer, 'export default {}')
    await writeFile(path.join(root, 'a.tsx'), 'export { value } from "./b"')
    await writeFile(path.join(root, 'b.tsx'), 'export { value } from "./a"')
    const warnings: string[] = []
    const resolver = createJsxModuleResolver(message => warnings.push(message))

    expect(resolver.resolveImport(importer, './a', 'value')).toBeUndefined()
    expect(warnings.some(message => message.includes('循环引用'))).toBe(true)
    expect(resolver.resolveImport(importer, 'wevu', 'Fragment')).toBeUndefined()
  })

  it('invalidates its source cache when a shared module changes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-resolver-'))
    const importer = path.join(root, 'page.tsx')
    const shared = path.join(root, 'shared.tsx')
    await writeFile(importer, 'export default {}')
    await writeFile(shared, 'export const value = <text>before</text>')
    const resolver = createJsxModuleResolver()

    expect((resolver.resolveImport(importer, './shared', 'value')?.expression as any).children[0].value).toBe('before')
    await writeFile(shared, 'export const value = <text>after</text>')
    expect((resolver.resolveImport(importer, './shared', 'value')?.expression as any).children[0].value).toBe('after')
  })
})
