import { afterEach, describe, expect, it, vi } from 'vitest'
import * as localPkg from '../runtime/localPkg'
import { createCompilerContextInstance } from './createCompilerContextInstance'

afterEach(() => vi.restoreAllMocks())

describe('compiler context package ownership', () => {
  it('resolves Oxc helper support once per context without sharing a missing result with the next context', () => {
    const original = localPkg.safeGetPackageInfoSync
    let installed = false
    const resolver = vi.spyOn(localPkg, 'safeGetPackageInfoSync').mockImplementation((name, options) => {
      if (name === '@oxc-project/runtime') {
        return installed ? { name, rootPath: 'oxc-runtime', packageJsonPath: 'oxc-runtime/package.json', packageJson: {}, version: '1.0.0' } : undefined
      }
      return original(name, options)
    })
    createCompilerContextInstance()
    expect(resolver.mock.calls.filter(([name]) => name === '@oxc-project/runtime')).toHaveLength(1)
    installed = true
    createCompilerContextInstance()
    expect(resolver.mock.calls.filter(([name]) => name === '@oxc-project/runtime')).toHaveLength(2)
  })
})
