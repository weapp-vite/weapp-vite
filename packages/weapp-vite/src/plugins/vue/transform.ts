import type { NodePath } from '@babel/traverse'
import type { File as BabelFile } from '@babel/types'
import type { Plugin } from 'vite'
import type { SFCBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../context'
import type { WevuPageFeatureFlag } from '../wevu/pageFeatures'
import { fileURLToPath } from 'node:url'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import * as t from '@babel/types'
import { NodeTypes, baseParse as parseTemplate } from '@vue/compiler-core'
import { removeExtensionDeep } from '@weapp-core/shared'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { compileScript, parse } from 'vue/compiler-sfc'
import { isBuiltinComponent } from '../../auto-import-components/builtin'
import logger from '../../logger'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../utils/babel'
import { collectWevuPageFeatureFlags, createPageEntryMatcher, injectWevuPageFeatureFlagsIntoOptionsObject, injectWevuPageFeaturesInJsWithResolver } from '../wevu/pageFeatures'
import { compileVueStyleToWxss } from './compiler/style'
import { compileVueTemplateToWxml } from './compiler/template'
import { VUE_PLUGIN_NAME } from './index'
import { getSourceFromVirtualId } from './resolver'

// 运行时导入路径
const RUNTIME_IMPORT_PATH = 'wevu'

// 兼容：在 ESM 构建下归一化 CJS default 导出形态（babel generator 可能暴露 { default, generate }）
const generate: typeof generateModule = (generateModule as any).default ?? generateModule
const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

function normalizeResolvedFilePath(id: string) {
  const clean = getSourceFromVirtualId(id).split('?', 1)[0]
  if (clean.startsWith('file://')) {
    try {
      return fileURLToPath(clean)
    }
    catch {
      return clean
    }
  }
  if (clean.startsWith('/@fs/')) {
    return clean.slice('/@fs'.length)
  }
  return clean
}

function isDefineComponentCall(node: t.CallExpression, aliases: Set<string>) {
  return t.isIdentifier(node.callee) && aliases.has(node.callee.name)
}

function unwrapDefineComponent(node: t.Expression, aliases: Set<string>): t.ObjectExpression | null {
  if (t.isCallExpression(node) && isDefineComponentCall(node, aliases)) {
    const arg = node.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
  }
  return null
}

function resolveComponentExpression(
  declaration: t.Declaration | t.Expression | null,
  defineComponentDecls: Map<string, t.ObjectExpression>,
  aliases: Set<string>,
): t.Expression | null {
  if (!declaration) {
    return null
  }
  if (t.isObjectExpression(declaration)) {
    return declaration
  }
  if (t.isCallExpression(declaration) && isDefineComponentCall(declaration, aliases)) {
    const arg = declaration.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
    if (t.isIdentifier(arg)) {
      const matched = defineComponentDecls.get(arg.name)
      return matched ? t.cloneNode(matched, true) : null
    }
    return null
  }
  if (t.isIdentifier(declaration)) {
    const matched = defineComponentDecls.get(declaration.name)
    return matched ? t.cloneNode(matched, true) : null
  }
  return null
}

function ensureRuntimeImport(program: t.Program, importedName: string) {
  let targetImport = program.body.find(
    node => t.isImportDeclaration(node) && node.source.value === RUNTIME_IMPORT_PATH,
  ) as t.ImportDeclaration | undefined

  if (!targetImport) {
    targetImport = t.importDeclaration(
      [t.importSpecifier(t.identifier(importedName), t.identifier(importedName))],
      t.stringLiteral(RUNTIME_IMPORT_PATH),
    )
    program.body.unshift(targetImport)
    return
  }

  const hasSpecifier = targetImport.specifiers.some(
    spec => t.isImportSpecifier(spec) && spec.imported.type === 'Identifier' && spec.imported.name === importedName,
  )
  if (!hasSpecifier) {
    targetImport.specifiers.push(
      t.importSpecifier(t.identifier(importedName), t.identifier(importedName)),
    )
  }
}

async function collectVuePages(root: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(root)
    for (const entry of entries) {
      const full = path.join(root, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        const nested = await collectVuePages(full)
        results.push(...nested)
      }
      else if (full.endsWith('.vue')) {
        results.push(full)
      }
    }
  }
  catch {
    // 忽略不存在的目录
  }
  return results
}

/**
 * 说明：Vue SFC 编译后处理插件
 * 修复 Vue SFC 编译器生成的代码中的问题：
 * 1. 移除从 'vue' 导入 defineComponent
 * 2. 修复 expose 参数语法错误
 * 3. 移除 __name 属性
 * 4. 移除 __expose() 调用
 */
function vueSfcTransformPlugin() {
  return {
    name: 'vue-sfc-transform',
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        // 移除 import { defineComponent } from 'vue'
        const source = path.node.source.value
        if (source === 'vue') {
          const specifiers = path.node.specifiers
          const filteredSpecifiers = specifiers.filter((s) => {
            if (s.type === 'ImportSpecifier' && t.isIdentifier(s.imported) && s.imported.name === 'defineComponent') {
              return false
            }
            return true
          })
          if (filteredSpecifiers.length === 0) {
            path.remove()
          }
          else if (filteredSpecifiers.length !== specifiers.length) {
            path.node.specifiers = filteredSpecifiers
          }
        }
      },

      ObjectExpression(path: NodePath<t.ObjectExpression>) {
        // 移除 __name 属性
        const properties = path.node.properties
        const filtered = properties.filter((p) => {
          if (p.type === 'ObjectProperty') {
            const key = p.key
            if (key.type === 'Identifier' && key.name === '__name') {
              return false
            }
          }
          return true
        })
        path.node.properties = filtered
      },

      CallExpression(path: NodePath<t.CallExpression>) {
        // 移除 __expose() 调用
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === '__expose') {
          path.remove()
        }
      },
    },
  }
}

export interface VueTransformResult {
  script?: string
  template?: string
  style?: string
  config?: string
  cssModules?: Record<string, Record<string, string>>
  meta?: {
    hasScriptSetup?: boolean
    hasSetupOption?: boolean
  }
}

/**
 * 生成 scoped ID
 */
export function generateScopedId(filename: string): string {
  // 基于 filename 生成短 hash
  const hash = filename.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)
  return Math.abs(hash).toString(36)
}

/**
 * 使用 Babel AST 转换脚本
 * 比正则替换更健壮，能处理复杂的代码结构
 */
export interface TransformResult {
  code: string
  transformed: boolean
}

export interface TransformScriptOptions {
  /**
   * 是否跳过组件转换（不添加 createWevuComponent 调用）
   * 用于 app.vue 等入口文件
   */
  skipComponentTransform?: boolean
  /**
   * 是否是 Page 入口（仅 Page 才需要注入 features 以启用按需派发的页面事件）
   */
  isPage?: boolean
  /**
   * <script setup> 中引入的组件：编译时移除 import，并提供同名元信息对象占位，避免运行时访问时报错。
   * key: 组件别名（需与模板标签一致），value: usingComponents 的 from（如 `/components/foo/index`）
   */
  templateComponentMeta?: Record<string, string>
}

export function transformScript(source: string, options?: TransformScriptOptions): TransformResult {
  const ast: BabelFile = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS)

  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, t.ObjectExpression>()
  let defaultExportPath: NodePath<t.ExportDefaultDeclaration> | null = null
  let transformed = false

  const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'
  const enabledPageFeatures: Set<WevuPageFeatureFlag> = options?.isPage
    ? collectWevuPageFeatureFlags(ast)
    : new Set<WevuPageFeatureFlag>()

  // 先运行 Vue SFC 转换插件
  traverse(ast, vueSfcTransformPlugin().visitor as any)

  traverse(ast, {
    ImportDeclaration(path) {
      // 移除 defineComponent 的导入，同时记录本地别名
      if (path.node.source.value === 'vue') {
        const remaining = path.node.specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier) && specifier.imported.type === 'Identifier' && specifier.imported.name === 'defineComponent') {
            defineComponentAliases.add(specifier.local.name)
            transformed = true
            return false
          }
          return true
        })
        if (remaining.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = remaining
      }

      // 剔除 type-only 导入
      if (path.node.importKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      const kept = path.node.specifiers.filter((specifier) => {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          transformed = true
          return false
        }
        return true
      })
      if (kept.length !== path.node.specifiers.length) {
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }
    },

    ExportNamedDeclaration(path) {
      if (path.node.exportKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      if (path.node.specifiers?.length) {
        const remaining = path.node.specifiers.filter((spec) => {
          if (t.isExportSpecifier(spec)) {
            return spec.exportKind !== 'type'
          }
          return true
        })
        if (remaining.length !== path.node.specifiers.length) {
          transformed = true
          if (remaining.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = remaining
        }
      }
    },

    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
      }
      const unwrapped = unwrapDefineComponent(path.node.init, defineComponentAliases)
      if (unwrapped) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(unwrapped, true))
        path.node.init = unwrapped
        transformed = true
      }
    },

    ExportDefaultDeclaration(path) {
      defaultExportPath = path
    },

    CallExpression(path) {
      // 移除 __expose() 调用
      if (t.isIdentifier(path.node.callee, { name: '__expose' }) && path.parentPath?.isExpressionStatement()) {
        path.parentPath.remove()
        transformed = true
        return
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    NewExpression(path) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: '__name' })
        || t.isStringLiteral(path.node.key, { value: '__name' })
      ) {
        path.remove()
        transformed = true
      }
    },

    TSTypeAliasDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSInterfaceDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSEnumDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSModuleDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSImportEqualsDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSAsExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAssertion(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSNonNullExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAnnotation(path) {
      path.remove()
      transformed = true
    },

    TSParameterProperty(path) {
      path.replaceWith(path.node.parameter as t.Identifier | t.Pattern)
      transformed = true
    },

    Function(path) {
      if (path.node.returnType) {
        path.node.returnType = null
        transformed = true
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    ClassProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
    },

    ClassPrivateProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
    },
  })

  // <script setup> 组件导入自动注册：移除 import，并注入元信息对象（满足用户在 script 中访问/打印的需求）
  if (options?.templateComponentMeta && Object.keys(options.templateComponentMeta).length) {
    const metaMap = options.templateComponentMeta
    const candidateNames = new Set(Object.keys(metaMap))
    const injectedNames = new Set<string>()

    traverse(ast, {
      ImportDeclaration(path) {
        if (!path.node.specifiers.length) {
          return
        }
        const kept = path.node.specifiers.filter((specifier) => {
          if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
            return true
          }
          const localName = specifier.local.name
          return !candidateNames.has(localName)
        })

        if (kept.length !== path.node.specifiers.length) {
          transformed = true
          if (kept.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = kept
        }
      },
    })

    const decls: t.Statement[] = []
    for (const name of Object.keys(metaMap)) {
      if (injectedNames.has(name)) {
        continue
      }
      injectedNames.add(name)
      decls.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(name),
            t.objectExpression([
              t.objectProperty(t.identifier('__weappViteUsingComponent'), t.booleanLiteral(true)),
              t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
              t.objectProperty(t.identifier('from'), t.stringLiteral(metaMap[name])),
            ]),
          ),
        ]),
      )
    }

    if (decls.length) {
      const body = ast.program.body
      let insertAt = 0
      while (insertAt < body.length && t.isImportDeclaration(body[insertAt])) {
        insertAt += 1
      }
      body.splice(insertAt, 0, ...decls)
      transformed = true
    }
  }

  // 处理 export default，注入 createWevuComponent 调用或直接解包 defineComponent
  if (defaultExportPath) {
    const exportPath = defaultExportPath as NodePath<t.ExportDefaultDeclaration>
    const componentExpr = resolveComponentExpression(
      exportPath.node.declaration,
      defineComponentDecls,
      defineComponentAliases,
    )

    if (componentExpr && t.isObjectExpression(componentExpr) && enabledPageFeatures.size) {
      transformed = injectWevuPageFeatureFlagsIntoOptionsObject(componentExpr, enabledPageFeatures) || transformed
    }

    if (componentExpr && options?.skipComponentTransform) {
      exportPath.replaceWith(t.exportDefaultDeclaration(componentExpr))
      transformed = true
    }
    else if (componentExpr) {
      ensureRuntimeImport(ast.program, 'createWevuComponent')
      exportPath.replaceWith(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(DEFAULT_OPTIONS_IDENTIFIER), componentExpr),
        ]),
      )
      exportPath.insertAfter(
        t.expressionStatement(
          t.callExpression(t.identifier('createWevuComponent'), [
            t.identifier(DEFAULT_OPTIONS_IDENTIFIER),
          ]),
        ),
      )
      transformed = true
    }
  }

  if (!transformed) {
    return {
      code: source,
      transformed: false,
    }
  }

  const generated = generate(ast, {
    retainLines: true,
  })

  return {
    code: generated.code,
    transformed,
  }
}

export type JsLikeLang = 'js' | 'ts'

function collectTemplateComponentNames(template: string, filename: string) {
  const names = new Set<string>()
  const reserved = new Set([
    'template',
    'slot',
    'component',
    'transition',
    'keep-alive',
    'teleport',
    'suspense',
  ])

  try {
    const ast = parseTemplate(template, { onError: () => {} })
    const visit = (node: any) => {
      if (!node) {
        return
      }
      if (Array.isArray(node)) {
        node.forEach(visit)
        return
      }
      if (node.type === NodeTypes.ELEMENT) {
        const tag = node.tag
        if (typeof tag === 'string' && /^[A-Z_$][\w$]*$/i.test(tag)) {
          if (!reserved.has(tag) && !isBuiltinComponent(tag)) {
            names.add(tag)
          }
        }
      }
      if (node.children) {
        visit(node.children)
      }
      if (node.branches) {
        visit(node.branches)
      }
      if (node.consequent) {
        visit(node.consequent)
      }
      if (node.alternate) {
        visit(node.alternate)
      }
    }
    visit(ast.children)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn(`[Vue transform] Failed to parse <template> for auto usingComponents in ${filename}: ${message}`)
  }

  return names
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

export function normalizeConfigLang(lang?: string) {
  if (!lang) {
    return 'json'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'json'
  }
  return lower
}

export function isJsonLikeLang(lang: string) {
  return lang === 'json' || lang === 'jsonc' || lang === 'json5'
}

export function resolveJsLikeLang(lang: string): JsLikeLang {
  if (lang === 'ts' || lang === 'tsx' || lang === 'cts' || lang === 'mts') {
    return 'ts'
  }
  return 'js'
}

export async function evaluateJsLikeConfig(source: string, filename: string, lang: string) {
  const dir = path.dirname(filename)
  const extension = resolveJsLikeLang(lang) === 'ts' ? 'ts' : 'js'
  const tempDir = path.join(dir, '.wevu-config')
  await fs.ensureDir(tempDir)
  const basename = path.basename(filename, path.extname(filename))
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const tempFile = path.join(tempDir, `${basename}.${unique}.${extension}`)
  await fs.writeFile(tempFile, source, 'utf8')

  try {
    const { mod } = await bundleRequire<{ default?: any }>({
      filepath: tempFile,
      cwd: dir,
    })

    let resolved: any = mod?.default ?? mod
    if (typeof resolved === 'function') {
      resolved = resolved()
    }
    if (resolved && typeof resolved.then === 'function') {
      resolved = await resolved
    }
    if (resolved && typeof resolved === 'object') {
      return resolved
    }
    throw new Error('Config block must export an object or a function returning an object')
  }
  finally {
    try {
      await fs.remove(tempFile)
    }
    catch {
      // 忽略清理失败
    }
    try {
      const remains = await fs.readdir(tempDir)
      if (remains.length === 0) {
        await fs.remove(tempDir)
      }
    }
    catch {
      // 忽略清理失败
    }
  }
}

async function compileConfigBlocks(blocks: SFCBlock[], filename: string): Promise<string | undefined> {
  const configBlocks = blocks.filter(block => block.type === 'config')
  if (!configBlocks.length) {
    return undefined
  }

  const accumulator: Record<string, any> = {}
  for (const block of configBlocks) {
    const lang = normalizeConfigLang(block.lang)
    try {
      if (isJsonLikeLang(lang)) {
        const parsed = parseJson(block.content, undefined, true)
        mergeRecursive(accumulator, parsed)
        continue
      }
      const evaluated = await evaluateJsLikeConfig(block.content, filename, lang)
      if (!evaluated || typeof evaluated !== 'object') {
        continue
      }
      mergeRecursive(accumulator, evaluated)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to parse <config> block (${lang}) in ${filename}: ${message}`)
    }
  }

  // 去除提示用的 $schema
  if (Reflect.has(accumulator, '$schema')) {
    delete accumulator.$schema
  }
  return JSON.stringify(accumulator, null, 2)
}

export { compileConfigBlocks }

export async function compileVueFile(
  source: string,
  filename: string,
  options?: { isPage?: boolean, autoUsingComponents?: AutoUsingComponentsOptions },
): Promise<VueTransformResult> {
  // 解析 SFC
  const { descriptor, errors } = parse(source, { filename })

  if (errors.length > 0) {
    const error = errors[0]
    throw new Error(`Failed to parse ${filename}: ${error.message}`)
  }

  const result: VueTransformResult = {}
  result.meta = {
    hasScriptSetup: !!descriptor.scriptSetup,
    hasSetupOption: !!descriptor.script && /\bsetup\s*\(/.test(descriptor.script.content),
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
        const setupAst: BabelFile = babelParse(descriptor.scriptSetup!.content, BABEL_TS_MODULE_PARSER_OPTIONS)
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

  // 检测是否是 app.vue（入口文件）
  const isAppFile = /[\\/]app\.vue$/.test(filename)

  // 处理 <script> 或 <script setup>
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = compileScript(descriptor, {
      id: filename,
      isProd: false, // 待办：从 config 获取
    })

    let scriptCode = scriptCompiled.content

    // 如果不是 app.vue 且没有导出 default，添加组件注册
    if (!isAppFile && !scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }

    // 使用 Babel AST 转换脚本（更健壮）
    // 对于 app.vue，跳过组件转换（保留 createApp 调用）
    const transformed = transformScript(scriptCode, {
      skipComponentTransform: isAppFile,
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

  // 处理 <config> - 支持 JSON, JS, TS
  if (descriptor.customBlocks.some(b => b.type === 'config')) {
    const configResult = await compileConfigBlocks(descriptor.customBlocks, filename)
    if (configResult) {
      result.config = configResult
    }
  }

  // 合并 auto usingComponents（自动优先，冲突告警）
  if (Object.keys(autoUsingComponentsMap).length > 0) {
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

    for (const [name, from] of Object.entries(autoUsingComponentsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        autoUsingComponents?.warn?.(
          `[Vue transform] usingComponents 冲突: ${filename} 中 <config>.usingComponents['${name}']='${usingComponents[name]}' 将被 <script setup> import 覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    configObj.usingComponents = usingComponents
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

  return result
}

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, VueTransformResult>()
  const pageMatcher = createPageEntryMatcher(ctx)
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    async transform(code, id) {
      // 只处理 .vue 文件
      if (!id.endsWith('.vue')) {
        return null
      }

      const configService = ctx.configService
      if (!configService) {
        return null
      }

      // 说明：id 可能是虚拟模块 ID（\0vue:...）或实际文件路径
      // 使用 getSourceFromVirtualId 统一处理
      const sourceId = getSourceFromVirtualId(id)

      // 将相对路径转换为绝对路径
      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      try {
        // 读取源文件（如果 code 没有被提供）
        const source = code || await fs.readFile(filename, 'utf-8')

        if (ctx.runtimeState.scan.isDirty) {
          pageMatcher.markDirty()
        }
        const isPage = await pageMatcher.isPageFile(filename)
        // 编译 Vue 文件
        const result = await compileVueFile(source, filename, {
          isPage,
          autoUsingComponents: {
            enabled: true,
            warn: message => logger.warn(message),
            resolveUsingComponentPath: async (importSource, importerFilename, info) => {
              const resolved = await this.resolve(importSource, importerFilename)
              if (!resolved?.id) {
                return undefined
              }
              let clean = normalizeResolvedFilePath(resolved.id)
              if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                return undefined
              }

              try {
                if (await fs.pathExists(clean)) {
                  const stat = await fs.stat(clean)
                  if (stat.isDirectory()) {
                    for (const ext of ['ts', 'js', 'mjs', 'cjs']) {
                      const indexPath = path.join(clean, `index.${ext}`)
                      if (await fs.pathExists(indexPath)) {
                        clean = indexPath
                        break
                      }
                    }
                  }
                }
              }
              catch {
                // ignore stat/exists failures
              }

              if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
                const cacheKey = clean
                const exportName = info.importedName
                let entry = reExportResolutionCache.get(cacheKey)
                if (!entry) {
                  entry = new Map()
                  reExportResolutionCache.set(cacheKey, entry)
                }

                if (!entry.has(exportName)) {
                  const visited = new Set<string>()
                  const resolveExported = async (exporterFile: string, depth: number): Promise<string | undefined> => {
                    if (depth <= 0) {
                      return undefined
                    }
                    if (visited.has(exporterFile)) {
                      return undefined
                    }
                    visited.add(exporterFile)
                    let code: string
                    try {
                      code = await fs.readFile(exporterFile, 'utf8')
                    }
                    catch {
                      return undefined
                    }

                    let ast: BabelFile
                    try {
                      ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
                    }
                    catch {
                      return undefined
                    }

                    const exportAllSources: string[] = []
                    for (const node of ast.program.body) {
                      if (t.isExportNamedDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
                        for (const spec of node.specifiers) {
                          if (!t.isExportSpecifier(spec)) {
                            continue
                          }
                          const exportedName = t.isIdentifier(spec.exported)
                            ? spec.exported.name
                            : t.isStringLiteral(spec.exported)
                              ? spec.exported.value
                              : undefined
                          if (exportedName !== exportName) {
                            continue
                          }
                          const hop = await this.resolve(node.source.value, exporterFile)
                          if (!hop?.id) {
                            return undefined
                          }
                          return normalizeResolvedFilePath(hop.id)
                        }
                      }
                      if (t.isExportAllDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
                        exportAllSources.push(node.source.value)
                      }
                    }

                    for (const source of exportAllSources) {
                      const hop = await this.resolve(source, exporterFile)
                      if (!hop?.id) {
                        continue
                      }
                      const hopPath = normalizeResolvedFilePath(hop.id)
                      if (!hopPath || hopPath.startsWith('\0') || hopPath.startsWith('node:')) {
                        continue
                      }
                      const nested = await resolveExported(hopPath, depth - 1)
                      if (nested) {
                        return nested
                      }
                    }

                    return undefined
                  }

                  entry.set(exportName, await resolveExported(clean, 4))
                }

                const mapped = entry.get(exportName)
                if (mapped) {
                  clean = mapped
                }
              }

              const baseName = removeExtensionDeep(clean)
              const relativeBase = configService.relativeOutputPath(baseName)
              if (!relativeBase) {
                return undefined
              }
              return `/${relativeBase}`
            },
          },
        })

        if (isPage && result.script) {
          const injected = await injectWevuPageFeaturesInJsWithResolver(result.script, {
            id: filename,
            resolver: {
              resolveId: async (source, importer) => {
                const resolved = await this.resolve(source, importer)
                return resolved ? resolved.id : undefined
              },
              loadCode: async (id) => {
                const clean = getSourceFromVirtualId(id).split('?', 1)[0]
                if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                  return undefined
                }
                try {
                  if (await fs.pathExists(clean)) {
                    return await fs.readFile(clean, 'utf8')
                  }
                  return undefined
                }
                catch {
                  return undefined
                }
              },
            },
          })
          if (injected.transformed) {
            result.script = injected.code
          }
        }
        compilationCache.set(filename, result)

        // 返回编译后的脚本
        return {
          code: result.script ?? '',
          map: null,
        }
      }
      catch (error) {
        // 记录编译错误
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`[Vue transform] Error transforming ${filename}: ${message}`)
        throw error
      }
    },

    // 在 generateBundle 中发出模板、样式和配置文件
    async generateBundle(_options, bundle) {
      const { configService, scanService } = ctx
      if (!configService || !scanService) {
        return
      }

      // 首先处理缓存中已有的编译结果
      for (const [filename, result] of compilationCache.entries()) {
        // 计算输出文件名（去掉 .vue 扩展名）
        const baseName = filename.slice(0, -4)
        const relativeBase = configService.relativeOutputPath(baseName)
        if (!relativeBase) {
          continue
        }

        const isAppVue = /[\\/]app\.vue$/.test(filename)
        const shouldEmitComponentJson = !isAppVue

        // 发出 .wxml 文件
        if (result.template) {
          const wxmlFileName = `${relativeBase}.wxml`
          // 避免重复发出
          if (!bundle[wxmlFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: wxmlFileName,
              source: result.template,
            })
          }
        }

        // 发出 .wxss 文件
        if (result.style) {
          const wxssFileName = `${relativeBase}.wxss`
          if (!bundle[wxssFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: wxssFileName,
              source: result.style,
            })
          }
        }

        // 发出 .json 文件（页面/组件配置）
        if (result.config || shouldEmitComponentJson) {
          const jsonFileName = `${relativeBase}.json`
          const existing = bundle[jsonFileName]

          const defaultConfig = shouldEmitComponentJson ? { component: true } : undefined
          let nextConfig: Record<string, any> | undefined

          if (result.config) {
            try {
              nextConfig = JSON.parse(result.config)
            }
            catch {
              nextConfig = undefined
            }
          }

          if (defaultConfig) {
            nextConfig = { ...defaultConfig, ...(nextConfig ?? {}) }
            nextConfig.component = true
          }

          // 若 result.config 解析失败但仍有 defaultConfig，则发出默认配置。
          if (!nextConfig && defaultConfig) {
            nextConfig = defaultConfig
          }

          // 若仍没有可用配置（无效 JSON + 无默认值），则跳过。
          if (!nextConfig) {
            continue
          }

          // 注意：这里需要与已有的 page.json 合并（如果存在）
          if (existing && existing.type === 'asset') {
            try {
              const existingConfig = JSON.parse(existing.source.toString())
              const merged = { ...existingConfig, ...nextConfig }
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: JSON.stringify(merged, null, 2),
              })
            }
            catch {
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: JSON.stringify(nextConfig, null, 2),
              })
            }
          }
          else if (!bundle[jsonFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: jsonFileName,
              source: JSON.stringify(nextConfig, null, 2),
            })
          }
        }
      }

      // 后备处理：对未被 Vite 引用的页面 .vue 进行编译并发出产物
      let pageList: string[] = []
      if (scanService?.appEntry?.json?.pages?.length) {
        pageList = scanService.appEntry.json.pages
      }
      else {
        const appJsonPath = path.join(configService.cwd, 'dist', 'app.json')
        try {
          const appJsonContent = await fs.readFile(appJsonPath, 'utf-8')
          const appJson = JSON.parse(appJsonContent)
          pageList = appJson.pages || []
        }
        catch {
          // 忽略
        }
      }

      const collectedEntries = new Set<string>()
      pageList.forEach(p => collectedEntries.add(path.join(configService.absoluteSrcRoot, p)))

      const extraVueFiles = await collectVuePages(path.join(configService.absoluteSrcRoot, 'pages'))
      extraVueFiles.forEach(f => collectedEntries.add(f.slice(0, -4)))

      for (const entryId of collectedEntries) {
        const relativeBase = configService.relativeOutputPath(entryId)
        if (!relativeBase) {
          continue
        }
        const jsFileName = `${relativeBase}.js`
        const vuePath = `${entryId}.vue`

        // 说明：compilationCache 使用完整的 .vue 路径作为 key，这里需要保持一致避免重复编译覆盖已生成的 chunk
        if (compilationCache.has(vuePath)) {
          continue
        }

        if (!(await fs.pathExists(vuePath))) {
          continue
        }

        try {
          const source = await fs.readFile(vuePath, 'utf-8')
          const result = await compileVueFile(source, vuePath, {
            isPage: true,
            autoUsingComponents: {
              enabled: true,
              warn: message => logger.warn(message),
              resolveUsingComponentPath: async (importSource, importerFilename, info) => {
                const resolved = await this.resolve(importSource, importerFilename)
                if (!resolved?.id) {
                  return undefined
                }
                let clean = normalizeResolvedFilePath(resolved.id)
                if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                  return undefined
                }

                try {
                  if (await fs.pathExists(clean)) {
                    const stat = await fs.stat(clean)
                    if (stat.isDirectory()) {
                      for (const ext of ['ts', 'js', 'mjs', 'cjs']) {
                        const indexPath = path.join(clean, `index.${ext}`)
                        if (await fs.pathExists(indexPath)) {
                          clean = indexPath
                          break
                        }
                      }
                    }
                  }
                }
                catch {
                  // ignore
                }

                if (info?.kind === 'named' && info.importedName && /\.(?:[cm]?ts|[cm]?js)$/.test(clean)) {
                  const cacheKey = clean
                  const exportName = info.importedName
                  let entry = reExportResolutionCache.get(cacheKey)
                  if (!entry) {
                    entry = new Map()
                    reExportResolutionCache.set(cacheKey, entry)
                  }

                  if (!entry.has(exportName)) {
                    const visited = new Set<string>()
                    const resolveExported = async (exporterFile: string, depth: number): Promise<string | undefined> => {
                      if (depth <= 0) {
                        return undefined
                      }
                      if (visited.has(exporterFile)) {
                        return undefined
                      }
                      visited.add(exporterFile)
                      let code: string
                      try {
                        code = await fs.readFile(exporterFile, 'utf8')
                      }
                      catch {
                        return undefined
                      }

                      let ast: BabelFile
                      try {
                        ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
                      }
                      catch {
                        return undefined
                      }

                      const exportAllSources: string[] = []
                      for (const node of ast.program.body) {
                        if (t.isExportNamedDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
                          for (const spec of node.specifiers) {
                            if (!t.isExportSpecifier(spec)) {
                              continue
                            }
                            const exportedName = t.isIdentifier(spec.exported)
                              ? spec.exported.name
                              : t.isStringLiteral(spec.exported)
                                ? spec.exported.value
                                : undefined
                            if (exportedName !== exportName) {
                              continue
                            }
                            const hop = await this.resolve(node.source.value, exporterFile)
                            if (!hop?.id) {
                              return undefined
                            }
                            return normalizeResolvedFilePath(hop.id)
                          }
                        }
                        if (t.isExportAllDeclaration(node) && node.source && t.isStringLiteral(node.source)) {
                          exportAllSources.push(node.source.value)
                        }
                      }

                      for (const source of exportAllSources) {
                        const hop = await this.resolve(source, exporterFile)
                        if (!hop?.id) {
                          continue
                        }
                        const hopPath = normalizeResolvedFilePath(hop.id)
                        if (!hopPath || hopPath.startsWith('\0') || hopPath.startsWith('node:')) {
                          continue
                        }
                        const nested = await resolveExported(hopPath, depth - 1)
                        if (nested) {
                          return nested
                        }
                      }

                      return undefined
                    }

                    entry.set(exportName, await resolveExported(clean, 4))
                  }

                  const mapped = entry.get(exportName)
                  if (mapped) {
                    clean = mapped
                  }
                }

                const baseName = removeExtensionDeep(clean)
                const relativeBase = configService.relativeOutputPath(baseName)
                if (!relativeBase) {
                  return undefined
                }
                return `/${relativeBase}`
              },
            },
          })

          if (result.script) {
            const injected = await injectWevuPageFeaturesInJsWithResolver(result.script, {
              id: vuePath,
              resolver: {
                resolveId: async (source, importer) => {
                  const resolved = await this.resolve(source, importer)
                  return resolved ? resolved.id : undefined
                },
                loadCode: async (id) => {
                  const clean = getSourceFromVirtualId(id).split('?', 1)[0]
                  if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
                    return undefined
                  }
                  try {
                    if (await fs.pathExists(clean)) {
                      return await fs.readFile(clean, 'utf8')
                    }
                    return undefined
                  }
                  catch {
                    return undefined
                  }
                },
              },
            })
            if (injected.transformed) {
              result.script = injected.code
            }
          }

          if (result.script !== undefined) {
            if (bundle[jsFileName]) {
              delete bundle[jsFileName]
            }
            this.emitFile({
              type: 'asset',
              fileName: jsFileName,
              source: result.script,
            })
          }

          if (result.template && !bundle[`${relativeBase}.wxml`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxml`,
              source: result.template,
            })
          }

          if (result.style && !bundle[`${relativeBase}.wxss`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxss`,
              source: result.style,
            })
          }

          if (!bundle[`${relativeBase}.json`]) {
            let nextConfig: Record<string, any> | undefined
            if (result.config) {
              try {
                nextConfig = JSON.parse(result.config)
              }
              catch {
                nextConfig = undefined
              }
            }
            nextConfig = { component: true, ...(nextConfig ?? {}) }
            nextConfig.component = true
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.json`,
              source: JSON.stringify(nextConfig, null, 2),
            })
          }
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`[Vue transform] Error compiling ${vuePath}: ${message}`)
        }
      }
    },

    // 处理模板和样式作为额外文件
    async handleHotUpdate({ file }) {
      if (!file.endsWith('.vue')) {
        return
      }

      // 清除缓存
      compilationCache.delete(file)

      return []
    },
  }
}
