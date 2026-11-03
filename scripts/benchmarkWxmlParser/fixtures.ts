import type { Feature } from './contracts'
import type { Policy } from './freeze'
import type { Fixture } from './types'
import { Buffer } from 'node:buffer'
import { hash } from './freeze'

export function features(source: string, policy: Policy['features']): Feature[] {
  const result: Feature[] = []
  const dense = [...source.matchAll(/<[A-Z_][\w:.-]*(\s[^<>]*?)?\/?>/gi)]
    .some(match => [...(match[1] ?? '').matchAll(/\s+[A-Z_][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi)].length >= policy.denseAttributeMinimum)
  if (dense) {
    result.push('attributes-dense')
  }
  if (source.includes('{{')) {
    result.push('interpolation')
  }
  if (/&(?:#x[\da-f]+|#\d+|[a-z][\da-z]*);/i.test(source)) {
    result.push('entities')
  }
  const tags = [...source.matchAll(/<([a-z_][\w:.-]*)\b/gi)].map(match => match[1]!.toLowerCase())
  if (tags.some(tag => policy.scriptTags.includes(tag))) {
    result.push('script')
  }
  if (tags.some(tag => policy.webTags.includes(tag))) {
    result.push('web')
  }
  return result
}

export function supplementFixtures(originals: Fixture[], policy: Policy): Fixture[] {
  const all: Fixture[] = originals.map(file => ({ ...file, features: features(file.source, policy.features) }))
  const append = (family: 'deep-tree' | 'long-text' | 'entities', size: number, source: string) => {
    const sha256 = hash(source)
    const pressureId = `stress-${family}-${size}`
    const bytes = Buffer.byteLength(source)
    all.push({
      id: `${pressureId}-${sha256}`,
      sha256,
      bytes,
      source,
      platform: 'weapp',
      cohort: 'shared',
      size: bytes < 2048 ? 'small' : bytes < 16384 ? 'medium' : 'large',
      origins: [`<generated:${family}:${size}>`],
      features: features(source, policy.features),
      synthetic: true,
      pressureId,
    } as Fixture)
  }
  for (const depth of policy.pressure.depths) {
    append('deep-tree', depth, `${'<view>'.repeat(depth)}text${'</view>'.repeat(depth)}`)
  }
  for (const bytes of policy.pressure.textBytes) {
    append('long-text', bytes, `<text>${'x'.repeat(bytes)}</text>`)
  }
  const entityElement = '<view title="&quot;quoted&quot; &amp; &apos;single&apos;" data-decimal="&#65;&#160;" data-hex="&#x41;&#x1F642;" data-markup="&lt;value&gt;">&amp; &lt; &gt; &quot; &apos; &#65; &#x1F642;</view>'
  for (const elements of policy.pressure.entityElements) {
    append('entities', elements, entityElement.repeat(elements))
  }
  return all
}
