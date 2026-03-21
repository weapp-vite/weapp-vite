import type ts from 'typescript'
import {
  BACKSLASH_RE,
  BLOCK_TYPE,
  FULL_CAPABILITIES,
  JS_LANG,
  JSON5_LANG,
  JSON_LANG,
  JSONC_LANG,
  NON_SPACE_RE,
  TS_LANG,
  TS_SCRIPT_KIND_JS,
  TS_SCRIPT_KIND_TS,
  TS_SCRIPT_TARGET_LATEST,
  VOID_CAPABILITIES,
} from './constants'
import { getSchemaForType } from './schema'

export function normalizeFilename(filename?: string) {
  if (!filename) {
    return ''
  }
  return filename.replace(BACKSLASH_RE, '/')
}

export function inferConfigType(filename?: string) {
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

export function normalizeLang(lang?: string) {
  if (!lang) {
    return JSON_LANG
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return JSON_LANG
  }
  return lower
}

export function getEmbeddedCodesFromCustomBlocks(sfc: { customBlocks: ReadonlyArray<{ type: string, lang?: string }> }) {
  const names = []
  for (let i = 0; i < sfc.customBlocks.length; i++) {
    const block = sfc.customBlocks[i]
    if (block.type === BLOCK_TYPE) {
      const normalizedLang = normalizeLang(block.lang)
      const isJsLike = normalizedLang === JS_LANG || normalizedLang === TS_LANG

      if (isJsLike) {
        names.push({ id: `${BLOCK_TYPE}_${i}`, lang: TS_LANG })
        continue
      }

      const embeddedLang = normalizedLang === JSON_LANG || normalizedLang === JSONC_LANG || normalizedLang === JSON5_LANG
        ? JSONC_LANG
        : JSON_LANG

      names.push({ id: `${BLOCK_TYPE}_${i}`, lang: embeddedLang })
    }
  }
  return names
}

function findExportDefaultExpression(
  code: string,
  tsModule: typeof ts,
  lang: string,
) {
  const scriptKind = lang === TS_LANG ? TS_SCRIPT_KIND_TS : TS_SCRIPT_KIND_JS
  const sourceFile = tsModule.createSourceFile(
    `config.${lang}`,
    code,
    TS_SCRIPT_TARGET_LATEST,
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
  const firstNonSpace = afterLeft.match(NON_SPACE_RE)
  const nextCharIndex = firstNonSpace ? leftBraceIndex + 1 + firstNonSpace.index! : -1
  const isEmptyObject = nextCharIndex >= 0 && content[nextCharIndex] === '}'

  const schemaLine = `  "$schema": "${schemaId}"`
  const injected = isEmptyObject
    ? `{\n${schemaLine}\n}`
    : `{\n${schemaLine},${content.slice(leftBraceIndex + 1)}`

  if (trimmed === content) {
    return injected
  }
  const leading = content.slice(0, content.indexOf(trimmed))
  const trailing = content.slice(content.indexOf(trimmed) + trimmed.length)
  return `${leading}${injected}${trailing}`
}

export function resolveEmbeddedJsonBlock(
  fileName: string,
  sfc: { customBlocks: ReadonlyArray<{ type: string, lang?: string, content: string, name?: string }> },
  embeddedCode: { id: string, content: any[] },
  tsModule: typeof ts | undefined,
  hasSchematicsTypes: boolean,
) {
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
    if (parsed) {
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

    embeddedCode.content.push([
      block.content,
      block.name,
      0,
      FULL_CAPABILITIES,
    ])
    return
  }

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
}
