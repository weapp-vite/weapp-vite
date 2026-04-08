import type { PluginContext } from 'rolldown'
import type { AstEngineName } from '../../../../ast'
import type { CompilerContext } from '../../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import { collectScriptSetupImportsFromCode, resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { resolveUsingComponentReference } from '../../../vue/transform/usingComponentResolver'
import { ensureTemplateScanned } from './watch'

export function collectVueTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动 usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
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
) {
  return ensureTemplateScanned(pluginCtx, id, scanTemplateEntryFn, existsCache, ttlMs)
}

export async function applyScriptSetupUsingComponents(options: {
  pluginCtx: PluginContext
  vueEntryPath: string
  templatePath: string
  json: any
  configService: CompilerContext['configService']
  wxmlService?: CompilerContext['wxmlService']
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
}) {
  const {
    pluginCtx,
    vueEntryPath,
    templatePath,
    json,
    configService,
    wxmlService,
    reExportResolutionCache,
  } = options

  try {
    const { descriptor, errors } = await readAndParseSfc(vueEntryPath, {
      ...createReadAndParseSfcOptions(pluginCtx, configService),
    })
    if (!errors?.length && descriptor?.template && !templatePath) {
      const tags = collectVueTemplateAutoImportTags(descriptor.template.content, vueEntryPath)
      if (tags.size) {
        const components = Object.fromEntries(
          Array.from(tags, tag => [tag, [{ start: 0, end: 0 }]]),
        )
        wxmlService?.setWxmlComponentsMap(vueEntryPath, components)
      }
    }

    if (!errors?.length && descriptor?.scriptSetup && descriptor?.template) {
      const templateComponentNames = collectVueTemplateComponentNames(descriptor.template.content, vueEntryPath)
      if (templateComponentNames.size) {
        const astEngine = resolveAstEngine(configService.weappViteConfig)
        const imports = collectScriptSetupImports(descriptor.scriptSetup.content, templateComponentNames, {
          astEngine,
        })
        if (imports.length) {
          const usingComponents: Record<string, string> = (
            json && typeof json.usingComponents === 'object' && json.usingComponents && !Array.isArray(json.usingComponents)
              ? json.usingComponents
              : {}
          )

          for (const { localName, importSource, importedName, kind } of imports) {
            let { from } = await resolveUsingComponentReference(
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

            if (!from && importSource.startsWith('/')) {
              from = removeExtensionDeep(importSource)
            }

            if (!from) {
              continue
            }

            if (Reflect.has(usingComponents, localName) && usingComponents[localName] !== from) {
              logger.warn(
                `[自动 usingComponents] 冲突：${vueEntryPath} 中 usingComponents['${localName}']='${usingComponents[localName]}' 将被 <script setup> 导入覆盖为 '${from}'`,
              )
            }

            usingComponents[localName] = from
          }

          json.usingComponents = usingComponents
        }
      }
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[自动 usingComponents] 解析失败：${vueEntryPath}：${message}`)
  }
}
