import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { parse as parseSfc } from 'vue/compiler-sfc'
import {
  getSfcCheckMtime,
  preprocessScriptSetupSrc,
  preprocessScriptSrc,
  readAndParseSfc,
  resolveSfcBlockSrc,
  restoreScriptSetupSrc,
  restoreScriptSrc,
} from './vueSfc'

describe('vueSfc utils', () => {
  it('preprocesses and restores script src attributes', () => {
    const source = `
<template><view /></template>
<script setup lang="ts" src="./setup.ts"></script>
<script lang="ts" src="./main.ts"></script>
    `.trim()

    const preprocessed = preprocessScriptSrc(preprocessScriptSetupSrc(source))
    expect(preprocessed).toContain('data-weapp-vite-src')
    expect(preprocessed).toContain('data-weapp-vite-script-src')

    const descriptor = {
      scriptSetup: {
        attrs: {
          'data-weapp-vite-src': './setup.ts',
        },
      },
      script: {
        attrs: {
          'data-weapp-vite-script-src': './main.ts',
        },
      },
    } as any

    restoreScriptSetupSrc(descriptor)
    restoreScriptSrc(descriptor)
    expect(descriptor.scriptSetup.src).toBe('./setup.ts')
    expect(descriptor.script.src).toBe('./main.ts')
  })

  it('resolves src blocks with custom resolver and reader', async () => {
    const filename = '/project/src/pages/index/index.vue'
    const descriptor = parseSfc(`
<template src="./index.wxml"></template>
<script src="./index.ts"></script>
<style src="./index.css"></style>
    `.trim(), { filename }).descriptor

    const codeById = new Map<string, string>([
      ['/project/src/pages/index/index.wxml', '<view>{{ msg }}</view>'],
      ['/project/src/pages/index/index.ts', 'export default { setup() {} }'],
      ['/project/src/pages/index/index.css', '.page { color: v-bind(color); background: v-bind("surface.color"); }'],
    ])

    const resolved = await resolveSfcBlockSrc(descriptor, filename, {
      async resolveId(source, importer) {
        return path.resolve(path.dirname(importer!), source)
      },
      async readFile(id) {
        const code = codeById.get(id)
        if (!code) {
          throw new Error(`missing fixture: ${id}`)
        }
        return code
      },
    })

    expect(resolved.deps).toHaveLength(3)
    expect(resolved.descriptor.template?.content).toContain('{{ msg }}')
    expect(resolved.descriptor.script?.content).toContain('export default')
    expect(resolved.descriptor.styles[0].content).toContain('v-bind(color)')
    expect(resolved.descriptor.cssVars).toEqual(['color', 'surface.color'])
  })

  it('matches public compiler-sfc cssVars metadata across mixed inline and external styles', async () => {
    const filename = '/project/src/pages/index/index.vue'
    const inlineCss = `
/* v-bind(inlineGhost) */
.inline { color: v-bind("tone"); }
`.trim()
    const externalCss = `
.external { color: v-bind(resolveShade(palette.primary, fallback)); }
.duplicate { border-color: v-bind("tone"); }
`.trim()
    const source = `
<template><view /></template>
<style>${inlineCss}</style>
<style src="./theme.css"></style>
`.trim()
    const equivalentInlineSource = `
<template><view /></template>
<style>${inlineCss}</style>
<style>${externalCss}</style>
`.trim()
    const descriptor = parseSfc(source, { filename }).descriptor
    const expected = parseSfc(equivalentInlineSource, { filename }).descriptor.cssVars

    const resolved = await resolveSfcBlockSrc(descriptor, filename, {
      async readFile() {
        return externalCss
      },
    })

    expect(resolved.descriptor.cssVars).toEqual(expected)
    expect(resolved.descriptor.cssVars).toEqual([
      'tone',
      'resolveShade(palette.primary, fallback)',
    ])
  })

  it('preserves external CSS containing close tags while rebuilding cssVars metadata', async () => {
    const filename = '/project/src/pages/index/index.vue'
    const externalCss = `
.before { color: v-bind(before); }
.literal-lower { content: "</style>"; }
.sentinel-collision { content: "__WEVU_SFC_CSS_VARS_CLOSE_0__"; }
.literal-upper { content: "</STYLE>"; color: v-bind("tone</STYLE>"); }
.literal-upper-duplicate { border-color: v-bind("tone</STYLE>"); }
/* </StYlE> v-bind(commentGhost) */
.after { color: v-bind(resolveShade(palette.primary, fallback)); }
`.trim()
    const descriptor = parseSfc(`
<template><view /></template>
<style src="./theme.css"></style>
`.trim(), { filename }).descriptor
    let readCount = 0

    const resolved = await resolveSfcBlockSrc(descriptor, filename, {
      async readFile() {
        readCount++
        return externalCss
      },
    })

    expect(readCount).toBe(1)
    expect(resolved.descriptor.styles[0].content).toBe(externalCss)
    expect(resolved.descriptor.cssVars).toEqual([
      'before',
      'tone</STYLE>',
      'resolveShade(palette.primary, fallback)',
    ])
  })

  it('throws when src block contains inline content or virtual module source', async () => {
    const filename = '/project/src/pages/index/index.vue'
    const inlineDescriptor = parseSfc(`
<script src="./index.ts">
console.log('inline')
</script>
    `.trim(), { filename }).descriptor

    await expect(resolveSfcBlockSrc(inlineDescriptor, filename, {
      async resolveId(source, importer) {
        return path.resolve(path.dirname(importer!), source)
      },
      async readFile() {
        return ''
      },
    })).rejects.toThrow('同时存在 src 与内联内容')

    const virtualDescriptor = parseSfc(`<script src="node:path"></script>`, { filename }).descriptor
    await expect(resolveSfcBlockSrc(virtualDescriptor, filename, {
      async resolveId() {
        return undefined
      },
      async readFile() {
        return ''
      },
    })).rejects.toThrow('不支持 <src> 引用虚拟模块')
  })

  it('reads and parses SFC from source and resolves src blocks', async () => {
    const filename = '/project/src/pages/index/index.vue'
    const parsed = await readAndParseSfc(filename, {
      source: `
<template src="./index.wxml"></template>
<script setup src="./setup.ts"></script>
      `.trim(),
      resolveSrc: {
        async resolveId(source, importer) {
          return path.resolve(path.dirname(importer!), source)
        },
        async readFile(id) {
          if (id.endsWith('index.wxml')) {
            return '<view>hello</view>'
          }
          if (id.endsWith('setup.ts')) {
            return 'const msg = "hi"'
          }
          throw new Error(`missing fixture: ${id}`)
        },
      },
    })

    expect(parsed.source).toContain('<template src="./index.wxml">')
    expect(parsed.descriptor.template?.content).toContain('hello')
    expect(parsed.descriptor.scriptSetup?.content).toContain('msg')
  })

  it('returns read-file mtime policy via getSfcCheckMtime', () => {
    expect(getSfcCheckMtime()).toBe(false)
    expect(getSfcCheckMtime({ isDev: true })).toBe(true)
  })
})
