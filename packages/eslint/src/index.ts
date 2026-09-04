import type { Linter, Rule } from 'eslint'
import type { WevuCompatibilityDiagnostic, WevuCompatibilityEntry, WevuCompatibilityUpstream } from './compatibility'
import { wevuCompatibilityCatalog } from './compatibility'

const SOURCE_TO_UPSTREAM: Record<string, WevuCompatibilityUpstream | undefined> = {
  'vue': 'vue',
  'pinia': 'pinia',
  'vue-router': 'vue-router',
}

function findEntry(upstream: WevuCompatibilityUpstream, api: string, diagnostic: WevuCompatibilityDiagnostic) {
  return wevuCompatibilityCatalog.find(item => item.upstream === upstream && item.api === api && item.diagnostic === diagnostic)
}

function importedName(specifier: any): string | undefined {
  if (specifier.type !== 'ImportSpecifier') {
    return undefined
  }
  return specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value
}

function reportCompatibility(context: Rule.RuleContext, node: any, entry: WevuCompatibilityEntry) {
  context.report({
    node,
    message: entry.replacement
      ? `{{api}} 不能在 Wevu 中使用；请改用 {{replacement}}。`
      : `{{api}} 在 Wevu 中的语义不同：{{summary}}`,
    data: {
      api: entry.api,
      replacement: entry.replacement,
      summary: entry.summary,
    },
  })
}

function createImportCompatibilityRule(diagnostic: 'error' | 'warn'): Rule.RuleModule {
  return {
    meta: {
      type: 'problem',
      docs: { description: diagnostic === 'error' ? '禁止 Wevu 不支持的上游 API' : '提示 Wevu 同名 API 的语义差异' },
      schema: [],
      messages: {},
    },
    create(context) {
      const namespaces = new Map<string, WevuCompatibilityUpstream>()
      return {
        ImportDeclaration(node: any) {
          const upstream = SOURCE_TO_UPSTREAM[node.source.value]
          if (!upstream || (node.importKind === 'type' && diagnostic === 'error')) {
            return
          }
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportNamespaceSpecifier') {
              namespaces.set(specifier.local.name, upstream)
              continue
            }
            if (specifier.importKind === 'type' && diagnostic === 'error') {
              continue
            }
            const name = importedName(specifier)
            const compatibility = name && findEntry(upstream, name, diagnostic)
            if (compatibility) {
              reportCompatibility(context, specifier, compatibility)
            }
          }
        },
        MemberExpression(node: any) {
          if (node.object.type !== 'Identifier' || (node.computed && node.property.type !== 'Literal')) {
            return
          }
          const upstream = namespaces.get(node.object.name)
          const name = node.computed ? node.property.value : node.property.name
          const compatibility = upstream && typeof name === 'string' && findEntry(upstream, name, diagnostic)
          if (compatibility) {
            reportCompatibility(context, node, compatibility)
          }
        },
        TSQualifiedName(node: any) {
          if (node.left.type !== 'Identifier' || node.right.type !== 'Identifier') {
            return
          }
          const upstream = namespaces.get(node.left.name)
          const compatibility = upstream && findEntry(upstream, node.right.name, diagnostic)
          if (compatibility) {
            reportCompatibility(context, node, compatibility)
          }
        },
      }
    },
  }
}

const noUnsupportedTemplateFeature: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: '禁止可追溯到上游包的不支持模板能力' },
    schema: [],
    messages: {},
  },
  create(context) {
    const routerLinkAliases = new Set<string>()
    const scriptVisitor = {
      ImportDeclaration(node: any) {
        if (node.source.value !== 'vue-router' || node.importKind === 'type') {
          return
        }
        for (const specifier of node.specifiers) {
          if (importedName(specifier) === 'RouterLink') {
            routerLinkAliases.add(specifier.local.name)
          }
        }
      },
    }
    const parserServices = context.sourceCode.parserServices as any
    if (typeof parserServices?.defineTemplateBodyVisitor !== 'function') {
      return scriptVisitor
    }
    return parserServices.defineTemplateBodyVisitor({
      VElement(node: any) {
        const rawName = node.rawName || node.name
        const normalized = String(rawName).replace(/-/g, '').toLowerCase()
        if (![...routerLinkAliases].some(alias => alias.toLowerCase() === normalized)) {
          return
        }
        const compatibility = findEntry('vue-router', '<router-link>', 'error')
          ?? findEntry('vue-router', 'RouterLink', 'error')
        if (compatibility) {
          reportCompatibility(context, node, compatibility)
        }
      },
    }, scriptVisitor)
  },
}

export const wevuCompatibilityPlugin = {
  meta: {
    name: 'weapp-vite-wevu-compatibility',
    version: '1.0.0',
  },
  rules: {
    'no-unsupported-api': createImportCompatibilityRule('error'),
    'no-risky-api': createImportCompatibilityRule('warn'),
    'no-unsupported-template-feature': noUnsupportedTemplateFeature,
  },
}

export const wevuCompatibilityRecommended: Linter.Config = {
  files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}'],
  ignores: ['**/node_modules/**', '**/dist/**', '**/.weapp-vite/**'],
  plugins: {
    wevu: wevuCompatibilityPlugin,
  },
  rules: {
    'wevu/no-unsupported-api': 'error',
    'wevu/no-risky-api': 'warn',
    'wevu/no-unsupported-template-feature': 'error',
  },
}

export type {
  WevuCompatibilityDiagnostic,
  WevuCompatibilityEntry,
  WevuCompatibilityLevel,
  WevuCompatibilitySurface,
  WevuCompatibilityUpstream,
} from './compatibility'
export { findWevuCompatibilityEntry, wevuCompatibilityCatalog } from './compatibility'
export type {
  MiniProgramRuntimeApiDiagnostic,
  MiniProgramRuntimeApiEntry,
  MiniProgramRuntimeApiKind,
  MiniProgramRuntimeApiSupport,
  MiniProgramRuntimeConfigOptions,
} from './miniProgramRuntime'
export {
  createMiniProgramRuntimeConfig,
  MINI_PROGRAM_RUNTIME_DEFAULT_FILES,
  MINI_PROGRAM_RUNTIME_DEFAULT_IGNORES,
  miniProgramRuntimeApiCatalog,
  miniProgramRuntimePlugin,
  miniProgramRuntimeRecommended,
} from './miniProgramRuntime'
