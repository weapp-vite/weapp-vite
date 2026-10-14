import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { selectLoadedAddonFiles } from './addon.mjs'

describe('actually loaded native addon ownership', () => {
  const root = path.resolve('candidate-addon-fixture')
  const entry = path.join(root, 'packages/ast-native/index.js')
  const binary = path.join(root, 'packages/ast-native/platform.node')
  const module = { filename: binary, loaded: true }

  it('selects only the actually loaded candidate binary and records portable paths', () => {
    const modules = [
      module,
      { filename: path.join(root, 'packages/another-package/other.node'), loaded: true },
      { filename: path.join(root, 'packages/ast-native/unloaded.node'), loaded: false },
      { filename: entry, loaded: true },
    ]
    expect(selectLoadedAddonFiles(root, entry, modules)).toEqual(['packages/ast-native/index.js', 'packages/ast-native/platform.node'])
  })

  it.each([
    { modules: [] },
    { modules: [{ ...module, loaded: false }] },
    { modules: [module, { filename: path.join(root, 'packages/ast-native/another.node'), loaded: true }] },
  ])(
    'rejects absent or ambiguous actually loaded binary %#',
    ({ modules }) => {
      expect(() => selectLoadedAddonFiles(root, entry, modules)).toThrow('exactly one actually loaded')
    },
  )
})
