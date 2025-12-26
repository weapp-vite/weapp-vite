import type { VueLanguagePlugin } from '@vue/language-core'
import { createRequire } from 'node:module'
import { name } from '../package.json'
import { getSchemaForType } from './schema'

const BLOCK_TYPE = 'config'
const JSON_LANG = 'json'
const TS_LANG = 'ts'
const PLUGIN_VERSION = 2.2 as const

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

const require = createRequire(import.meta.url)

let hasSchematicsTypes = false
try {
  require.resolve('@weapp-core/schematics')
  hasSchematicsTypes = true
}
catch {
  hasSchematicsTypes = false
}

function normalizeLang(lang?: string) {
  if (!lang) {
    return JSON_LANG
  }
  if (lang === 'txt') {
    return JSON_LANG
  }
  // jsonc (JSON with Comments) should be treated as JSON
  if (lang === 'jsonc') {
    return JSON_LANG
  }
  return lang
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

const plugin: VueLanguagePlugin = () => {
  return {
    name,
    version: PLUGIN_VERSION,
    getEmbeddedCodes(_, sfc) {
      const names = []
      for (let i = 0; i < sfc.customBlocks.length; i++) {
        const block = sfc.customBlocks[i]
        if (block.type === BLOCK_TYPE) {
          const normalizedLang = normalizeLang(block.lang)
          // For js/ts config blocks, use TypeScript for type checking
          const lang = (hasSchematicsTypes && (block.lang === 'js' || block.lang === 'ts' || block.lang === 'json' || block.lang === 'jsonc' || !block.lang))
            ? TS_LANG
            : normalizedLang
          names.push({ id: `${BLOCK_TYPE}_${i}`, lang })
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

      // Check if user explicitly wants JSON (with $schema, lang="json", or lang="jsonc")
      const userWantsJson = block.lang === 'json' || block.lang === 'jsonc' || block.content.includes('$schema')

      // Check if user wants JS/TS config
      const userWantsJs = block.lang === 'js' || block.lang === 'ts'

      if (userWantsJs) {
        // For JS/TS config blocks, add type hints
        const prefix = `import type { ${configType} as __WeappConfig } from '@weapp-core/schematics'\n\n`
        const suffix = '\n satisfies __WeappConfig\n'

        embeddedCode.content.push([
          prefix,
          undefined,
          0,
          VOID_CAPABILITIES,
        ])
        embeddedCode.content.push([
          block.content,
          block.name,
          0,
          FULL_CAPABILITIES,
        ])
        embeddedCode.content.push([
          suffix,
          undefined,
          block.content.length,
          VOID_CAPABILITIES,
        ])
        return
      }

      if (userWantsJson) {
        // For JSON mode, add schema comment for better IDE support
        const schema = getSchemaForType(configType)
        if (schema && schema.$id && !block.content.includes('$schema')) {
          // Auto-inject $schema if not present
          const schemaComment = `  "$schema": "${schema.$id}",\n`
          const content = block.content.trim()
          const hasOpeningBrace = content.startsWith('{')
          const injected = hasOpeningBrace
            ? `${content.slice(0, 1)}\n${schemaComment}${content.slice(1)}`
            : block.content

          embeddedCode.content.push([
            injected,
            block.name,
            0,
            FULL_CAPABILITIES,
          ])
        }
        else {
          embeddedCode.content.push([
            block.content,
            block.name,
            0,
            FULL_CAPABILITIES,
          ])
        }
        return
      }

      // Default: Use TypeScript with type checking
      const prefix = `import type { ${configType} as __WeappConfig } from '@weapp-core/schematics'\n\nexport default `
      const suffix = ' satisfies __WeappConfig\n'
      embeddedCode.content.push([
        prefix,
        undefined,
        0,
        VOID_CAPABILITIES,
      ])
      embeddedCode.content.push([
        block.content,
        block.name,
        0,
        FULL_CAPABILITIES,
      ])
      embeddedCode.content.push([
        suffix,
        undefined,
        block.content.length,
        VOID_CAPABILITIES,
      ])
    },
  }
}

export default plugin
