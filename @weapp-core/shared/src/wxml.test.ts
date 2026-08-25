import { describe, expect, it } from 'vitest'
import { escapeWxmlAttribute, escapeWxmlText } from './wxml'

describe('WXML serialization', () => {
  it('uses the shared exparser and glass-easel text escaping contract', () => {
    expect(escapeWxmlText('A & B < C > D')).toBe('A &amp; B &lt; C &gt; D')
  })

  it('escapes static and expression attribute boundaries', () => {
    expect(escapeWxmlAttribute('value === "test" && a < b')).toBe(
      'value === &quot;test&quot; &amp;&amp; a &lt; b',
    )
  })
})
