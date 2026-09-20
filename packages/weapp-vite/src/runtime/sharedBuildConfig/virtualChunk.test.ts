import { describe, expect, it } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId } from '../../moduleGraph/protocol'
import { resolveVirtualChunkFileName } from './virtualChunk'

describe('virtual chunk output names', () => {
  it('keeps names bounded and independent of checkout depth', () => {
    const deepRoot = `/project/${'nested/'.repeat(40)}src`
    const source = 'components/card/index.vue'
    const shallow = resolveVirtualChunkFileName({ facadeModuleId: createLogicalEntryId(`/project/src/${source}`, 'component') }, '/project/src')
    const deep = resolveVirtualChunkFileName({ facadeModuleId: createLogicalEntryId(`${deepRoot}/${source}`, 'component') }, deepRoot)

    expect(deep).toBe(shallow)
    expect(deep!.length).toBeLessThan(100)
    expect(deep).not.toContain('project')
    expect(deep).not.toBe(resolveVirtualChunkFileName({ facadeModuleId: createLogicalEntryId(`${deepRoot}/other.vue`, 'component') }, deepRoot))
  })

  it('distinguishes sidecars with different owners and leaves ordinary modules unchanged', () => {
    const first = resolveVirtualChunkFileName({ moduleIds: [createSidecarModuleId('/src/a.ts', '/src/shared.wxml', 'template')] }, '/src')
    const second = resolveVirtualChunkFileName({ moduleIds: [createSidecarModuleId('/src/b.ts', '/src/shared.wxml', 'template')] }, '/src')
    expect(first).toBeDefined()
    expect(first).not.toBe(second)
    expect(resolveVirtualChunkFileName({ moduleIds: ['/src/index.ts'] }, '/src')).toBeUndefined()
    expect(resolveVirtualChunkFileName({ moduleIds: ['/src/a.ts', '/src/b.ts'] }, '/src')).toBeUndefined()
  })

  it('uses the same relative identity for Windows and POSIX paths', () => {
    const windowsRoot = 'C:\\workspace\\src'
    const windowsEntry = createLogicalEntryId(`${windowsRoot}\\pages\\index.vue`, 'page')
    const posixEntry = createLogicalEntryId('/workspace/src/pages/index.vue', 'page')
    expect(resolveVirtualChunkFileName({ facadeModuleId: windowsEntry }, windowsRoot))
      .toBe(resolveVirtualChunkFileName({ facadeModuleId: posixEntry }, '/workspace/src'))

    const windowsSidecar = createSidecarModuleId(`${windowsRoot}\\pages\\index.vue`, `${windowsRoot}\\styles\\shared.wxss`, 'style')
    const posixSidecar = createSidecarModuleId('/workspace/src/pages/index.vue', '/workspace/src/styles/shared.wxss', 'style')
    expect(resolveVirtualChunkFileName({ moduleIds: [windowsSidecar] }, windowsRoot))
      .toBe(resolveVirtualChunkFileName({ moduleIds: [posixSidecar] }, '/workspace/src'))
  })
})
