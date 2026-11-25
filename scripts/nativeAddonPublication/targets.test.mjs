import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getNativeTargetForRuntime, nativeTargets, packageManifestForTarget } from './targets.mjs'
import { validateNativePublication } from './validate.mjs'

describe('native addon publication targets', () => {
  it('declares exactly the six supported runtime targets', () => {
    expect(nativeTargets.map(target => target.id)).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'linux-arm64-gnu',
      'linux-x64-gnu',
      'win32-arm64-msvc',
      'win32-x64-msvc',
    ])
    expect(getNativeTargetForRuntime('linux', 'x64', 'glibc').id).toBe('linux-x64-gnu')
    expect(() => getNativeTargetForRuntime('linux', 'x64', 'musl')).toThrow('musl')
  })

  it('generates platform package metadata with an exact binary allowlist', () => {
    const target = nativeTargets.find(item => item.id === 'linux-x64-gnu')
    expect(packageManifestForTarget(target, '0.2.6')).toMatchObject({
      name: '@weapp-vite/ast-native-linux-x64-gnu',
      main: './weapp_vite_ast_native.linux-x64-gnu.node',
      files: ['weapp_vite_ast_native.linux-x64-gnu.node'],
      os: ['linux'],
      cpu: ['x64'],
      libc: ['glibc'],
    })
  })

  it('validates root and all platform package manifests', async () => {
    const result = await validateNativePublication()
    expect(result.targets).toHaveLength(6)
    const root = JSON.parse(await readFile(path.resolve('packages/ast-native/package.json'), 'utf8'))
    expect(Object.keys(root.optionalDependencies)).toHaveLength(6)
  })

  it('validates an explicit checkout root when the driver is outside the candidate', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'native-publication-'))
    try {
      const packageFiles = [
        'packages/ast-native/package.json',
        ...nativeTargets.map(target => `${target.packageDirectory}/package.json`),
      ]
      await Promise.all(packageFiles.map(async (file) => {
        const destination = path.join(root, file)
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, await readFile(path.resolve(file)))
      }))
      await expect(validateNativePublication({ root, targetId: 'linux-x64-gnu' })).resolves.toMatchObject({
        targets: ['linux-x64-gnu'],
      })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
