import { describe, expect, it } from 'vitest'
import { normalizeViteId } from './viteId'

describe('normalizeViteId', () => {
  it('normalizes query, /@fs/, backslashes and leading null byte', () => {
    const id = '\0/@fs/C:\\project\\src\\index.ts?vue&type=script'
    const normalized = normalizeViteId(id, {
      stripLeadingNullByte: true,
    })

    expect(normalized).toContain('/C:/project/src/index.ts')
    expect(normalized).not.toContain('?')
    expect(normalized).not.toContain('\\')
  })

  it('strips vue virtual prefix when enabled', () => {
    expect(normalizeViteId('\0vue:/project/src/App.vue', {
      stripVueVirtualPrefix: true,
    })).toBe('/project/src/App.vue')
  })

  it('converts file protocol id to file path', () => {
    const normalized = normalizeViteId('file:///tmp/demo.ts')
    expect(normalized).toContain('/tmp/demo.ts')
  })
})
