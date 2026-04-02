import { collectComponentPropsFromCode, collectFeatureFlagsFromCode, collectOnPageScrollPerformanceWarnings, collectSetDataPickKeysFromTemplateCode } from '@weapp-vite/ast'
import { parseSync } from 'oxc-parser'
import { bench, describe } from 'vitest'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../packages-runtime/wevu-compiler/src/constants'
import { createModuleAnalysis, createModuleAnalysisFromCode } from '../../../packages-runtime/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis'
import { collectTargetOptionsObjectsFromCode } from '../../../packages-runtime/wevu-compiler/src/plugins/wevu/pageFeatures/optionsObjects'
import { parseJsLike } from '../../../packages-runtime/wevu-compiler/src/utils/babel'
import { defaultBenchOptions } from './utils'

function createSetDataPickTemplate(options?: {
  blockCount?: number
  listCount?: number
}) {
  const {
    blockCount = 120,
    listCount = 12,
  } = options ?? {}
  const lines: string[] = []

  for (let listIndex = 0; listIndex < listCount; listIndex += 1) {
    lines.push(`<view wx:for="{{ list${listIndex} }}" wx:for-item="item${listIndex}" wx:for-index="index${listIndex}">`)
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      lines.push(`<text>{{ item${listIndex}.title + count${blockIndex} + this.extra${blockIndex % 8} }}</text>`)
      lines.push(`<text>{{ __wv_bind_${listIndex}[index${listIndex}] }}</text>`)
    }
    lines.push('</view>')
  }

  return lines.join('\n')
}

function createOnPageScrollSource(options?: {
  hookCount?: number
}) {
  const { hookCount = 120 } = options ?? {}
  const lines = [
    `import { onPageScroll as onScroll } from 'wevu'`,
    `import * as wevu from 'wevu'`,
    ``,
    `const page = {`,
  ]

  for (let index = 0; index < hookCount; index += 1) {
    lines.push(`  onPageScroll${index}: () => ${index},`)
  }

  lines.push(`  onPageScroll() {`)
  lines.push(`    this.setData({ top: 1, left: 2 })`)
  lines.push(`    wx.getStorageSync('k')`)
  lines.push(`    wx.getSystemInfoSync()`)
  lines.push(`  },`)
  lines.push(`}`)
  lines.push(``)

  for (let index = 0; index < hookCount; index += 1) {
    lines.push(`onScroll(() => {`)
    lines.push(`  this.setData({ idx: ${index} })`)
    lines.push(`  wx.getStorageSync('k${index}')`)
    lines.push(`})`)
    lines.push(`wevu.onPageScroll?.(() => {})`)
  }

  return lines.join('\n')
}

function createModuleAnalysisSource(options?: {
  helperCount?: number
}) {
  const { helperCount = 180 } = options ?? {}
  const lines = [
    `import { onPageScroll, onReachBottom, onPullDownRefresh, onResize } from 'wevu'`,
    `import * as wevu from 'wevu'`,
    ``,
  ]

  for (let index = 0; index < helperCount; index += 1) {
    lines.push(`function localHelper${index}() {`)
    lines.push(`  ${index % 2 === 0 ? 'onPageScroll()' : 'wevu.onResize?.()'}`)
    lines.push(`}`)
    lines.push(`export function exportedHelper${index}() {`)
    lines.push(`  localHelper${index}()`)
    lines.push(`  ${index % 3 === 0 ? 'onReachBottom?.()' : 'onPullDownRefresh()'}`)
    lines.push(`}`)
  }

  lines.push(`export default function setupEntry() {`)
  lines.push(`  return true`)
  lines.push(`}`)

  return lines.join('\n')
}

function createUnrelatedSource(options?: {
  fnCount?: number
}) {
  const { fnCount = 240 } = options ?? {}
  const lines = [
    `import { ref, computed } from 'vue'`,
    `import { sum } from './math'`,
    ``,
  ]

  for (let index = 0; index < fnCount; index += 1) {
    lines.push(`export function useFeature${index}() {`)
    lines.push(`  const state = ref(${index})`)
    lines.push(`  return computed(() => sum(state.value, ${index}))`)
    lines.push(`}`)
  }

  return lines.join('\n')
}

function createImportedButUnusedWevuFactorySource(options?: {
  fnCount?: number
}) {
  const { fnCount = 180 } = options ?? {}
  const lines = [
    `import { defineComponent } from 'wevu'`,
    `import * as wevu from 'wevu'`,
    ``,
    `const localFactory = defineComponent`,
    `const namespaceFactory = wevu.defineComponent`,
    ``,
  ]

  for (let index = 0; index < fnCount; index += 1) {
    lines.push(`export function useFeature${index}() {`)
    lines.push(`  return localFactory && namespaceFactory && ${index}`)
    lines.push(`}`)
  }

  return lines.join('\n')
}

function createComponentPropsUnrelatedSource(options?: {
  fnCount?: number
}) {
  const { fnCount = 240 } = options ?? {}
  const lines = [
    `import { ref, computed } from 'vue'`,
    ``,
  ]

  for (let index = 0; index < fnCount; index += 1) {
    lines.push(`export function useCounter${index}() {`)
    lines.push(`  const value = ref(${index})`)
    lines.push(`  return computed(() => value.value + ${index})`)
    lines.push(`}`)
  }

  return lines.join('\n')
}

function getImportedSpecifierName(node: any) {
  if (node?.type === 'Identifier') {
    return node.name as string
  }
  if (
    (node?.type === 'StringLiteral' || node?.type === 'Literal')
    && typeof node.value === 'string'
  ) {
    return node.value as string
  }
  return undefined
}

function isOxcFunctionLike(node: any) {
  return node?.type === 'FunctionDeclaration'
    || node?.type === 'FunctionExpression'
    || node?.type === 'ArrowFunctionExpression'
}

function createModuleAnalysisWithParsedOxcAst(id: string, ast: any) {
  const localFunctions = new Map()
  const exports = new Map()
  const importedBindings = new Map()
  const wevuNamedHookLocals = new Map()
  const wevuNamespaceLocals = new Set()

  function registerFunctionDeclaration(node: any) {
    if (node?.id?.type === 'Identifier') {
      localFunctions.set(node.id.name, node)
    }
  }

  function registerVariableFunction(node: any) {
    if (node?.id?.type !== 'Identifier' || !isOxcFunctionLike(node.init)) {
      return
    }
    localFunctions.set(node.id.name, node.init)
  }

  for (const stmt of ast.body ?? []) {
    if (stmt?.type === 'FunctionDeclaration') {
      registerFunctionDeclaration(stmt)
      continue
    }

    if (stmt?.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations ?? []) {
        registerVariableFunction(decl)
      }
      continue
    }

    if (stmt?.type === 'ImportDeclaration') {
      const source = getImportedSpecifierName(stmt.source)
      if (!source) {
        continue
      }
      for (const specifier of stmt.specifiers ?? []) {
        if (specifier.type === 'ImportSpecifier' && specifier.local?.type === 'Identifier') {
          const importedName = getImportedSpecifierName(specifier.imported)
          if (!importedName) {
            continue
          }
          if (source === WE_VU_MODULE_ID) {
            const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName as keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE]
            if (matched) {
              wevuNamedHookLocals.set(specifier.local.name, matched)
            }
          }
          importedBindings.set(specifier.local.name, {
            kind: 'named',
            source,
            importedName,
          })
        }
        else if (specifier.type === 'ImportDefaultSpecifier' && specifier.local?.type === 'Identifier') {
          importedBindings.set(specifier.local.name, { kind: 'default', source })
        }
        else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local?.type === 'Identifier') {
          importedBindings.set(specifier.local.name, { kind: 'namespace', source })
          if (source === WE_VU_MODULE_ID) {
            wevuNamespaceLocals.add(specifier.local.name)
          }
        }
      }
      continue
    }

    if (stmt?.type === 'ExportNamedDeclaration') {
      if (stmt.declaration?.type === 'FunctionDeclaration') {
        registerFunctionDeclaration(stmt.declaration)
        if (stmt.declaration.id?.type === 'Identifier') {
          exports.set(stmt.declaration.id.name, { type: 'local', localName: stmt.declaration.id.name })
        }
        continue
      }

      if (stmt.declaration?.type === 'VariableDeclaration') {
        for (const decl of stmt.declaration.declarations ?? []) {
          registerVariableFunction(decl)
          if (decl.id?.type === 'Identifier') {
            exports.set(decl.id.name, { type: 'local', localName: decl.id.name })
          }
        }
        continue
      }

      const source = getImportedSpecifierName(stmt.source)
      for (const spec of stmt.specifiers ?? []) {
        if (spec?.type !== 'ExportSpecifier') {
          continue
        }
        const exportedName = getImportedSpecifierName(spec.exported)
        const localName = getImportedSpecifierName(spec.local)
        if (!exportedName || !localName) {
          continue
        }
        if (source) {
          exports.set(exportedName, { type: 'reexport', source, importedName: localName })
        }
        else {
          exports.set(exportedName, { type: 'local', localName })
        }
      }
      continue
    }

    if (stmt?.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration
      if (decl?.type === 'FunctionDeclaration') {
        registerFunctionDeclaration(decl)
        if (decl.id?.type === 'Identifier') {
          exports.set('default', { type: 'local', localName: decl.id.name })
        }
        else {
          exports.set('default', { type: 'inline', node: decl })
        }
      }
      else if (decl?.type === 'Identifier') {
        exports.set('default', { type: 'local', localName: decl.name })
      }
      else if (isOxcFunctionLike(decl)) {
        exports.set('default', { type: 'inline', node: decl })
      }
    }
  }

  return {
    id,
    engine: 'oxc',
    wevuNamedHookLocals,
    wevuNamespaceLocals,
    importedBindings,
    localFunctions,
    exports,
  }
}

describe('ast hot paths: babel vs oxc', () => {
  const template = createSetDataPickTemplate()
  const pageScrollSource = createOnPageScrollSource()
  const moduleSource = createModuleAnalysisSource()
  const unrelatedSource = createUnrelatedSource()
  const importedButUnusedWevuFactorySource = createImportedButUnusedWevuFactorySource()
  const componentPropsUnrelatedSource = createComponentPropsUnrelatedSource()
  const parsedBabelModule = parseJsLike(moduleSource)
  const parsedOxcModule = parseSync('bench.ts', moduleSource).program
  let moduleAnalysisColdSeq = 0
  let optionsObjectsColdSeq = 0

  bench(
    'setDataPick / babel',
    () => {
      collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'setDataPick / oxc',
    () => {
      collectSetDataPickKeysFromTemplateCode(template, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'onPageScroll warnings / babel',
    () => {
      collectOnPageScrollPerformanceWarnings(pageScrollSource, '/src/pages/index.ts', { engine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'onPageScroll warnings / oxc',
    () => {
      collectOnPageScrollPerformanceWarnings(pageScrollSource, '/src/pages/index.ts', { engine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'componentProps unrelated / babel',
    () => {
      collectComponentPropsFromCode(componentPropsUnrelatedSource, { astEngine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'componentProps unrelated / oxc',
    () => {
      collectComponentPropsFromCode(componentPropsUnrelatedSource, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'featureFlags unrelated / babel',
    () => {
      collectFeatureFlagsFromCode(componentPropsUnrelatedSource, {
        astEngine: 'babel',
        moduleId: WE_VU_MODULE_ID,
        hookToFeature: WE_VU_PAGE_HOOK_TO_FEATURE,
      })
    },
    defaultBenchOptions,
  )

  bench(
    'featureFlags unrelated / oxc',
    () => {
      collectFeatureFlagsFromCode(componentPropsUnrelatedSource, {
        astEngine: 'oxc',
        moduleId: WE_VU_MODULE_ID,
        hookToFeature: WE_VU_PAGE_HOOK_TO_FEATURE,
      })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis / babel (cold)',
    () => {
      createModuleAnalysisFromCode(`/src/page-babel-${moduleAnalysisColdSeq++}.ts`, moduleSource, { astEngine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis / oxc (cold)',
    () => {
      createModuleAnalysisFromCode(`/src/page-oxc-${moduleAnalysisColdSeq++}.ts`, moduleSource, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis / oxc (js id, cold)',
    () => {
      createModuleAnalysisFromCode(`/src/page-oxc-js-${moduleAnalysisColdSeq++}.js`, moduleSource, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis / babel (cached)',
    () => {
      createModuleAnalysisFromCode('/src/page.cached.ts', moduleSource, { astEngine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis / oxc (cached)',
    () => {
      createModuleAnalysisFromCode('/src/page.cached.ts', moduleSource, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis parse only / babel',
    () => {
      parseJsLike(moduleSource)
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis parse only / oxc',
    () => {
      return parseSync('bench.ts', moduleSource).program
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis parse only / oxc (js id)',
    () => {
      return parseSync('bench.js', moduleSource).program
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis analysis only / babel',
    () => {
      createModuleAnalysis('/src/page.ts', parsedBabelModule)
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures moduleAnalysis analysis only / oxc',
    () => {
      createModuleAnalysisWithParsedOxcAst('/src/page.ts', parsedOxcModule)
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures optionsObjects unrelated / babel (cold)',
    () => {
      collectTargetOptionsObjectsFromCode(unrelatedSource, `/src/store-babel-${optionsObjectsColdSeq++}.ts`, { astEngine: 'babel' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures optionsObjects unrelated / oxc fast reject (cold)',
    () => {
      collectTargetOptionsObjectsFromCode(unrelatedSource, `/src/store-oxc-${optionsObjectsColdSeq++}.ts`, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures optionsObjects unrelated / oxc fast reject (cached)',
    () => {
      collectTargetOptionsObjectsFromCode(unrelatedSource, '/src/store.cached.ts', { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )

  bench(
    'pageFeatures optionsObjects imported-but-unused wevu factory / oxc fast reject (cold)',
    () => {
      collectTargetOptionsObjectsFromCode(importedButUnusedWevuFactorySource, `/src/store-wevu-unused-${optionsObjectsColdSeq++}.ts`, { astEngine: 'oxc' })
    },
    defaultBenchOptions,
  )
})
