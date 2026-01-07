import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { recursive as mergeRecursive } from 'merge'
import { compileScript, parse } from 'vue/compiler-sfc'
import logger from '../../../logger'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../utils/babel'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../utils/vueTemplateTags'
import { compileVueStyleToWxss } from '../compiler/style'
import { compileVueTemplateToWxml } from '../compiler/template'
import { compileConfigBlocks } from './config'
import { RUNTIME_IMPORT_PATH } from './constants'
import { extractJsonMacroFromScriptSetup, stripJsonMacroCallsFromCode } from './jsonMacros'
import { generateScopedId } from './scopedId'
import { transformScript } from './script'

export interface VueTransformResult {
  script?: string
  template?: string
  style?: string
  config?: string
  cssModules?: Record<string, Record<string, string>>
  meta?: {
    hasScriptSetup?: boolean
    hasSetupOption?: boolean
    jsonMacroHash?: string
  }
}

export interface AutoUsingComponentsOptions {
  enabled?: boolean
  resolveUsingComponentPath?: (
    importSource: string,
    importerFilename: string,
    info?: {
      localName: string
      importedName?: string
      kind: 'default' | 'named'
    },
  ) => Promise<string | undefined>
  warn?: (message: string) => void
}

export interface AutoImportTagsOptions {
  enabled?: boolean
  resolveUsingComponent?: (
    tag: string,
    importerFilename: string,
  ) => Promise<{ name: string, from: string } | undefined>
  warn?: (message: string) => void
}

function collectTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto usingComponents',
    warn: (message: string) => logger.warn(message),
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
}

function collectTemplateAutoImportTags(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto import tags',
    warn: (message: string) => logger.warn(message),
    shouldCollect: isAutoImportCandidateTag,
  })
}

export async function compileVueFile(
  source: string,
  filename: string,
  options?: { isPage?: boolean, autoUsingComponents?: AutoUsingComponentsOptions, autoImportTags?: AutoImportTagsOptions },
): Promise<VueTransformResult> {
  // 解析 SFC
  const { descriptor, errors } = parse(source, { filename })

  if (errors.length > 0) {
    const error = errors[0]
    throw new Error(`Failed to parse ${filename}: ${error.message}`)
  }

  // 注意：@vue/compiler-sfc 内部存在 parseCache，parse() 可能返回缓存的 descriptor 对象。
  // 因此这里不要直接修改 descriptor（例如覆盖 scriptSetup.content），否则会污染缓存并导致“回退到旧内容时宏消失”等问题。
  let descriptorForCompile = descriptor

  const result: VueTransformResult = {}
  result.meta = {
    hasScriptSetup: !!descriptor.scriptSetup,
    hasSetupOption: !!descriptor.script && /\bsetup\s*\(/.test(descriptor.script.content),
  }

  // <script setup> 编译宏：defineAppJson / definePageJson / defineComponentJson
  let scriptSetupMacroConfig: Record<string, any> | undefined
  let scriptSetupMacroHash: string | undefined
  if (descriptor.scriptSetup?.content) {
    const extracted = await extractJsonMacroFromScriptSetup(
      descriptor.scriptSetup.content,
      filename,
      descriptor.scriptSetup.lang,
    )
    if (extracted.stripped !== descriptor.scriptSetup.content) {
      const setupLoc = descriptor.scriptSetup.loc
      const startOffset = setupLoc.start.offset
      const endOffset = setupLoc.end.offset
      const strippedLines = extracted.stripped.split(/\r?\n/)
      const endLine = setupLoc.start.line + strippedLines.length - 1
      const endColumn = strippedLines.length === 1
        ? setupLoc.start.column + strippedLines[0].length
        : strippedLines[strippedLines.length - 1].length

      descriptorForCompile = {
        ...descriptor,
        source: source.slice(0, startOffset) + extracted.stripped + source.slice(endOffset),
        scriptSetup: {
          ...descriptor.scriptSetup,
          content: extracted.stripped,
          loc: {
            ...setupLoc,
            source: extracted.stripped,
            end: {
              ...setupLoc.end,
              offset: startOffset + extracted.stripped.length,
              line: endLine,
              column: endColumn,
            },
          },
        },
      } as any
    }
    scriptSetupMacroConfig = extracted.config
    scriptSetupMacroHash = extracted.macroHash
  }

  // <script setup> 组件导入自动注册：根据模板使用情况生成 usingComponents，并尝试剔除模板-only import
  const autoUsingComponents = (options?.autoUsingComponents?.enabled && descriptor.scriptSetup && descriptor.template && options.autoUsingComponents.resolveUsingComponentPath)
    ? options.autoUsingComponents
    : undefined
  const autoUsingComponentsMap: Record<string, string> = {}
  const autoComponentMeta: Record<string, string> = {}

  if (autoUsingComponents) {
    const templateComponentNames = collectTemplateComponentNames(descriptor.template!.content, filename)
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
        autoUsingComponents.warn?.(`[Vue transform] Failed to analyze <script setup> imports in ${filename}: ${message}`)
      }
    }
  }

  // 模板中的 kebab-case 标签自动注册：根据 autoImportComponents resolvers 解析 usingComponents
  const autoImportTags = (options?.autoImportTags?.enabled && descriptor.template && options.autoImportTags.resolveUsingComponent)
    ? options.autoImportTags
    : undefined
  const autoImportTagsMap: Record<string, string> = {}

  if (autoImportTags) {
    const tags = collectTemplateAutoImportTags(descriptor.template!.content, filename)
    for (const tag of tags) {
      let resolved: { name: string, from: string } | undefined
      try {
        resolved = await autoImportTags.resolveUsingComponent!(tag, filename)
      }
      catch {
        resolved = undefined
      }

      if (!resolved?.from) {
        continue
      }

      autoImportTagsMap[resolved.name || tag] = resolved.from
    }
  }

  // 检测是否是 app.vue（入口文件）
  const isAppFile = /[\\/]app\.vue$/.test(filename)

  // 处理 <script> 或 <script setup>
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = compileScript(descriptorForCompile, {
      id: filename,
      isProd: false, // 待办：从 config 获取
    })

    let scriptCode = scriptCompiled.content

    // 移除编译宏调用（避免运行时引用未定义的全局函数）
    if (
      scriptCode.includes('defineAppJson')
      || scriptCode.includes('definePageJson')
      || scriptCode.includes('defineComponentJson')
    ) {
      scriptCode = stripJsonMacroCallsFromCode(scriptCode, filename)
    }

    // 如果不是 app.vue 且没有导出 default，添加组件注册
    if (!isAppFile && !scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }

    // 使用 Babel AST 转换脚本（更健壮）
    // 对于 app.vue，跳过组件转换（保留 createApp 调用）
    const transformed = transformScript(scriptCode, {
      skipComponentTransform: isAppFile,
      isApp: isAppFile,
      isPage: options?.isPage === true,
      templateComponentMeta: Object.keys(autoComponentMeta).length ? autoComponentMeta : undefined,
    })
    result.script = transformed.code
  }

  // 处理 <template>
  if (descriptor.template) {
    const templateCompiled = compileVueTemplateToWxml(
      descriptor.template.content,
      filename,
    )
    result.template = templateCompiled.code
  }

  // 处理 <style>
  if (descriptor.styles.length > 0) {
    // 生成唯一的 scoped id（基于文件名）
    const scopedId = generateScopedId(filename)

    const compiledStyles = descriptor.styles.map((styleBlock) => {
      return compileVueStyleToWxss(styleBlock, {
        id: scopedId,
        scoped: styleBlock.scoped,
        modules: styleBlock.module,
      })
    })

    // 合并所有样式代码
    result.style = compiledStyles
      .map(s => s.code.trim())
      .filter(Boolean)
      .join('\n\n')

    // 如果有 CSS Modules，需要在脚本中注入
    const hasModules = compiledStyles.some(s => s.modules)
    if (hasModules) {
      const modulesMap: Record<string, Record<string, string>> = {}

      compiledStyles.forEach((compiled) => {
        if (compiled.modules) {
          // 合并 compiled.modules 的所有条目
          Object.assign(modulesMap, compiled.modules)
        }
      })

      // 保存 modules 映射
      result.cssModules = modulesMap

      // 在脚本中添加 modules 导出
      if (result.script !== undefined) {
        result.script = `
// 模块化样式（CSS Modules）
const __cssModules = ${JSON.stringify(modulesMap, null, 2)}
${result.script}
`
      }
    }
  }

  // 处理 <json> - 支持 JSON, JSONC, JSON5, JS, TS
  if (descriptor.customBlocks.some(b => b.type === 'json')) {
    const configResult = await compileConfigBlocks(descriptor.customBlocks, filename)
    if (configResult) {
      result.config = configResult
    }
  }

  const shouldMergeUsingComponents = Object.keys(autoUsingComponentsMap).length > 0 || Object.keys(autoImportTagsMap).length > 0

  // 合并自动 usingComponents（自动优先，冲突告警）
  if (shouldMergeUsingComponents) {
    let configObj: Record<string, any> = {}
    if (result.config) {
      try {
        configObj = JSON.parse(result.config)
      }
      catch {
        configObj = {}
      }
    }

    const existingRaw = configObj.usingComponents
    const usingComponents: Record<string, string> = (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw))
      ? existingRaw
      : {}

    for (const [name, from] of Object.entries(autoImportTagsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        autoImportTags?.warn?.(
          `[Vue transform] usingComponents 冲突: ${filename} 中 <json>.usingComponents['${name}']='${usingComponents[name]}' 将被模板标签自动引入覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    for (const [name, from] of Object.entries(autoUsingComponentsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        autoUsingComponents?.warn?.(
          `[Vue transform] usingComponents 冲突: ${filename} 中 <json>.usingComponents['${name}']='${usingComponents[name]}' 将被 <script setup> import 覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    configObj.usingComponents = usingComponents
    result.config = JSON.stringify(configObj, null, 2)
  }

  // 合并 <script setup> json 编译宏配置（最高优先级，覆盖 <json> / 自动 usingComponents）
  if (scriptSetupMacroConfig && Object.keys(scriptSetupMacroConfig).length > 0) {
    let configObj: Record<string, any> = {}
    if (result.config) {
      try {
        configObj = JSON.parse(result.config)
      }
      catch {
        configObj = {}
      }
    }
    mergeRecursive(configObj, scriptSetupMacroConfig)
    result.config = JSON.stringify(configObj, null, 2)
  }

  // 如果脚本块缺失或为空，仍然输出一个最小组件脚本，确保页面有可执行入口
  const hasScriptBlock = !!(descriptor.script || descriptor.scriptSetup)
  if (!hasScriptBlock) {
    result.script = `import { createWevuComponent } from '${RUNTIME_IMPORT_PATH}';\ncreateWevuComponent({});\n`
  }
  else if (result.script !== undefined && result.script.trim() === '') {
    result.script = `import { createWevuComponent } from '${RUNTIME_IMPORT_PATH}';\ncreateWevuComponent({});\n`
  }

  if (result.meta && scriptSetupMacroHash) {
    result.meta.jsonMacroHash = scriptSetupMacroHash
  }

  return result
}
