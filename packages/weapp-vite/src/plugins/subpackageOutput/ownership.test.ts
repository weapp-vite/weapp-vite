import type { PreRenderedChunk } from 'rolldown'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId } from '../../moduleGraph/protocol'
import { resolveAssetPackage, resolveChunkPackage } from './ownership'

const root = path.resolve('naming-fixture')
const srcRoot = path.join(root, 'src')
const context = { root, srcRoot, roots: () => ['packages/feature', 'packages/feature/nested', 'packages/other'] }

function chunk(ids: string[], facadeModuleId: string | null = null): PreRenderedChunk {
  return { name: 'chunk', moduleIds: ids, facadeModuleId, isEntry: false, isDynamicEntry: Boolean(facadeModuleId), exports: [] }
}

describe('subpackage naming ownership', () => {
  it('uses the full most-specific root and maps main files to empty', () => {
    expect(resolveChunkPackage(chunk([path.join(srcRoot, 'packages/feature/nested/value.ts')]), context)).toBe('packages/feature/nested')
    expect(resolveChunkPackage(chunk([path.join(srcRoot, 'main.ts')]), context)).toBe('')
  })
  it('projects logical and sidecar identities to their source owner', () => {
    const owner = path.join(srcRoot, 'packages/feature/page.vue')
    expect(resolveChunkPackage(chunk([createLogicalEntryId(owner, 'page')]), context)).toBe('packages/feature')
    expect(resolveChunkPackage(chunk([createSidecarModuleId(owner, owner, 'style')]), context)).toBe('packages/feature')
  })
  it('rejects multiple subpackage owners when a template needs one owner', () => {
    expect(() => resolveChunkPackage(chunk([
      path.join(srcRoot, 'packages/feature/value.ts'),
      path.join(srcRoot, 'packages/other/value.ts'),
    ]), context)).toThrow('唯一归属')
  })
  it('resolves Vite project-relative resource metadata and shared assets', () => {
    expect(resolveAssetPackage({ originalFileNames: ['src/packages/feature/font.woff2'] }, context)).toBe('packages/feature')
    expect(resolveAssetPackage({ originalFileNames: ['src/packages/feature/a.svg', 'src/packages/other/a.svg'] }, context)).toBe('')
    expect(resolveAssetPackage({ originalFileNames: ['src/main.svg', 'src/packages/feature/a.svg'] }, context)).toBe('')
  })
  it('does not silently place missing or unknown asset owners in the main package', () => {
    expect(() => resolveAssetPackage({ originalFileNames: [] }, context)).toThrow('originalFileNames')
    expect(() => resolveAssetPackage({ originalFileNames: ['\0unknown'] }, context)).toThrow('未知虚拟模块')
    expect(() => resolveChunkPackage(chunk(['\0unknown']), context)).toThrow('无法确定')
    expect(resolveChunkPackage(chunk(['\0rolldown/runtime.js']), context)).toBe('')
  })
})
