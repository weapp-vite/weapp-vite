import type { VueLanguagePlugin } from '@vue/language-core'
import type ts from 'typescript'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { name } from '../package.json'
import { getSchemaForType } from './schema'

const BLOCK_TYPE = 'json'
const JS_LANG = 'js'
const JSONC_LANG = 'jsonc'
const JSON_LANG = 'json'
const JSON5_LANG = 'json5'
const PLUGIN_VERSION = 2.2 as const
const TS_LANG = 'ts'

const FULL_CAPABILITIES = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: true,
  format: true,
} as const

const VOID_CAPABILITIES = {
  verification: false,
  completion: false,
  semantic: false,
  navigation: false,
  structure: false,
  format: false,
} as const

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

function normalizeFilename(filename?: string) {
  if (!filename) {
    return ''
  }
  return filename.replace(/\\/g, '/')
}

function inferConfigType(filename?: string) {
  const normalized = normalizeFilename(filename)
  if (normalized.endsWith('/app.vue')) {
    return 'App'
  }
  if (normalized.includes('/plugin/')) {
    return 'Plugin'
  }
  if (normalized.includes('/components/')) {
    return 'Component'
  }
  if (normalized.includes('/theme/')) {
    return 'Theme'
  }
  if (normalized.includes('/sitemap')) {
    return 'Sitemap'
  }
  return 'Page'
}

function normalizeLang(lang?: string) {
  if (!lang) {
    return JSON_LANG
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return JSON_LANG
  }
  return lower
}

function findExportDefaultExpression(
  code: string,
  tsModule: typeof ts,
  lang: string,
) {
  const scriptKind = lang === TS_LANG ? tsModule.ScriptKind.TS : tsModule.ScriptKind.JS
  const sourceFile = tsModule.createSourceFile(
    `config.${lang}`,
    code,
    tsModule.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  for (const statement of sourceFile.statements) {
    if (tsModule.isExportAssignment(statement)) {
      const expressionStart = statement.expression.getStart(sourceFile)
      const expressionEnd = statement.expression.getEnd()
      const leading = code.slice(0, statement.getStart(sourceFile))
      const expression = code.slice(expressionStart, expressionEnd)
      const trailing = code.slice(statement.getEnd())

      return {
        expression,
        expressionStart,
        expressionEnd,
        leading,
        trailing,
      }
    }
  }

  return null
}

function injectSchemaIntoJsonObject(content: string, schemaId: string) {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) {
    return content
  }
  const leftBraceIndex = content.indexOf('{')
  if (leftBraceIndex < 0) {
    return content
  }
  const afterLeft = content.slice(leftBraceIndex + 1)
  const firstNonSpace = afterLeft.match(/\S/)
  const nextCharIndex = firstNonSpace ? leftBraceIndex + 1 + firstNonSpace.index! : -1
  const isEmptyObject = nextCharIndex >= 0 && content[nextCharIndex] === '}'

  const schemaLine = `  "$schema": "${schemaId}"`
  const injected = isEmptyObject
    ? `{\n${schemaLine}\n}`
    : `{\n${schemaLine},${content.slice(leftBraceIndex + 1)}`

  // Keep original leading/trailing spaces around the JSON object as much as possible.
  if (trimmed === content) {
    return injected
  }
  const leading = content.slice(0, content.indexOf(trimmed))
  const trailing = content.slice(content.indexOf(trimmed) + trimmed.length)
  return `${leading}${injected}${trailing}`
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
    getEmbeddedCodes(_, sfc) {
      const names = []
      for (let i = 0; i < sfc.customBlocks.length; i++) {
        const block = sfc.customBlocks[i]
        if (block.type === BLOCK_TYPE) {
          const normalizedLang = normalizeLang(block.lang)
          const isJsLike = normalizedLang === JS_LANG || normalizedLang === TS_LANG

          if (isJsLike) {
            // For js/ts blocks, use TypeScript for richer IntelliSense
            names.push({ id: `${BLOCK_TYPE}_${i}`, lang: TS_LANG })
            continue
          }

          // json/jsonc/json5 blocks all allow comments at runtime, so always map to jsonc for IDE.
          // json5 has no first-class language id, so it also maps to jsonc.
          const embeddedLang = normalizedLang === JSON_LANG || normalizedLang === JSONC_LANG || normalizedLang === JSON5_LANG
            ? JSONC_LANG
            : JSON_LANG

          names.push({ id: `${BLOCK_TYPE}_${i}`, lang: embeddedLang })
        }
      }
      return names
    },
    resolveEmbeddedCode(fileName, sfc, embeddedCode) {
      const match = embeddedCode.id.match(new RegExp(`^${BLOCK_TYPE}_(\\d+)$`))
      if (!match) {
        return
      }
      const index = Number.parseInt(match[1])
      const block = sfc.customBlocks[index]
      if (!block) {
        return
      }
      const normalizedLang = normalizeLang(block.lang)
      const configType = inferConfigType(fileName)

      // If no schematics types available, use plain code
      if (!hasSchematicsTypes) {
        embeddedCode.content.push([
          block.content,
          block.name,
          0,
          FULL_CAPABILITIES,
        ])
        return
      }

      const userWantsJs = normalizedLang === JS_LANG || normalizedLang === TS_LANG
      if (userWantsJs) {
        const parsed = tsModule && findExportDefaultExpression(block.content, tsModule, normalizedLang)
        if (parsed && hasSchematicsTypes) {
          const typeImport = `import type { ${configType} as __WeappConfig } from '@weapp-core/schematics'\n`
          const helper = 'const __weapp_defineConfig = <T extends __WeappConfig>(config: T) => config\n\n'

          embeddedCode.content.push([
            `${typeImport}${helper}`,
            undefined,
            0,
            VOID_CAPABILITIES,
          ])

          if (parsed.leading) {
            embeddedCode.content.push([
              parsed.leading,
              block.name,
              0,
              FULL_CAPABILITIES,
            ])
          }

          embeddedCode.content.push([
            'export default __weapp_defineConfig(',
            undefined,
            parsed.expressionStart,
            VOID_CAPABILITIES,
          ])

          embeddedCode.content.push([
            parsed.expression,
            block.name,
            parsed.expressionStart,
            FULL_CAPABILITIES,
          ])

          embeddedCode.content.push([
            ')',
            undefined,
            parsed.expressionEnd,
            VOID_CAPABILITIES,
          ])

          if (parsed.trailing) {
            embeddedCode.content.push([
              parsed.trailing,
              block.name,
              parsed.expressionEnd,
              FULL_CAPABILITIES,
            ])
          }
          return
        }

        // Fallback: keep user code intact to avoid breaking JS/TS,
        // still leveraging TypeScript language mode for IntelliSense.
        embeddedCode.content.push([
          block.content,
          block.name,
          0,
          FULL_CAPABILITIES,
        ])
        return
      }

      // Default: JSON/JSONC/JSON5 mode
      const schema = getSchemaForType(configType)
      if (schema && schema.$id && !block.content.includes('$schema')) {
        embeddedCode.content.push([
          injectSchemaIntoJsonObject(block.content, schema.$id),
          block.name,
          0,
          FULL_CAPABILITIES,
        ])
        return
      }

      embeddedCode.content.push([
        block.content,
        block.name,
        0,
        FULL_CAPABILITIES,
      ])
    },
  }
}

export default plugin
