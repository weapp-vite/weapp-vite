import type { OutputBundle } from 'rolldown'
import { Buffer } from 'node:buffer'
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

it('retains current native async targets and their transitive dependencies from inactive entries', () => {
  const marker = `__weapp_vite_require_async_target__${Buffer.from('shared/lazy.js').toString('base64url')}`
  const entries: [string, string[], boolean, string][] = [
    ['app.js', [], true, 'App({})'],
    ['pages/inactive/index.js', [], true, `exports.open = () => require.async("${marker}")`],
    ['shared/lazy.js', ['./runtime.js'], true, 'exports.value = require("./runtime.js").value'],
    ['shared/runtime.js', ['./leaf.js'], false, 'exports.value = require("./leaf.js").value'],
    ['shared/leaf.js', [], false, 'exports.value = "async-leaf"'],
    ['orphan.js', [], false, 'exports.value = "orphan"'],
  ]
  const bundle = Object.fromEntries(entries.map(([fileName, imports, isEntry, code]) => [fileName, { type: 'chunk', fileName, imports, isEntry, code }])) as OutputBundle
  const options = { rootFileName: 'app.js', requestGlobalsPrelude: false }
  const dependencies = collectNativePublicationDependencies(bundle, options)
  const emitted = new Set(['pages/active/index.js'])
  registerNativePublicationDependencies(bundle, dependencies, emitted, 'app.js')

  expect([...emitted].sort()).toEqual(['pages/active/index.js', 'shared/lazy.js', 'shared/leaf.js', 'shared/runtime.js'])

  delete bundle['pages/inactive/index.js']
  expect([...collectNativePublicationDependencies(bundle, options)]).toEqual(['app.js'])
})
