import type { SFCParseResult } from '@vue/language-core'
import type { SfcTextChange } from '../src/parseSfc'
import * as compilerDom from '@vue/compiler-dom'
import { parseSfc, updateSfc } from '../src/parseSfc'

const filename = 'src/IncrementalLocations.vue'

type ChangeFactory = (source: string) => SfcTextChange

function createSfc(eol = '\n') {
  return [
    `<template src="./view.wxml"><view>hello${eol}中文🙂</view></template>`,
    `<script lang="ts">export default { name: 'demo' }</script>`,
    `<script setup lang="ts" generic="T extends string">const value = 'ok'</script>`,
    `<style scoped module="styles">.card { color: red; }</style>`,
    `<wxs src="./util.wxs" module="util">module.exports = {}</wxs>`,
    `<json lang="json">{"component":true}</json>`,
  ].join(eol)
}

function getBlocks(parsed: SFCParseResult) {
  const { descriptor } = parsed
  return [
    descriptor.template,
    descriptor.script,
    descriptor.scriptSetup,
    ...descriptor.styles,
    ...descriptor.customBlocks,
  ].filter(block => block !== null)
}

function findChange(oldText: string, newText: string): ChangeFactory {
  return (source) => {
    const start = source.indexOf(oldText)
    if (start < 0) {
      throw new Error(`Unable to find ${JSON.stringify(oldText)}`)
    }
    return {
      start,
      end: start + oldText.length,
      newText,
    }
  }
}

function insertBefore(text: string, newText: string): ChangeFactory {
  return (source) => {
    const start = source.indexOf(text)
    if (start < 0) {
      throw new Error(`Unable to find ${JSON.stringify(text)}`)
    }
    return { start, end: start, newText }
  }
}

function expectIncrementalMatchesClean(
  source: string,
  changes: ChangeFactory[],
) {
  let currentSource = source
  let incremental = parseSfc(compilerDom, currentSource, filename)

  for (const createChange of changes) {
    const change = createChange(currentSource)
    currentSource = currentSource.slice(0, change.start)
      + change.newText
      + currentSource.slice(change.end)

    const updated = updateSfc(incremental, change)
    if (!updated) {
      throw new Error('Expected the content-only edit to stay incremental')
    }

    const clean = parseSfc(compilerDom, currentSource, filename)
    expect(getBlocks(clean)).toHaveLength(6)
    expect(updated.descriptor.source).toBe(currentSource)
    expect(getBlocks(updated)).toEqual(getBlocks(clean))
    incremental = updated
  }
}

function getPosition(source: string, offset: number) {
  const lines = source.slice(0, offset).split('\n')
  return {
    offset,
    line: lines.length,
    column: (lines.at(-1) ?? '').length + 1,
  }
}

const locationCases: Array<[string, string, ChangeFactory[]]> = [
  ['inserting a newline', createSfc(), [insertBefore('hello', '\n')]],
  ['deleting a newline', createSfc(), [findChange('\n中文', '中文')]],
  ['changing text on one line', createSfc(), [findChange('hello', 'hello world')]],
  ['editing a CRLF boundary', createSfc('\r\n'), [findChange('\r\n中文', '\n中文')]],
  ['changing Chinese and emoji text', createSfc(), [findChange('中文🙂', '汉字🚀✨')]],
]

describe('SFC incremental locations', () => {
  it.each(locationCases)('matches a clean parse after %s', (_name, source, changes) => {
    expectIncrementalMatchesClean(source, changes)
  })

  it('matches a clean parse after consecutive edits', () => {
    expectIncrementalMatchesClean(createSfc('\r\n'), [
      insertBefore('hello', '\n'),
      findChange('中文🙂', '汉字🚀✨'),
      findChange('\nhello', 'hello'),
      findChange('\r\n汉字', '\n汉字'),
    ])
  })

  it('matches a clean parse when populating an empty block with multiline attributes', () => {
    const source = createSfc().replace(
      '<script lang="ts">export default { name: \'demo\' }</script>',
      '<script\n lang="ts"></script>',
    )
    expectIncrementalMatchesClean(source, [
      insertBefore('</script>', 'export default { name: \'demo\' }'),
    ])
  })

  it('falls back when an edit changes the containing block boundary', () => {
    const source = createSfc()
    const parsed = parseSfc(compilerDom, source, filename)
    const start = source.indexOf('hello')

    const updated = updateSfc(parsed, {
      start,
      end: start,
      newText: '</template>',
    })

    expect(updated).toBeUndefined()
    expect(parsed.descriptor.source).toBe(source)
  })

  it('keeps an incomplete template repair location internally consistent', () => {
    const source = '<template>\n  <view />\n</templa'
    const parsed = parseSfc(compilerDom, source, filename)
    const template = parsed.descriptor.template
    if (!template) {
      throw new Error('Expected the incomplete SFC to retain its template block')
    }

    expect(template.loc.source).toBe(template.content)
    expect(template.loc.end.offset).toBe(template.loc.start.offset + template.content.length)
    expect(template.loc.end).toEqual(getPosition(source, template.loc.end.offset))
  })
})
