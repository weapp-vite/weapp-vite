import type { SFCDescriptor } from 'vue/compiler-sfc'
import { afterEach, describe, expect, it } from 'vitest'
import { parse, parseCache } from 'vue/compiler-sfc'
import { resolveVueSfcSignaturePayload } from './sfcPayload'
import { resolveVueSfcHmrSignatures } from './sfcSignature'

const ownedFilenames = new Set<string>()

function ownFilename(name: string) {
  const filename = `signature-payload-${name}.vue`
  ownedFilenames.add(filename)
  return filename
}

function evictDescriptor(descriptor: SFCDescriptor) {
  for (const [key, result] of parseCache) {
    if (result.descriptor === descriptor) {
      return parseCache.delete(key)
    }
  }
  return false
}

afterEach(() => {
  for (const [key, result] of parseCache) {
    if (ownedFilenames.has(result.descriptor.filename)) {
      parseCache.delete(key)
    }
  }
  ownedFilenames.clear()
})

describe('SFC signature payload ownership', () => {
  it('reuses payload and signatures while their parsed descriptor is cached', () => {
    const filename = ownFilename('reuse')
    const source = '<template><view class="page">hello</view></template>'
    const payload = resolveVueSfcSignaturePayload(source, filename)
    const signatures = resolveVueSfcHmrSignatures(source, filename)

    expect(payload).toBeDefined()
    expect(resolveVueSfcSignaturePayload(source, filename)).toBe(payload)
    expect(resolveVueSfcHmrSignatures(source, filename)).toBe(signatures)
  })

  it('rebuilds payload after its parse owner is evicted without changing signatures', () => {
    const filename = ownFilename('eviction')
    const source = '<script setup>const count = 1</script><template><view>{{ count }}</view></template>'
    const payload = resolveVueSfcSignaturePayload(source, filename)
    const signatures = resolveVueSfcHmrSignatures(source, filename)
    const descriptor = parse(source, { filename }).descriptor

    expect(evictDescriptor(descriptor)).toBe(true)
    expect(parse(source, { filename }).descriptor).not.toBe(descriptor)
    const nextPayload = resolveVueSfcSignaturePayload(source, filename)
    const nextSignatures = resolveVueSfcHmrSignatures(source, filename)

    expect(nextPayload).not.toBe(payload)
    expect(nextPayload).toEqual(payload)
    expect(nextSignatures).not.toBe(signatures)
    expect(nextSignatures).toEqual(signatures)
  })

  it('keeps distinct source and filename parse owners independent', () => {
    const firstFile = ownFilename('first')
    const secondFile = ownFilename('second')
    const firstSource = '<template><view>first</view></template>'
    const secondSource = '<template><view>second</view></template>'
    const first = resolveVueSfcSignaturePayload(firstSource, firstFile)
    const second = resolveVueSfcSignaturePayload(secondSource, firstFile)
    const otherFile = resolveVueSfcSignaturePayload(firstSource, secondFile)

    expect(first).not.toBe(second)
    expect(first).not.toBe(otherFile)
    expect(second?.template.template?.content).toBe('<view>second</view>')
    expect(resolveVueSfcSignaturePayload(firstSource, firstFile)).toBe(first)
    expect(resolveVueSfcSignaturePayload(firstSource, secondFile)).toBe(otherFile)
  })

  it('does not reuse a valid payload for malformed source or block later recovery', () => {
    const filename = ownFilename('recovery')
    const source = '<template><view>valid</view></template>'
    const payload = resolveVueSfcSignaturePayload(source, filename)

    expect(resolveVueSfcSignaturePayload('<template><view /></template', filename)).toBeUndefined()
    expect(resolveVueSfcSignaturePayload(source, filename)).toBe(payload)
    expect(resolveVueSfcSignaturePayload(source.replace('valid', 'recovered'), filename)?.template.template?.content)
      .toBe('<view>recovered</view>')
  })
})
