import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from './index'

const cases = [
  {
    name: 'without macros',
    expectedLine: 2,
    source: '<script setup lang="ts">\nconst sentinel = 1\n</script><template><view>{{ sentinel }}</view></template>',
  },
  {
    name: 'after a template import.meta placeholder without script macros',
    expectedLine: 3,
    source: '<template><view>{{ import.meta.env.MODE }}</view></template>\n<script setup lang="ts">\nconst sentinel = 1\n</script>',
  },
  {
    name: 'after a single-line defineOptions factory',
    expectedLine: 3,
    source: '<script setup lang="ts">\ndefineOptions(() => ({ name: "SingleLine" }))\nconst sentinel = 1\n</script><template><view>{{ sentinel }}</view></template>',
  },
  {
    name: 'after a multi-line defineOptions factory',
    expectedLine: 5,
    source: '<script setup lang="ts">\ndefineOptions(() => ({\n  data: { ready: true },\n}))\nconst sentinel = 1\n</script><template><view>{{ sentinel }}</view></template>',
  },
  {
    name: 'after a multi-line defineOptions factory with CRLF',
    expectedLine: 5,
    source: [
      '<script setup lang="ts">',
      'defineOptions(() => ({',
      '  data: { ready: true },',
      '}))',
      'const sentinel = 1',
      '</script><template><view>{{ sentinel }}</view></template>',
    ].join('\r\n'),
  },
  {
    name: 'after JSON and defineOptions preprocessing',
    expectedLine: 8,
    source: '<script setup lang="ts">\ndefinePageJson({\n  navigationBarTitleText: "Source map",\n})\ndefineOptions(() => ({\n  data: { ready: true },\n}))\nconst sentinel = 1\n</script><template><view>{{ sentinel }}</view></template>',
  },
] as const

describe('compileVueFile script source maps', () => {
  it.each(cases)('maps a declaration $name to the original SFC', async ({ expectedLine, name, source }) => {
    const filename = `src/components/${name.replaceAll(' ', '-')}.vue`
    const result = await compileVueFile(source, filename, { sourceMap: true })
    if (result.script == null || result.scriptMap == null) {
      throw new Error('Expected a compiled script with its source map')
    }
    const generatedOffset = result.script.indexOf('sentinel')
    const generatedPrefix = result.script.slice(0, generatedOffset).split('\n')
    const originalLine = source.split('\n')[expectedLine - 1]!

    expect(generatedOffset).toBeGreaterThanOrEqual(0)
    const mapped = originalPositionFor(new TraceMap(JSON.stringify(result.scriptMap)), {
      line: generatedPrefix.length,
      column: generatedPrefix.at(-1)!.length,
    })

    expect(mapped).toMatchObject({
      source: filename,
      line: expectedLine,
      column: originalLine.indexOf('sentinel'),
    })
    expect(result.scriptMap.sources).toEqual([filename])
    expect(result.scriptMap.sourcesContent).toEqual([source])
  })
})
