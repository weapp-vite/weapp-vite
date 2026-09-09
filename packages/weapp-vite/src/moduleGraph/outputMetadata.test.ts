import { win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseGraphOutputModuleId, resolveGraphOutputOwner } from './outputMetadata'
import { createLogicalEntryId, createSidecarModuleId } from './protocol'

describe('graph output metadata ownership', () => {
  const owner = 'C:/project/src/pages/index/index.ts'

  it('recovers Windows cross-drive Vite originalFileNames', () => {
    const id = createLogicalEntryId(owner, 'page')
    const metadata = win32.relative('C:\\project', win32.resolve('D:\\workspace', id)).replaceAll('\\', '/').replaceAll('\0', '')
    expect(win32.isAbsolute(metadata)).toBe(true)
    expect(resolveGraphOutputOwner(metadata)).toBe(owner)
  })

  it('recovers relative Vite originalFileNames and direct facades', () => {
    const id = createLogicalEntryId(owner, 'page')
    expect(resolveGraphOutputOwner(`../../${id}`)).toBe(owner)
    expect(resolveGraphOutputOwner(id)).toBe(owner)
  })

  it('keeps sidecar style assets owned by their script entry', () => {
    const id = createSidecarModuleId(owner, 'C:/project/src/styles/shared.css', 'style')
    const asset = `weapp_vite_external/graph/${id.replace(/\.js$/, '.wxss')}`
    expect(parseGraphOutputModuleId(asset)).toBe(id)
    expect(resolveGraphOutputOwner(asset)).toBe(owner)
  })

  it('does not infer graph ownership for physical files or incomplete protocol paths', () => {
    expect(resolveGraphOutputOwner(owner)).toBeUndefined()
    expect(resolveGraphOutputOwner('assets/weapp-vite:logical-entry:page:missing.css')).toBeUndefined()
  })
})
