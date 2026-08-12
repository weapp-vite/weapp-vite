import type { PluginContext } from 'rolldown'
import type { AstEngineName } from '../../../../ast'
import type { CompilerContext } from '../../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { collectScriptSetupImportsFromCode, resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { resolveUsingComponentReference } from '../../../vue/transform/usingComponentResolver'
import { ensureTemplateScanned } from './watch'

interface ResolvedScriptSetupUsingComponent {
  localName: string
  importSource: string
  resolvedId?: string
  from?: string
  templateTags: string[]
}

const TEMPLATE_COMPONENT_TAG_HINT_RE = /<\s*(?:[A-Z_$]|[a-z][\w$]*-)/

function hasTemplateComponentTagHint(source: string) {
  return TEMPLATE_COMPONENT_TAG_HINT_RE.test(source)
}

function kebabToCamel(name: string) {
  return name.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase())
}

function capitalize(name: string) {
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name
}

function collectVueTemplateComponentTagInfo(template: string, filename: string) {
  const templateTags = collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动 usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag) || isAutoImportCandidateTag(tag),
  })
  const componentNames = new Set<string>()
  const tagsByComponentName = new Map<string, Set<string>>()
  for (const tag of templateTags) {
    const camelName = kebabToCamel(tag)
    for (const componentName of [tag, camelName, capitalize(camelName)]) {
      componentNames.add(componentName)
      const matchedTags = tagsByComponentName.get(componentName) ?? new Set<string>()
      matchedTags.add(tag)
      tagsByComponentName.set(componentName, matchedTags)
    }
  }
  return { componentNames, tagsByComponentName }
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
  } = options

  try {
    if (source !== undefined && !hasTemplateComponentTagHint(source)) {
      return
    }

    const { descriptor, errors } = await readAndParseSfc(vueEntryPath, {
      ...createReadAndParseSfcOptions(
        pluginCtx,
        configService,
        source === undefined ? undefined : { source },
      ),
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
      const templateComponentTagInfo = collectVueTemplateComponentTagInfo(descriptor.template.content, vueEntryPath)
      const templateComponentNames = templateComponentTagInfo.componentNames
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

          const resolvedImports = await Promise.all(imports.map(async ({ localName, importSource, importedName, kind }) => {
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
              templateTags: [...(templateComponentTagInfo.tagsByComponentName.get(localName) ?? [localName])],
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
    }
  }
  catch (error) {
    const missingEntry = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    if (missingEntry && configService?.isDev && !await fs.pathExists(vueEntryPath)) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[自动 usingComponents] 解析失败：${vueEntryPath}：${message}`)
  }
}
