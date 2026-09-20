import type { EncodedSourceMapLike } from '../utils/sourcemap'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'
import { extractPageDeclaration } from './index'

interface ExpectedMapping {
  column: number
  content: string
  line: number
  source: string
}

function expectTokenMapping(
  script: string | undefined,
  sourceMap: EncodedSourceMapLike | null | undefined,
  token: string,
  expected: ExpectedMapping,
) {
  if (script == null || sourceMap == null) {
    throw new Error('Expected a compiled script with its source map')
  }
  const generatedOffset = script.indexOf(token)
  if (generatedOffset < 0) {
    throw new Error(`Expected compiled script to contain ${token}`)
  }
  const generatedPrefix = script.slice(0, generatedOffset).split('\n')
  const mapped = originalPositionFor(new TraceMap(JSON.stringify(sourceMap)), {
    line: generatedPrefix.length,
    column: generatedPrefix.at(-1)!.length,
  })

  expect(mapped).toMatchObject({
    source: expected.source,
    line: expected.line,
    column: expected.column,
  })
  const sourceIndex = sourceMap.sources.indexOf(expected.source)
  if (sourceIndex < 0) {
    throw new Error(`Expected source map to contain ${expected.source}`)
  }
  expect(sourceMap.sourcesContent?.[sourceIndex]).toBe(expected.content)
}

describe('external page declaration source maps', () => {
  it('keeps an external normal script independent from CRLF and template preprocessing', async () => {
    const filename = '/project/src/pages/external-normal.vue'
    const externalFilename = '/project/src/pageScripts/external-normal.ts'
    const source = [
      '<template><view>{{ import.meta.env.MODE }}</view></template>',
      '<script lang="ts" src="../pageScripts/external-normal.ts"></script>',
    ].join('\r\n')
    const externalSource = [
      'import { definePage } from \'wevu/router\'',
      'definePage({ name: \'external-normal-map\' })',
      'const externalNormalSentinel = \'external-normal\'',
      'export default { setup: () => ({ externalNormalSentinel }) }',
    ].join('\n')

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expectTokenMapping(result.script, result.scriptMap, 'externalNormalSentinel', {
      source: externalFilename,
      line: 3,
      column: 6,
      content: externalSource,
    })
  })

  it.each(['\r\n', ''])('maps both branches of a mixed descriptor with separator %j', async (separator) => {
    const filename = '/project/src/pages/mixed-sources.vue'
    const externalFilename = '/project/src/pageScripts/mixed-sources.ts'
    const source = [
      '<script lang="ts" src="../pageScripts/mixed-sources.ts"></script>',
      '<script setup lang="ts">',
      'const inlineMixedSentinel = \'inline\';',
      'defineExpose({ inlineMixedSentinel });',
      '</script>',
    ].join(separator)
    const externalSource = [
      'import { definePage } from \'wevu/router\'',
      'definePage({ name: \'mixed-source-map\' })',
      'export const externalMixedSentinel = \'external\'',
      'export default {}',
    ].join('\n')

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })
    const inlinePrefix = source.slice(0, source.indexOf('const inlineMixedSentinel')).split('\n')

    expectTokenMapping(result.script, result.scriptMap, 'const inlineMixedSentinel', {
      source: filename,
      line: inlinePrefix.length,
      column: inlinePrefix.at(-1)!.length,
      content: source,
    })
    expectTokenMapping(result.script, result.scriptMap, 'externalMixedSentinel', {
      source: externalFilename,
      line: 3,
      column: 13,
      content: externalSource,
    })
  })

  it('keeps static declaration and emitted script strings byte-for-byte', async () => {
    const filename = '/project/src/pages/script-like-text.vue'
    const source = [
      '<template><!-- <script src="./template-comment.ts"></script> --><view /></template>',
      '<script setup lang="ts">',
      'import { definePage } from \'wevu/router\'',
      '// <script src="./script-comment.ts">',
      `const emittedSnippet = '<script src="./embed.js">'`,
      `definePage({ name: 'script-like-text', meta: { snippet: '<script src="./meta.js">' } })`,
      'defineExpose({ emittedSnippet })',
      '</script>',
    ].join('\n')
    const emittedOffset = source.indexOf('const emittedSnippet')
    const emittedPrefix = source.slice(0, emittedOffset).split('\n')

    expect(extractPageDeclaration(source, filename)).toEqual({
      name: 'script-like-text',
      meta: {
        snippet: '<script src="./meta.js">',
      },
    })

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
    })

    expect(result.script).toContain(`const emittedSnippet = '<script src="./embed.js">'`)
    expect(result.script).not.toContain('data-weapp-vite')
    expectTokenMapping(result.script, result.scriptMap, 'const emittedSnippet', {
      source: filename,
      line: emittedPrefix.length,
      column: emittedPrefix.at(-1)!.length,
      content: source,
    })
  })

  it('reports an inline macro at its original same-line column after external script', async () => {
    const filename = '/project/src/pages/same-line-diagnostic.vue'
    const externalFilename = '/project/src/pageScripts/same-line-diagnostic.ts'
    const invalidToken = 'routeName'
    const source = `<script lang="ts" src="../pageScripts/same-line-diagnostic.ts"></script><script setup lang="ts">import { definePage } from 'wevu/router';definePage({ name: ${invalidToken} })</script>`

    await expect(compileVueFile(source, filename, {
      isPage: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return 'export default {}'
        },
      },
    })).rejects.toThrow(
      `${filename}:1:${source.indexOf(invalidToken) + 1} definePage().name 必须是非空静态字符串。`,
    )
  })

  it('maps an external setup statement after JSON and defineOptions preprocessing', async () => {
    const filename = '/project/src/pages/external-setup-macros.vue'
    const externalFilename = '/project/src/pageScripts/external-setup-macros.ts'
    const source = '<script setup lang="ts" src="../pageScripts/external-setup-macros.ts"></script>'
    const externalSource = [
      'definePageJson({',
      '  navigationBarTitleText: \'Mapped macros\',',
      '})',
      'defineOptions(() => ({',
      '  name: \'ExternalSetupMacros\',',
      '  data: { ready: true },',
      '}))',
      'const postMacroSentinel = \'after-macros\'',
      'defineExpose({ postMacroSentinel })',
    ].join('\n')

    const result = await compileVueFile(source, filename, {
      isPage: true,
      sourceMap: true,
      sfcSrc: {
        async resolveId() {
          return externalFilename
        },
        async readFile() {
          return externalSource
        },
      },
    })

    expect(JSON.parse(result.config!)).toMatchObject({
      navigationBarTitleText: 'Mapped macros',
    })
    expectTokenMapping(result.script, result.scriptMap, 'postMacroSentinel', {
      source: externalFilename,
      line: 8,
      column: 6,
      content: externalSource,
    })
  })
})
