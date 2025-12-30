import type { Options } from 'tinybench'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

export const defaultBenchOptions: Options = {
  time: 200,
  iterations: 20,
  warmupTime: 50,
  warmupIterations: 5,
}

export function createWxmlFixture(options?: {
  componentCount?: number
  importCount?: number
  includeCount?: number
  wxsImportCount?: number
  inlineWxsBlockCount?: number
  conditionalBlockCount?: number
}) {
  const {
    componentCount = 200,
    importCount = 40,
    includeCount = 40,
    wxsImportCount = 20,
    inlineWxsBlockCount = 20,
    conditionalBlockCount = 20,
  } = options ?? {}

  const lines: string[] = []
  lines.push('<view class="root">')

  for (let i = 0; i < importCount; i++) {
    lines.push(`<import src="./templates/tpl-${i}.wxml" />`)
  }

  for (let i = 0; i < includeCount; i++) {
    lines.push(`<include src="./includes/inc-${i}.wxml" />`)
  }

  for (let i = 0; i < wxsImportCount; i++) {
    lines.push(`<wxs src="./wxs/mod-${i}.wxs.ts" />`)
  }

  for (let i = 0; i < conditionalBlockCount; i++) {
    lines.push('<!-- #ifdef alipay -->')
    lines.push(`<view class="conditional-${i}">ignored</view>`)
    lines.push('<!-- #endif -->')
  }

  for (let i = 0; i < inlineWxsBlockCount; i++) {
    lines.push('<wxs lang="ts">')
    lines.push(`'use strict'`)
    lines.push(`var n = ${i}`)
    lines.push(`var re = /foo${i}/gi`)
    lines.push(`module.exports = { n, re }`)
    lines.push('</wxs>')
  }

  for (let i = 0; i < componentCount; i++) {
    const mod = i % 4 === 0 ? '.catch.capture' : i % 4 === 1 ? '.capture' : i % 4 === 2 ? '.catch' : ''
    lines.push(`<custom-comp-${i} @tap${mod}="onTap${i}" data-i="${i}">`)
    lines.push(`  <view class="item">${i}</view>`)
    lines.push(`</custom-comp-${i}>`)
  }

  lines.push('<!-- trailing comment -->')
  lines.push('</view>')

  return lines.join('\n')
}

export function createWxsFixture(options?: { requireCount?: number, regexCount?: number }) {
  const { requireCount = 200, regexCount = 100 } = options ?? {}
  const lines: string[] = []
  lines.push(`'use strict'`)
  lines.push('var exports = {}')
  lines.push('var module = { exports }')

  for (let i = 0; i < requireCount; i++) {
    lines.push(`var m${i} = require('./deps/dep-${i}.wxs.ts')`)
  }

  for (let i = 0; i < regexCount; i++) {
    lines.push(`var r${i} = /token_${i}/g`)
    lines.push(`var d${i} = new Date(${1_700_000_000_000 + i})`)
    lines.push(`var rr${i} = new RegExp('x${i}', 'gi')`)
  }

  lines.push('Object.defineProperty(exports, "__esModule", { value: true })')
  lines.push('module.exports = { ok: true }')
  return lines.join('\n')
}

export function createJsFixtureForOxc(options?: { asyncRequireCount?: number }) {
  const { asyncRequireCount = 1_000 } = options ?? {}
  const lines: string[] = []
  lines.push(`export function run(require) {`)

  for (let i = 0; i < asyncRequireCount; i++) {
    lines.push(`  require.async('./mods/mod-${i}.js')`)
  }

  lines.push(`  return true`)
  lines.push(`}`)
  return lines.join('\n')
}

export function createJsoncFixture(options?: { componentCount?: number }) {
  const { componentCount = 500 } = options ?? {}

  const lines: string[] = []
  lines.push('{')
  lines.push('  // app.json-like payload')
  lines.push('  "pages": ["pages/index/index"],')
  lines.push('  "usingComponents": {')
  for (let i = 0; i < componentCount; i++) {
    const trailing = i === componentCount - 1 ? '' : ','
    lines.push(`    "c${i}": "@/components/c${i}/index"${trailing}`)
  }
  lines.push('  },')
  lines.push('  "subPackages": [')
  lines.push('    {')
  lines.push('      "root": "pkg-a",')
  lines.push('      "pages": ["pages/a/index"],')
  lines.push('      "entry": "entry.ts"')
  lines.push('    }')
  lines.push('  ]')
  lines.push('}')
  return lines.join('\n')
}

export async function createTempDir(prefix: string) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const baseDir = path.resolve(packageRoot, 'test/fixtures/__temp__', 'bench')
  await fs.ensureDir(baseDir)
  const root = await fs.mkdtemp(path.join(baseDir, prefix))
  return root
}

export async function createAutoRoutesFixture(options?: {
  pageCount?: number
  subPackageCount?: number
  pagesPerSubPackage?: number
}) {
  const { pageCount = 200, subPackageCount = 4, pagesPerSubPackage = 60 } = options ?? {}

  const tempRoot = await createTempDir('weapp-vite-bench-')
  const absoluteSrcRoot = path.join(tempRoot, 'src')
  await fs.ensureDir(absoluteSrcRoot)

  const createPage = async (baseDir: string, index: number) => {
    const pageDir = path.join(baseDir, `page-${index}`, 'index')
    await fs.ensureDir(pageDir)
    await fs.writeFile(path.join(pageDir, 'index.ts'), `export default ${index}\n`, 'utf8')
    await fs.writeFile(path.join(pageDir, 'index.wxml'), `<view>${index}</view>\n`, 'utf8')
    await fs.writeFile(path.join(pageDir, 'index.wxss'), `.root { color: #${(index % 999).toString().padStart(3, '0')} }\n`, 'utf8')
    await fs.writeFile(path.join(pageDir, 'index.json'), `{"usingComponents":{}}\n`, 'utf8')
  }

  const mainPagesRoot = path.join(absoluteSrcRoot, 'pages')
  await fs.ensureDir(mainPagesRoot)
  await Promise.all(
    Array.from({ length: pageCount }, (_, i) => createPage(mainPagesRoot, i)),
  )

  const subPackagesRootNames = Array.from({ length: subPackageCount }, (_, i) => `pkg-${i}`)
  for (const rootName of subPackagesRootNames) {
    const subPagesRoot = path.join(absoluteSrcRoot, rootName, 'pages')
    await fs.ensureDir(subPagesRoot)
    await Promise.all(
      Array.from({ length: pagesPerSubPackage }, (_, i) => createPage(subPagesRoot, i)),
    )
  }

  return {
    tempRoot,
    absoluteSrcRoot,
    cleanup: async () => fs.remove(tempRoot),
  }
}
