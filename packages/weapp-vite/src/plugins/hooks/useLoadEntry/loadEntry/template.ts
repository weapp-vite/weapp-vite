import type { PluginContext } from 'rolldown'
import type { AstEngineName } from '../../../../ast'
import type { CompilerContext } from '../../../../context'
import type { ScriptSetupAnalyzer } from './scriptSetupAnalysis'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { collectScriptSetupImportsFromCode, resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { resolveUsingComponentReference } from '../../../vue/transform/usingComponentResolver'
import { createScriptSetupAnalyzer } from './scriptSetupAnalysis'
import { collectComponentTagInfo } from './scriptSetupAnalysis/componentTags'
import { ensureTemplateScanned } from './watch'

interface ResolvedScriptSetupUsingComponent {
  localName: string
  importSource: string
  resolvedId?: string
  from?: string
  templateTags: readonly string[]
}

const TEMPLATE_COMPONENT_TAG_HINT_RE = /<\s*(?:[A-Z_$]|[a-z][\w$]*-)/
const EXTERNAL_TEMPLATE_HINT_RE = /<template\b(?:[^>"']|"[^"]*"|'[^']*')+\bsrc\s*=/i

function hasTemplateComponentTagHint(source: string) {
  return TEMPLATE_COMPONENT_TAG_HINT_RE.test(source) || EXTERNAL_TEMPLATE_HINT_RE.test(source)
}

function collectVueTemplateComponentTagInfo(template: string, filename: string) {
  const templateTags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动 usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag) || isAutoImportCandidateTag(tag),
  })
  return collectComponentTagInfo(templateTags)
}

export function collectVueTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateComponentTagInfo(template, filename).componentNames
}

export function collectVueTemplateAutoImportTags(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动导入标签',
    shouldCollect: isAutoImportCandidateTag,
  })
}

export function collectScriptSetupImports(
  scriptSetup: string,
  templateComponentNames: Set<string>,
  options?: {
    astEngine?: AstEngineName
  },
) {
  return collectScriptSetupImportsFromCode(scriptSetup, templateComponentNames, options)
}

export async function scanTemplateEntry(
  pluginCtx: PluginContext,
  id: string,
  scanTemplateEntryFn: (templateEntry: string) => Promise<void>,
  existsCache: Map<string, boolean>,
  ttlMs: number,
  platform?: CompilerContext['configService']['platform'],
) {
  return ensureTemplateScanned(pluginCtx, id, scanTemplateEntryFn, existsCache, ttlMs, platform)
}

export async function applyScriptSetupUsingComponents(options: {
  pluginCtx: PluginContext
  vueEntryPath: string
  source?: string
  templatePath: string
  json: any
  configService: CompilerContext['configService']
  wxmlService?: CompilerContext['wxmlService']
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  externalComponentEntryMap?: Map<string, string>
  scriptSetupAnalyzer?: ScriptSetupAnalyzer
}) {
  const {
    pluginCtx,
    vueEntryPath,
    source,
    templatePath,
    json,
    configService,
    wxmlService,
    reExportResolutionCache,
    externalComponentEntryMap,
    scriptSetupAnalyzer = createScriptSetupAnalyzer(),
  } = options

  try {
    if (source !== undefined && !hasTemplateComponentTagHint(source)) {
      scriptSetupAnalyzer.discard(vueEntryPath)
      return
    }

    const { descriptor, errors } = await readAndParseSfc(vueEntryPath, {
      ...createReadAndParseSfcOptions(
        pluginCtx,
        configService,
        source === undefined ? undefined : { source },
      ),
    })
    if (errors?.length || !descriptor?.template) {
      scriptSetupAnalyzer.discard(vueEntryPath)
      return
    }
    const analysis = scriptSetupAnalyzer.analyze({
      filename: vueEntryPath,
      template: descriptor.template.content,
      scriptSetup: descriptor.scriptSetup?.content,
      astEngine: resolveAstEngine(configService.weappViteConfig),
    })
    if (!templatePath) {
      const tags = analysis.autoImportTags
      if (tags.length) {
        const components = Object.fromEntries(
          Array.from(tags, tag => [tag, [{ start: 0, end: 0 }]]),
        )
        wxmlService?.setWxmlComponentsMap(vueEntryPath, components)
      }
    }

    const imports = analysis.imports
    if (imports.length) {
      const usingComponents: Record<string, string> = (
        json && typeof json.usingComponents === 'object' && json.usingComponents && !Array.isArray(json.usingComponents)
          ? json.usingComponents
          : {}
      )

      const resolvedImports = await Promise.all(imports.map(async ({ localName, importSource, importedName, kind, templateTags }) => {
        const { resolvedId, from: resolvedFrom } = await resolveUsingComponentReference(
          pluginCtx,
          configService,
          reExportResolutionCache,
          importSource,
          vueEntryPath,
          {
            localName,
            kind,
            importedName,
            fallbackRelativeImporterDir: true,
          },
        )
        return {
          localName,
          importSource,
          resolvedId,
          from: resolvedFrom,
          templateTags,
        } satisfies ResolvedScriptSetupUsingComponent
      }))

      for (const { importSource, resolvedId, from: resolvedFrom, templateTags } of resolvedImports) {
        let from = resolvedFrom

        if (!from && importSource.startsWith('/')) {
          from = removeExtensionDeep(importSource)
        }

        if (!from) {
          continue
        }

        for (const tag of templateTags) {
          if (Reflect.has(usingComponents, tag) && usingComponents[tag] !== from) {
            logger.warn(
              `[自动 usingComponents] 冲突：${vueEntryPath} 中 usingComponents['${tag}']='${usingComponents[tag]}' 将被 <script setup> 导入覆盖为 '${from}'`,
            )
          }
          usingComponents[tag] = from
        }

        if (resolvedId) {
          externalComponentEntryMap?.set(removeExtensionDeep(from).replace(/^\/+/, ''), resolvedId)
        }
      }

      json.usingComponents = usingComponents
    }
  }
  catch (error) {
    scriptSetupAnalyzer.discard(vueEntryPath)
    const missingEntry = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    if (missingEntry && configService?.isDev && !await fs.pathExists(vueEntryPath)) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[自动 usingComponents] 解析失败：${vueEntryPath}：${message}`)
  }
}
