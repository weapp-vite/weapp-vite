import { REQUEST_GLOBAL_INSTALLER_MARKER } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { FULL_REQUEST_GLOBAL_TARGETS } from '../../../../../runtime/config/internal/injectRequestGlobals'
import { findRequestGlobalsInstaller } from './installer'

describe('stable Web Runtime installer identity', () => {
  it.each([
    `function renamed() {} Object.defineProperty(renamed, ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}, { value: true });`,
    `const marker = ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}; const renamed = () => {}; Object.defineProperty(renamed, marker, { value: true });`,
    `const marker = ${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}; const alias = marker; function renamed() {} renamed[alias] = true;`,
  ])('locates a renamed installer through an explicit marker', (code) => {
    expect(findRequestGlobalsInstaller(code)).toBe('renamed')
  })

  it.each([
    'function renamed() {} export { renamed as installWebRuntimeGlobals };',
    'export function installWebRuntimeGlobals() {}',
    'const renamed = () => {}; exports.installWebRuntimeGlobals = renamed;',
    'function renamed() {} Object.defineProperty(exports, "installWebRuntimeGlobals", { get() { return renamed; } });',
  ])('accepts a public installer export association', (code) => {
    expect(findRequestGlobalsInstaller(code)).toBe(code.includes('export function') ? 'installWebRuntimeGlobals' : 'renamed')
  })

  it('does not infer installer identity from global names in an unrelated function', () => {
    const code = `function unrelated() { return ${JSON.stringify(FULL_REQUEST_GLOBAL_TARGETS)}; }`
    expect(findRequestGlobalsInstaller(code)).toBeNull()
  })

  it('ignores markers on values that are not local functions and invalid source', () => {
    expect(findRequestGlobalsInstaller(`const value = {}; value[${JSON.stringify(REQUEST_GLOBAL_INSTALLER_MARKER)}] = true;`)).toBeNull()
    expect(findRequestGlobalsInstaller('function {')).toBeNull()
  })
})
