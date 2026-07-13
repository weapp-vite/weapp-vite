import type { SFCParseResult, VueLanguagePlugin } from '@vue/language-core'
import type ts from 'typescript'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { name } from '../package.json'
import { DEFINE_OPTIONS_CACHE_MAX, PLUGIN_VERSION } from './constants'
import { getEmbeddedCodesFromCustomBlocks, resolveEmbeddedJsonBlock } from './jsonBlock'
import { parseSfc, updateSfc } from './parseSfc'
import {
  appendScriptSetupDeclarations,
  appendWxsDeclarations,
  collectWxsModuleNames,
  createDefineOptionsTemplateDeclarations,
  createSyntheticScriptSetup,
  resolveScriptSetupLang,
  syncScriptBlockSource,
} from './scriptSetup'

const require = createRequire(
  typeof module !== 'undefined' && module.filename
    ? module.filename
    : path.join(process.cwd(), 'weapp-vite-volar.cjs'),
)

let hasSchematicsTypes = false
try {
  require.resolve('@weapp-core/schematics')
  hasSchematicsTypes = true
}
catch {
  hasSchematicsTypes = false
}

interface RawSfcState {
  hadScriptSetup: boolean
  scriptSetupContent?: string
  scriptSetupSource?: string
}

/**
 * Volar 语言插件：为 weapp 配置块提供类型与 schema 提示。
 */
const plugin: VueLanguagePlugin = (ctx) => {
  const tsModule: typeof ts | undefined = ctx?.modules?.typescript
  const compilerDom = ctx?.modules?.['@vue/compiler-dom']
  const rawSfcStates = new WeakMap<SFCParseResult, RawSfcState>()
  const defineOptionsDeclarationsCache = new Map<string, string>()

  function getDefineOptionsDeclarations(code: string, lang: string) {
    if (!tsModule) {
      return ''
    }
    const key = `${lang}\0${code}`
    const cached = defineOptionsDeclarationsCache.get(key)
    if (cached !== undefined) {
      defineOptionsDeclarationsCache.delete(key)
      defineOptionsDeclarationsCache.set(key, cached)
      return cached
    }
    const declarations = createDefineOptionsTemplateDeclarations(code, tsModule, lang)
    if (defineOptionsDeclarationsCache.size >= DEFINE_OPTIONS_CACHE_MAX) {
      const oldestKey = defineOptionsDeclarationsCache.keys().next().value
      if (oldestKey !== undefined) {
        defineOptionsDeclarationsCache.delete(oldestKey)
      }
    }
    defineOptionsDeclarationsCache.set(key, declarations)
    return declarations
  }

  function restoreRawSfc(parsed: SFCParseResult) {
    const state = rawSfcStates.get(parsed)
    const scriptSetup = parsed.descriptor.scriptSetup
    if (state && !state.hadScriptSetup) {
      parsed.descriptor.scriptSetup = null
    }
    else if (state && scriptSetup && state.scriptSetupContent !== undefined) {
      scriptSetup.content = state.scriptSetupContent
      scriptSetup.loc.source = state.scriptSetupSource ?? state.scriptSetupContent
    }
  }

  function enhanceSfc(parsed: SFCParseResult) {
    const descriptor = parsed.descriptor
    const scriptSetup = descriptor.scriptSetup
    rawSfcStates.set(parsed, {
      hadScriptSetup: Boolean(scriptSetup),
      scriptSetupContent: scriptSetup?.content,
      scriptSetupSource: scriptSetup?.loc.source,
    })
    const wxsModuleNames = collectWxsModuleNames(descriptor.template?.content)
    const scriptSetupLang = resolveScriptSetupLang(scriptSetup?.lang)
    const defineOptionsDeclarations = scriptSetup?.content.includes('defineOptions')
      ? getDefineOptionsDeclarations(scriptSetup.content, scriptSetupLang)
      : ''

    if (!wxsModuleNames.length && !defineOptionsDeclarations) {
      return
    }
    if (scriptSetup) {
      scriptSetup.content = appendScriptSetupDeclarations(
        appendWxsDeclarations(scriptSetup.content, wxsModuleNames),
        defineOptionsDeclarations,
      )
      syncScriptBlockSource(scriptSetup)
    }
    else {
      descriptor.scriptSetup = createSyntheticScriptSetup(wxsModuleNames) as NonNullable<typeof descriptor.scriptSetup>
    }
  }

  return {
    name,
    version: PLUGIN_VERSION,
    order: -1,
    parseSFC2(fileName, languageId, content) {
      if (languageId !== 'vue' || !compilerDom) {
        return
      }
      const parsed = parseSfc(compilerDom, content, fileName)
      enhanceSfc(parsed)
      return parsed
    },
    updateSFC(oldResult, change) {
      restoreRawSfc(oldResult)
      const updated = updateSfc(oldResult, change)
      if (!updated) {
        return
      }
      enhanceSfc(updated)
      return updated
    },
    getEmbeddedCodes(_, sfc) {
      return getEmbeddedCodesFromCustomBlocks(sfc)
    },
    resolveEmbeddedCode(fileName, sfc, embeddedCode) {
      resolveEmbeddedJsonBlock(fileName, sfc, embeddedCode, tsModule, hasSchematicsTypes)
    },
  }
}

export default plugin
