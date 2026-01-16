import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { compileVueFile } from '../../src/plugins/vue/transform'

describe('SFC src blocks', () => {
  let tmpDir: string
  let aliasRoot: string
  let vuePath: string

  beforeEach(async () => {
    const root = path.resolve(os.tmpdir(), 'weapp-vite-vitest')
    await fs.ensureDir(root)
    tmpDir = await fs.mkdtemp(path.join(root, 'sfc-src-'))
    aliasRoot = path.join(tmpDir, 'src')
    await fs.ensureDir(aliasRoot)

    vuePath = path.join(tmpDir, 'Component.vue')

    await fs.writeFile(
      path.join(aliasRoot, 'template.html'),
      '<view class="box">ok</view>',
      'utf8',
    )
    await fs.writeFile(
      path.join(aliasRoot, 'normal.ts'),
      'export default {}',
      'utf8',
    )
    await fs.writeFile(
      path.join(aliasRoot, 'setup.ts'),
      'const count: number = 0',
      'utf8',
    )
    await fs.writeFile(
      path.join(aliasRoot, 'style.css'),
      '.box{color:red}',
      'utf8',
    )

    await fs.ensureDir(path.join(tmpDir, 'parts'))
    await fs.writeFile(
      path.join(tmpDir, 'parts', 'relative-template.html'),
      '<view class="rel">relative</view>',
      'utf8',
    )
    await fs.writeFile(
      path.join(tmpDir, 'parts', 'relative-style.css'),
      '.rel{color:blue}',
      'utf8',
    )
  })

  afterEach(async () => {
    await fs.remove(tmpDir)
  })

  it('compiles template/script/style from src and infers script lang', async () => {
    const source = `
<template src="@/template.html"></template>
<script src="@/normal.ts"></script>
<script setup src="@/setup.ts"></script>
<style src="@/style.css"></style>
`
    const resolveId = async (source: string) => {
      if (source.startsWith('@/')) {
        return path.join(aliasRoot, source.slice(2))
      }
      return undefined
    }

    const result = await compileVueFile(source, vuePath, {
      sfcSrc: { resolveId },
    })

    expect(result.template).toContain('class="box"')
    expect(result.template).toContain('ok')
    expect(result.style).toContain('.box{color:red}')
    expect(result.meta?.hasScriptSetup).toBe(true)
    expect(result.meta?.sfcSrcDeps).toEqual(
      expect.arrayContaining([
        path.join(aliasRoot, 'template.html'),
        path.join(aliasRoot, 'normal.ts'),
        path.join(aliasRoot, 'setup.ts'),
        path.join(aliasRoot, 'style.css'),
      ]),
    )
  })

  it('throws when src block also has inline content', async () => {
    const source = `<script src="./a.ts">const foo = 1</script>`
    await expect(compileVueFile(source, vuePath, {
      sfcSrc: { resolveId: async () => undefined },
    })).rejects.toThrow('同时存在 src 与内联内容')
  })

  it('resolves relative and absolute src without resolver', async () => {
    const absStyle = path.join(tmpDir, 'parts', 'relative-style.css')
    const source = `
<template src="./parts/relative-template.html"></template>
<style src="${absStyle.replace(/\\/g, '/')}"></style>
`
    const result = await compileVueFile(source, vuePath, {
      sfcSrc: { resolveId: async () => undefined },
    })

    expect(result.template).toContain('class="rel"')
    expect(result.style).toContain('.rel{color:blue}')
  })

  it('tracks src dependencies for style module/scoped', async () => {
    const source = `
<template><view class="box" /></template>
<style src="./parts/relative-style.css" scoped module></style>
`
    const result = await compileVueFile(source, vuePath, {
      sfcSrc: { resolveId: async () => undefined },
    })

    expect(result.style).toContain('data-v-')
    expect(result.cssModules?.$style?.rel).toBeTruthy()
    expect(result.meta?.sfcSrcDeps).toEqual(
      expect.arrayContaining([path.join(tmpDir, 'parts', 'relative-style.css')]),
    )
  })

  it('rejects virtual module resolution for src', async () => {
    const source = `<template src="virtual:template.html"></template>`
    await expect(compileVueFile(source, vuePath, {
      sfcSrc: {
        resolveId: async () => '\0virtual:template',
      },
    })).rejects.toThrow('虚拟模块')
  })
})
