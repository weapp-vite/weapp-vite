import type { VueLanguagePlugin } from '@vue/language-core'
import type ts from 'typescript'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { name } from '../package.json'
import { PLUGIN_VERSION } from './constants'
import { getEmbeddedCodesFromCustomBlocks, resolveEmbeddedJsonBlock } from './jsonBlock'
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

function parseVueSfc(content: string, filename = 'component.vue') {
  try {
    const compilerSfc = require('@vue/compiler-sfc') as typeof import('@vue/compiler-sfc')
    return compilerSfc.parse(content, { filename })
  }
  catch {
    return undefined
  }
}

/**
 * Volar 语言插件：为 weapp 配置块提供类型与 schema 提示。
 */
const plugin: VueLanguagePlugin = (ctx) => {
  // TypeScript module is optional in tests; fall back to a lazy require when missing.
  let tsModule: typeof ts | undefined = ctx?.modules?.typescript
  if (!tsModule) {
    try {
      tsModule = require('typescript') as typeof ts
    }
    catch {
      tsModule = undefined
    }
  }

  return {
    name,
    version: PLUGIN_VERSION,
    order: -1,
    parseSFC2(fileName, languageId, content) {
      if (languageId !== 'vue') {
        return
      }

      const parsed = parseVueSfc(content, fileName)
      if (!parsed) {
        return
      }

      const descriptor = parsed.descriptor
      const wxsModuleNames = collectWxsModuleNames(descriptor.template?.content)
      const scriptSetup = descriptor.scriptSetup
      const scriptSetupLang = resolveScriptSetupLang(scriptSetup?.lang)
      const defineOptionsDeclarations = scriptSetup?.content && tsModule
        ? createDefineOptionsTemplateDeclarations(scriptSetup.content, tsModule, scriptSetupLang)
        : ''

      if (!wxsModuleNames.length && !defineOptionsDeclarations) {
        return parsed
      }

      if (descriptor.scriptSetup) {
        descriptor.scriptSetup.content = appendScriptSetupDeclarations(
          appendWxsDeclarations(descriptor.scriptSetup.content, wxsModuleNames),
          defineOptionsDeclarations,
        )
        syncScriptBlockSource(descriptor.scriptSetup)
      }
      else {
        descriptor.scriptSetup = createSyntheticScriptSetup(wxsModuleNames) as unknown as NonNullable<typeof descriptor.scriptSetup>
      }

      return parsed
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
