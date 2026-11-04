import { describe, expect, it } from 'vitest'
import { extractContainerTemplate, findContainerTemplate } from './container'

describe('explicit template container query', () => {
  it('distinguishes application script containers from explicit empty templates', () => {
    const application = '<script>export default { onCreate() { const text = "<template>fake</template>" } }</script><style>.a::after { content: "<template/>"; }</style>'
    expect(findContainerTemplate(application)).toBeUndefined()
    expect(findContainerTemplate('<!-- <template>comment</template> -->')).toBeUndefined()
    expect(() => extractContainerTemplate(application)).toThrow('no explicit template block')
    expect(findContainerTemplate('<template></template>')).toEqual({ source: '', start: 10, end: 10 })
    const unicode = '\uFEFF<template>😀\r\n<div/></template><script>export default {}</script>'
    const result = findContainerTemplate(unicode)!
    expect(result.source).toBe('😀\r\n<div/>')
    expect(unicode.slice(result.start, result.end)).toBe(result.source)
  })

  it('retains errors for malformed containers, multiple templates and invalid script boundaries', () => {
    for (const source of [
      '<template',
      '<script',
      '<template><div/>',
      '</template>',
      '<template/>',
      '<template></template><template></template>',
      '<script>export default {}',
      '<script>const text = "unterminated</script>',
      '<style>/* unterminated</style>',
      '<!-- unterminated',
    ]) {
      expect(() => findContainerTemplate(source)).toThrow()
    }
  })
})
