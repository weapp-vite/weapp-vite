import type { PackageReport } from './types'
import { describe, expect, it } from 'vitest'
import { createArtifactAnalysis } from './artifacts'

function packages(file = 'renamed.js'): PackageReport[] {
  return [{
    id: '__main__',
    label: '主包',
    type: 'main',
    files: [{
      file,
      type: 'chunk',
      from: 'main',
      size: 100,
      modules: [
        { id: 'runtime', source: 'runtime', sourceType: 'node_modules', bytes: 120 },
        { id: 'business', source: 'pages/index.ts', sourceType: 'src', bytes: 80 },
      ],
    }],
  }]
}

const resolveOwner = (id: string) => id === 'runtime' ? { name: 'wevu', version: '7.4.0' } : undefined

describe('artifact accounting contract', () => {
  it('classifies mixed chunks from module ownership and bounds estimated bytes after minification', () => {
    const result = createArtifactAnalysis(packages(), resolveOwner)
    expect(result.files[0]).toMatchObject({
      file: 'renamed.js',
      packageId: '__main__',
      role: 'mixed',
      bytes: 100,
      estimation: 'rendered-length-proportional',
      unattributedBytes: 0,
      runtimeEstimatedBytes: 60,
    })
    expect(result.files[0]?.modules.map(module => module.estimatedBytes)).toEqual([60, 40])
    expect(result.files[0]?.modules[0]).toMatchObject({ package: { name: 'wevu', version: '7.4.0' }, category: 'runtime' })
    expect(result.runtime).toEqual({ estimatedBytes: 60, upperBoundBytes: 100, unknownFiles: [] })
    expect(createArtifactAnalysis(packages('split-name.js'), resolveOwner).runtime).toEqual(result.runtime)
  })

  it('does not infer runtime ownership from chunk names or business paths', () => {
    const input = packages('wevu-runtime.js')
    input[0]!.files[0]!.modules = [{ id: 'business', source: 'wevu/router.ts', sourceType: 'src', bytes: 20 }]
    const result = createArtifactAnalysis(input, resolveOwner)
    expect(result.files[0]).toMatchObject({ role: 'application', unattributedBytes: 80, runtimeEstimatedBytes: 0 })
    expect(result.runtime.upperBoundBytes).toBe(0)
  })

  it('preserves unknown accounting and excludes zero-length eliminated modules', () => {
    const input = packages()
    input[0]!.files[0]!.modules = [{ id: 'runtime', source: 'runtime', sourceType: 'node_modules', bytes: 0 }]
    const result = createArtifactAnalysis(input, resolveOwner)
    expect(result.files[0]).toMatchObject({ role: 'unknown', unattributedBytes: 100 })
    expect(result.runtime.unknownFiles).toEqual(['renamed.js'])
    expect(result.runtime.estimatedBytes).toBe(0)
  })

  it('counts physical files once and exposes duplicate module estimates separately', () => {
    const input = packages()
    input.push({ id: 'sub', label: 'sub', type: 'subPackage', files: [{ ...input[0]!.files[0]!, file: 'sub/copy.js' }] })
    const result = createArtifactAnalysis(input, resolveOwner)
    expect(result.totalBytes).toBe(200)
    expect(result.duplicateEstimatedBytes).toBe(100)
    expect(result.runtime.upperBoundBytes).toBe(200)
    expect(result.files.every(file => file.packageId)).toBe(true)
  })

  it('rejects missing bytes and conflicting physical placements instead of reporting zero', () => {
    expect(() => createArtifactAnalysis([], resolveOwner)).toThrow('未生成')
    const input = packages()
    delete input[0]!.files[0]!.size
    expect(() => createArtifactAnalysis(input, resolveOwner)).toThrow('renamed.js')
    const conflict = packages()
    conflict.push({ ...conflict[0]!, id: 'other' })
    expect(() => createArtifactAnalysis(conflict, resolveOwner)).toThrow('renamed.js')
  })

  it('preserves virtual module shares and flags untracked JavaScript assets', () => {
    const input = packages()
    input[0]!.files[0]!.moduleRenderedLength = 400
    input[0]!.files.push({ file: 'vendor.js', type: 'asset', from: 'main', size: 30 })
    const result = createArtifactAnalysis(input, resolveOwner)
    expect(result.files.find(file => file.file === 'renamed.js')).toMatchObject({ runtimeEstimatedBytes: 30, unattributedBytes: 50 })
    expect(result.runtime.unknownFiles).toEqual(['vendor.js'])
  })
})
