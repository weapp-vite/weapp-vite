import { describe, expect, it } from 'vitest'
import { readAndParseSfc } from 'wevu/compiler'
import { scanWxml } from '../../wxml'
import { collectSfcTemplateDependencies } from './vueTemplateDependencies'

describe('Vue template native dependencies', () => {
  it('uses inline AST offsets and ignores comments, text and script lookalikes', async () => {
    const source = [
      '<script setup>const label = "dependencies"</script>',
      '<template>',
      '<view><input><img src="icon.png"><DemoCard />',
      '<!-- <include src="./comment.wxml" /> -->',
      '<text>&lt;include src="./text.wxml" /&gt;</text>',
      '<import src="./card.wxml" />',
      '<include src=\'./a&amp;b.wxml\' />',
      '<wxs module="helper" src="./helper.wxs.ts" lang="ts" />',
      '<wxs module="inline">var fake = \'<include src="./script.wxml" />\'; module.exports = fake;</wxs>',
      '</view></template>',
    ].join('\n')
    const { descriptor, errors } = await readAndParseSfc('dependencies.vue', { source })
    expect(errors).toEqual([])
    const block = descriptor.template!
    const deps = collectSfcTemplateDependencies(block)
    expect(deps.map(dep => [dep.tagName, dep.value])).toEqual([
      ['import', './card.wxml'],
      ['include', './a&b.wxml'],
      ['wxs', './helper.wxs.ts'],
    ])
    expect(deps.map(dep => block.content.slice(dep.start, dep.end))).toEqual([
      'src="./card.wxml"',
      'src=\'./a&amp;b.wxml\'',
      'src="./helper.wxs.ts"',
    ])
    expect(deps[2].attrs).toMatchObject({ module: 'helper', lang: 'ts' })
  })

  it('reparses external content instead of retaining the empty inline AST', async () => {
    const content = '<view>\r\n<input><include src="./external.wxml" /></view>'
    const { descriptor } = await readAndParseSfc('external.vue', {
      source: '<template src="./parts/body.html" />',
      resolveSrc: { readFile: async () => content },
    })
    const deps = collectSfcTemplateDependencies(descriptor.template!)
    expect(deps.map(dep => dep.value)).toEqual(['./external.wxml'])
    expect(content.slice(deps[0].start, deps[0].end)).toBe('src="./external.wxml"')
  })

  it('retains native platform script restrictions and XML structural diagnostics', () => {
    expect(() => collectSfcTemplateDependencies({ content: '<input><jds module="helper" src="./helper.ts" />' }, 'jd')).toThrow('only supports native .jds')
    expect(collectSfcTemplateDependencies({ content: '<input><jds module="helper" src="./helper.jds" />' }, 'jd').map(dep => dep.value)).toEqual(['./helper.jds'])
    expect(() => scanWxml('<view><input></view>')).toThrow('不匹配')
    expect(() => collectSfcTemplateDependencies({ content: '<view><broken></view>' })).toThrow()
  })

  it('keeps ordinary SVG filter descendants visible to dependency discovery', () => {
    const content = '<svg><filter id="effect"><include src="./effect.wxml" /></filter></svg>'
    expect(collectSfcTemplateDependencies({ content }).map(dep => dep.value)).toEqual(['./effect.wxml'])
  })
})
