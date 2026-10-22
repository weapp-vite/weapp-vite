import type { OutputBundle } from 'rolldown'
import { expect, it } from 'vitest'
import { collectNativePublicationDependencies, registerNativePublicationDependencies } from './nativePublicationDependencies'

it('retains root transitive dependencies without forcing the root input into the dynamic emission plan', () => {
  const entries: [string, string[], boolean][] = [
    ['app.js', ['shared/root.js'], true],
    ['shared/root.js', ['./leaf.js'], false],
    ['shared/leaf.js', [], false],
    ['pages/index.js', [], true],
  ]
  const bundle = Object.fromEntries(entries.map(([fileName, imports, isEntry]) => [fileName, { type: 'chunk', fileName, imports, isEntry, code: '' }])) as OutputBundle
  const dependencies = collectNativePublicationDependencies(bundle, { rootFileName: 'app.js', requestGlobalsPrelude: false })
  const emitted = new Set(['pages/index.js'])

  registerNativePublicationDependencies(bundle, dependencies, emitted, 'app.js')

  expect([...dependencies].sort()).toEqual(['app.js', 'shared/leaf.js', 'shared/root.js'])
  expect([...emitted].sort()).toEqual(['pages/index.js', 'shared/leaf.js', 'shared/root.js'])
})
