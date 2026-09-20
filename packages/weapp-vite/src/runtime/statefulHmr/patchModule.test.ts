import type { MutableCompilerContext } from '../../context'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import vm from 'node:vm'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrPatchImportResolver, transformStatefulHmrPatchImports } from './patchModule'
import { renderBatch } from './transport'

function createContext() {
  const cwd = path.resolve('patch-import-fixture')
  return {
    configService: {
      cwd,
      absoluteSrcRoot: path.join(cwd, 'src'),
      packageJson: { dependencies: { 'native-controls': '*' } },
      weappViteConfig: { npm: { include: ['native-controls'] } },
    },
    scanService: { subPackageMap: new Map() },
  } as unknown as MutableCompilerContext
}

describe('stateful patch external modules', () => {
  it('executes external namespace imports with the real runtime interop inside a batch', () => {
    const callbacks: Array<() => unknown> = []
    const requested: string[] = []
    const exports = { default: { show: () => 'normalized-esm' }, ActionSheetTheme: { Grid: 'grid' }, __esModule: true }
    const context = vm.createContext({
      require(id: string) {
        requested.push(id)
        return exports
      },
      save: (callback: () => unknown) => callbacks.push(callback),
      __WEAPP_VITE_STATEFUL_HMR_CLIENT__: { receiveBatch: (_metadata: unknown, apply: () => void) => apply() },
    })
    vm.runInContext(createStatefulHmrRolldownRuntimeSource(), context)
    const original = 'import * as controls from "native-controls/action-sheet/index"; save(() => [controls.default.show(), controls.ActionSheetTheme.Grid]);'
    const transformed = transformStatefulHmrPatchImports(original, {
      filename: 'update.js',
      resolveImport: createStatefulHmrPatchImportResolver(createContext(), 'update.js'),
    })
    const batch = (code: string) => renderBatch({
      buildId: 'build',
      fromVersion: 0,
      targetVersion: 1,
      deltas: [{ changedIds: ['src/pages/index.ts'], code }],
    }, 'nonce')

    expect(() => new vm.Script(batch(original))).toThrow()
    vm.runInContext(batch(transformed), context)
    expect(requested).toEqual(['../miniprogram_npm/native-controls/action-sheet/index'])
    expect(callbacks[0]!()).toEqual(['normalized-esm', 'grid'])
  })

  it('keeps retained delta bindings isolated and preserves CommonJS default interoperability', () => {
    const callbacks: Array<() => unknown> = []
    const context = vm.createContext({
      require: (id: string) => ({ show: () => id }),
      save: (callback: () => unknown) => callbacks.push(callback),
      __WEAPP_VITE_STATEFUL_HMR_CLIENT__: { receiveBatch: (_metadata: unknown, apply: () => void) => apply() },
    })
    vm.runInContext(createStatefulHmrRolldownRuntimeSource(), context)
    const code = 'import * as controls from "native-controls"; var version = controls.default.show(); save(() => version);'
    const deltas = ['first', 'second'].map(value => ({
      changedIds: ['src/page.ts'],
      code: transformStatefulHmrPatchImports(code, { filename: 'update.js', resolveImport: () => value }),
    }))
    vm.runInContext(renderBatch({ buildId: 'build', fromVersion: 0, targetVersion: 2, deltas }, 'nonce'), context)
    expect(callbacks.map(callback => callback())).toEqual(['first', 'second'])
  })

  it('resolves external npm imports from the owning subpackage and rebases local chunks', () => {
    const ctx = createContext()
    ctx.scanService!.subPackageMap.set('feature', { subPackage: { root: 'feature', dependencies: ['native-controls'] } } as never)
    const resolve = createStatefulHmrPatchImportResolver(ctx, 'patches/update.js')
    expect(resolve('native-controls', ['src/feature/page.ts'])).toBe('../feature/miniprogram_npm/native-controls/index')
    expect(resolve('../shared.js', [])).toBe('../shared.js')
    expect(resolve('/common.js', [])).toBe('../common.js')
    expect(resolve('unmanaged-external', [])).toBe('unmanaged-external')
    expect(() => resolve('native-controls', ['src/feature/page.ts', 'src/page.ts'])).toThrow('different npm roots')
    expect(() => resolve('native-controls', [])).toThrow('no unambiguous factory owner')
  })

  it('keeps physical factory importers in their subpackage when the configured root is an alias', async () => {
    const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'patch-import-identity-')))
    const physicalRoot = path.join(temporary, 'project')
    const aliasRoot = path.join(temporary, 'linked-project')
    const importer = path.join(physicalRoot, 'src/feature/page.ts')
    await mkdir(path.dirname(importer), { recursive: true })
    await writeFile(importer, 'Page({})')
    await symlink(physicalRoot, aliasRoot, 'junction')
    try {
      const ctx = createContext()
      ctx.configService!.cwd = aliasRoot
      ctx.configService!.absoluteSrcRoot = path.join(aliasRoot, 'src')
      ctx.scanService!.subPackageMap.set('feature', { subPackage: { root: 'feature', dependencies: ['native-controls'] } } as never)
      const resolve = createStatefulHmrPatchImportResolver(ctx, 'update.js')
      expect(resolve('native-controls', [importer])).toBe('../feature/miniprogram_npm/native-controls/index')
      expect(resolve('native-controls', ['src/feature/page.ts'])).toBe('../feature/miniprogram_npm/native-controls/index')
    }
    finally {
      await rm(temporary, { recursive: true, force: true })
    }
  })

  it('uses the invalidated factory importer even when a shared dependency triggered the patch', () => {
    const ctx = createContext()
    ctx.scanService!.subPackageMap.set('feature', { subPackage: { root: 'feature', dependencies: ['native-controls'] } } as never)
    const source = [
      'import * as controls from "native-controls";',
      '__rolldown_runtime__.registerFactory("src/shared.ts", "esm", () => {});',
      '__rolldown_runtime__.registerFactory("src/feature/page.ts", "esm", () => controls.default.show());',
    ].join('\n')
    const options = { filename: 'update.js', resolveImport: createStatefulHmrPatchImportResolver(ctx, 'update.js') }
    const output = transformStatefulHmrPatchImports(source, options)
    expect(output).toContain('require("../feature/miniprogram_npm/native-controls/index")')
    expect(() => transformStatefulHmrPatchImports(`${source}\n__rolldown_runtime__.registerFactory("src/page.ts", "esm", () => controls.default.show());`, options))
      .toThrow('different npm roots')
  })

  it('preserves side effects and rejects unsupported module syntax before publication', () => {
    const options = { filename: 'update.js', resolveImport: () => '../setup.js' }
    const code = transformStatefulHmrPatchImports('import "setup"; register();', options)
    expect(code).toContain('require("../setup.js");')
    expect(code).toContain('register();')
    expect(() => transformStatefulHmrPatchImports('export const value = 1;', options)).toThrow('register exports through the runtime')
    expect(() => transformStatefulHmrPatchImports('import value from "setup";', options)).toThrow('Unsupported Stateful HMR external import')
  })
})
