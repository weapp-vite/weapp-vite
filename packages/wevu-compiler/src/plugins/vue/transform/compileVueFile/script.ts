import type { File as BabelFile } from '@babel/types'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { TemplateCompileResult } from '../../compiler/template'
import type { AutoUsingComponentsOptions, CompileVueFileOptions } from './types'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { compileScript } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'
import { collectVueTemplateTags, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'
import { resolveWarnHandler } from '../../../../utils/warn'
import { stripJsonMacroCallsFromCode } from '../jsonMacros'
import { transformScript } from '../script'

export interface ScriptPhaseResult {
  script?: string
  autoUsingComponentsMap: Record<string, string>
  autoComponentMeta: Record<string, string>
}

function collectTemplateComponentNames(template: string, filename: string, warn?: (message: string) => void) {
  const warnHandler = resolveWarnHandler(warn)
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动 usingComponents',
    warn: (message: string) => warnHandler(message),
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
}

type SfcDescriptor = Parameters<typeof compileScript>[0]

export async function compileScriptPhase(
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template' | 'script'>,
  descriptorForCompile: SfcDescriptor,
  filename: string,
  options: CompileVueFileOptions | undefined,
  autoUsingComponents: AutoUsingComponentsOptions | undefined,
  templateCompiled: TemplateCompileResult | undefined,
  isAppFile: boolean,
): Promise<ScriptPhaseResult> {
  const autoUsingComponentsMap: Record<string, string> = {}
  const autoComponentMeta: Record<string, string> = {}

  if (autoUsingComponents && descriptor.scriptSetup && descriptor.template) {
    const templateComponentNames = collectTemplateComponentNames(descriptor.template.content, filename, autoUsingComponents.warn ?? options?.warn)
    if (templateComponentNames.size) {
      try {
        const setupAst: BabelFile = babelParse(descriptorForCompile.scriptSetup!.content, BABEL_TS_MODULE_PARSER_OPTIONS)
        const pending: Array<{ localName: string, importSource: string, importedName?: string, kind: 'default' | 'named' }> = []

        traverse(setupAst, {
          ImportDeclaration(path) {
            if (path.node.importKind === 'type') {
              return
            }
            if (!t.isStringLiteral(path.node.source)) {
              return
            }
            const importSource = path.node.source.value
            for (const specifier of path.node.specifiers) {
              if ('importKind' in specifier && specifier.importKind === 'type') {
                continue
              }
              if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
                continue
              }
              const localName = specifier.local.name
              if (!templateComponentNames.has(localName)) {
                continue
              }
              if (t.isImportDefaultSpecifier(specifier)) {
                pending.push({ localName, importSource, importedName: 'default', kind: 'default' })
              }
              else if (t.isImportSpecifier(specifier)) {
                const importedName = t.isIdentifier(specifier.imported)
                  ? specifier.imported.name
                  : t.isStringLiteral(specifier.imported)
                    ? specifier.imported.value
                    : undefined
                pending.push({ localName, importSource, importedName, kind: 'named' })
              }
            }
          },
        })

        for (const { localName, importSource, importedName, kind } of pending) {
          let resolved = await autoUsingComponents.resolveUsingComponentPath!(importSource, filename, {
            localName,
            importedName,
            kind,
          })
          if (!resolved && importSource.startsWith('/')) {
            resolved = removeExtensionDeep(importSource)
          }
          if (!resolved) {
            continue
          }
          autoUsingComponentsMap[localName] = resolved
          autoComponentMeta[localName] = resolved
        }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        autoUsingComponents.warn?.(`[Vue 编译] 解析 ${filename} 的 <script setup> 导入失败：${message}`)
      }
    }
  }

  let scriptCode: string | undefined
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = compileScript(descriptorForCompile, {
      id: filename,
      isProd: false,
    })

    scriptCode = scriptCompiled.content

    if (
      scriptCode.includes('defineAppJson')
      || scriptCode.includes('definePageJson')
      || scriptCode.includes('defineComponentJson')
    ) {
      scriptCode = stripJsonMacroCallsFromCode(scriptCode, filename)
    }

    if (!isAppFile && !scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }
  }
  else {
    scriptCode = 'export default {}'
  }

  if (scriptCode) {
    const transformed = transformScript(scriptCode, {
      skipComponentTransform: isAppFile,
      isApp: isAppFile,
      isPage: options?.isPage === true,
      warn: options?.warn,
      templateComponentMeta: Object.keys(autoComponentMeta).length ? autoComponentMeta : undefined,
      wevuDefaults: options?.wevuDefaults,
      classStyleRuntime: templateCompiled?.classStyleRuntime,
      classStyleBindings: templateCompiled?.classStyleBindings,
      templateRefs: templateCompiled?.templateRefs,
      inlineExpressions: templateCompiled?.inlineExpressions,
    })
    return { script: transformed.code, autoUsingComponentsMap, autoComponentMeta }
  }

  return { script: scriptCode, autoUsingComponentsMap, autoComponentMeta }
}
