import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectLoadedAddonFiles } from './addon.mjs'

describe('actually loaded native addon ownership', () => {
  const root = path.resolve('candidate-addon-fixture')
  const entry = path.join(root, 'packages/ast-native/index.js')
  const binary = path.join(root, 'packages/ast-native-linux-x64-gnu/weapp_vite_ast_native.linux-x64-gnu.node')
  const module = { filename: binary, loaded: true }

  it('selects only the actually loaded candidate binary and records portable paths', () => {
    const modules = [
      module,
      { filename: path.join(root, 'packages/another-package/other.node'), loaded: true },
      { filename: path.join(root, 'packages/ast-native/unloaded.node'), loaded: false },
      { filename: entry, loaded: true },
    ]
    expect(selectLoadedAddonFiles(root, entry, modules)).toEqual([
      'packages/ast-native/index.js',
      'packages/ast-native-linux-x64-gnu/weapp_vite_ast_native.linux-x64-gnu.node',
    ])
  })

  it.each([
    { modules: [] },
    { modules: [{ ...module, loaded: false }] },
    { modules: [module, { filename: path.join(root, 'packages/ast-native-win32-x64-msvc/weapp_vite_ast_native.win32-x64-msvc.node'), loaded: true }] },
  ])(
    'rejects absent or ambiguous actually loaded binary %#',
    ({ modules }) => {
      expect(() => selectLoadedAddonFiles(root, entry, modules)).toThrow('exactly one actually loaded')
    },
  )
})
