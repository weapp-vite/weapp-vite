import type { PluginContext } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../../../../logger'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../../utils/babel'
import { getPathExistsTtlMs } from '../../../../utils/cachePolicy'
import { resolveEntryPath } from '../../../../utils/entryResolve'
import { resolveReExportedName } from '../../../../utils/reExport'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { usingComponentFromResolvedFile } from '../../../../utils/usingComponentFrom'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../../../utils/cache'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { ensureTemplateScanned } from './watch'

export interface ScriptSetupImport {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

export function collectVueTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
}

export function collectVueTemplateAutoImportTags(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto import tags',
    shouldCollect: isAutoImportCandidateTag,
  })
}

export function collectScriptSetupImports(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: ScriptSetupImport[] = []
  const ast = babelParse(scriptSetup, BABEL_TS_MODULE_PARSER_OPTIONS)

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue
    }
    // @ts-ignore - babel AST shape
    const importKind = (node as any).importKind
    if (importKind === 'type') {
      continue
    }

    const importSource = node.source.value
    for (const specifier of node.specifiers) {
      // @ts-ignore - babel AST shape
      if ((specifier as any).importKind === 'type') {
        continue
      }
      const localName = specifier.local?.name
      if (!localName || !templateComponentNames.has(localName)) {
        continue
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        results.push({ localName, importSource, importedName: 'default', kind: 'default' })
      }
      else if (specifier.type === 'ImportSpecifier') {
        const imported = (specifier as any).imported
        const importedName = imported?.type === 'Identifier'
          ? imported.name
          : imported?.type === 'StringLiteral'
            ? imported.value
            : undefined
        results.push({ localName, importSource, importedName, kind: 'named' })
      }
    }
  }

  return results
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
    const { descriptor, errors } = await readAndParseSfc(vueEntryPath, { checkMtime: getSfcCheckMtime(configService) })
    if (!errors?.length && descriptor?.template && !templatePath) {
      const tags = collectVueTemplateAutoImportTags(descriptor.template.content, vueEntryPath)
      if (tags.size) {
        const components = Object.fromEntries(
          Array.from(tags).map(tag => [tag, [{ start: 0, end: 0 }]]),
        )
        wxmlService?.setWxmlComponentsMap(vueEntryPath, components)
      }
    }

    if (!errors?.length && descriptor?.scriptSetup && descriptor?.template) {
      const templateComponentNames = collectVueTemplateComponentNames(descriptor.template.content, vueEntryPath)
      if (templateComponentNames.size) {
        const imports = collectScriptSetupImports(descriptor.scriptSetup.content, templateComponentNames)
        if (imports.length) {
          const usingComponents: Record<string, string> = (
            json && typeof json.usingComponents === 'object' && json.usingComponents && !Array.isArray(json.usingComponents)
              ? json.usingComponents
              : {}
          )

          for (const { localName, importSource, importedName, kind } of imports) {
            const resolved = await pluginCtx.resolve(importSource, vueEntryPath)
            let resolvedId = resolved?.id ? normalizeFsResolvedId(resolved.id) : undefined
            if (!resolvedId || !path.isAbsolute(resolvedId)) {
              if (importSource.startsWith('.')) {
                resolvedId = path.resolve(path.dirname(vueEntryPath), importSource)
              }
            }

            if (resolvedId && path.isAbsolute(resolvedId) && !path.extname(resolvedId)) {
              const matched = await resolveEntryPath(resolvedId, {
                kind,
                exists: (p: string) => pathExistsCached(p, { ttlMs: getPathExistsTtlMs(configService) }),
                stat: (p: string) => fs.stat(p) as any,
              })
              if (matched) {
                resolvedId = matched
              }
            }

            // 桶文件（barrel）支持：import { X } from '.../components' => 解析 re-export 到真实组件文件
            if (kind === 'named' && importedName && resolvedId && path.isAbsolute(resolvedId) && /\.(?:[cm]?ts|[cm]?js)$/.test(resolvedId)) {
              const mapped = await resolveReExportedName(resolvedId, importedName, {
                cache: reExportResolutionCache,
                maxDepth: 4,
                readFile: file => readFileCached(file, { checkMtime: configService.isDev }),
                resolveId: async (source, importer) => {
                  const hop = await pluginCtx.resolve(source, importer)
                  const hopId = hop?.id ? normalizeFsResolvedId(hop.id) : undefined
                  if (isSkippableResolvedId(hopId)) {
                    return undefined
                  }
                  return hopId
                },
              })
              if (mapped) {
                resolvedId = mapped
              }
            }

            let from: string | undefined
            from = usingComponentFromResolvedFile(resolvedId, configService)

            if (!from && importSource.startsWith('/')) {
              from = removeExtensionDeep(importSource)
            }

            if (!from) {
              continue
            }

            if (Reflect.has(usingComponents, localName) && usingComponents[localName] !== from) {
              logger.warn(
                `[auto usingComponents] 冲突: ${vueEntryPath} 中 usingComponents['${localName}']='${usingComponents[localName]}' 将被 script setup import 覆盖为 '${from}'`,
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
    logger.warn(`[auto usingComponents] 解析失败: ${vueEntryPath}: ${message}`)
  }
}
