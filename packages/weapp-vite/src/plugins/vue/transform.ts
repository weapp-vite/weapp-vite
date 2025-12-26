import type { File as BabelFile } from '@babel/types'
import type { Plugin } from 'vite'
import type { SFCBlock } from 'vue/compiler-sfc'
import type { CompilerContext } from '../../context'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { parse as parseJson } from 'comment-json'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import { recursive as mergeRecursive } from 'merge'
import path from 'pathe'
import { bundleRequire } from 'rolldown-require'
import { compileScript, parse } from 'vue/compiler-sfc'
import { compileVueStyleToWxss } from './compiler/style'
import { compileVueTemplateToWxml } from './compiler/template'
import { VUE_PLUGIN_NAME } from './index'
import { getSourceFromVirtualId } from './resolver'

const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export interface VueTransformResult {
  script?: string
  template?: string
  style?: string
  config?: string
  cssModules?: Record<string, Record<string, string>>
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

export function transformScript(source: string): TransformResult {
  const ast: BabelFile = babelParse(source, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'jsx',
    ],
  })

  const s = new MagicString(source)
  let replaced = false
  const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'

  traverse(ast, {
    ExportDefaultDeclaration(path) {
      if (replaced) {
        return
      }
      const node = path.node
      if (!node.declaration) {
        return
      }
      const declarationCode = source.slice(node.declaration.start ?? node.start ?? 0, node.declaration.end ?? node.end ?? 0)
      s.overwrite(node.start ?? 0, node.end ?? 0, `const ${DEFAULT_OPTIONS_IDENTIFIER} = ${declarationCode};`)
      replaced = true
      path.stop()
    },

    // 移除 TypeScript 类型注解
    Identifier(path) {
      // 移除函数参数中的类型注解
      if (path.isIdentifier() && path.parentPath.isFunction()) {
        // TypeScript 类型注解会在 TSTypeAnnotation 节点中
        // 我们需要移除这些注解
        const parent = path.parent
        if (parent.type === 'Identifier' && parent.typeAnnotation) {
          parent.typeAnnotation = null
        }
      }
    },
  })

  if (!replaced) {
    return {
      code: source,
      transformed: false,
    }
  }

  // 移除所有 TypeScript 类型注解（使用正则作为后备方案）
  let code = s.toString()
  // 移除参数类型注解: event: any -> event
  code = code.replace(/(\w+)\s*:\s*\w+(\[\])?(\s*[,)])/g, '$1$3')
  // 移除返回类型注解: function foo(): void -> function foo()
  code = code.replace(/:\s*\w+(\[\])?(\s*\{)/g, '$2')
  // 移除接口类型: { name: string } -> { name }
  code = code.replace(/:\s*(string|number|boolean|any|void|object|unknown|never)(\s*[,}])/g, '$2')
  // 移除泛型语法: Array<string> -> Array
  code = code.replace(/(\w+)<[^>]+>/g, '$1')

  // 添加 import 语句 - 支持新的 Vue 3 API
  const importStatement = 'import { createWevuComponent } from \'weapp-vite/runtime\'\n'
  code = importStatement + code

  if (!code.endsWith('\n')) {
    code += '\n'
  }
  code += `\ncreateWevuComponent(${DEFAULT_OPTIONS_IDENTIFIER});\n`

  return {
    code,
    transformed: true,
  }
}

export type JsLikeLang = 'js' | 'ts'

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
      // ignore cleanup errors
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

  return JSON.stringify(accumulator, null, 2)
}

export { compileConfigBlocks }

export async function compileVueFile(source: string, filename: string): Promise<VueTransformResult> {
  // 解析 SFC
  const { descriptor, errors } = parse(source, { filename })

  if (errors.length > 0) {
    const error = errors[0]
    throw new Error(`Failed to parse ${filename}: ${error.message}`)
  }

  const result: VueTransformResult = {}

  // 处理 <script> 或 <script setup>
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = compileScript(descriptor, {
      id: filename,
      isProd: false, // TODO: 从 config 获取
    })

    let scriptCode = scriptCompiled.content

    // 如果没有导出 default，添加组件注册
    if (!scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }

    // 使用 Babel AST 转换脚本（更健壮）
    const transformed = transformScript(scriptCode)
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
          // Merge all module entries from compiled.modules
          Object.assign(modulesMap, compiled.modules)
        }
      })

      // 保存 modules 映射
      result.cssModules = modulesMap

      // 在脚本中添加 modules 导出
      if (result.script) {
        result.script = `
// CSS Modules
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

  return result
}

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, VueTransformResult>()

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

      // id 可能是虚拟模块 ID（\0vue:...）或实际文件路径
      // 使用 getSourceFromVirtualId 统一处理
      const sourceId = getSourceFromVirtualId(id)

      // 将相对路径转换为绝对路径
      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      // 读取源文件（如果 code 没有被提供）
      const source = code || await fs.readFile(filename, 'utf-8')

      // 编译 Vue 文件
      const result = await compileVueFile(source, filename)
      compilationCache.set(filename, result)

      // 返回编译后的脚本
      return {
        code: result.script || '',
        map: null,
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
        if (result.config) {
          const jsonFileName = `${relativeBase}.json`
          // 注意：这里需要与已有的 page.json 合并（如果存在）
          const existing = bundle[jsonFileName]
          if (existing && existing.type === 'asset') {
            // 合并已有配置
            try {
              const existingConfig = JSON.parse(existing.source.toString())
              const newConfig = JSON.parse(result.config)
              const merged = { ...existingConfig, ...newConfig }
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: JSON.stringify(merged, null, 2),
              })
            }
            catch {
              // 如果解析失败，直接覆盖
              this.emitFile({
                type: 'asset',
                fileName: jsonFileName,
                source: result.config,
              })
            }
          }
          else if (!bundle[jsonFileName]) {
            this.emitFile({
              type: 'asset',
              fileName: jsonFileName,
              source: result.config,
            })
          }
        }
      }

      // 处理所有页面/组件的 .vue 文件，即使它们没有被转换
      // 扫描所有已知的页面和组件入口
      let pageList: string[] = []

      // 从 scanService.appEntry 读取页面列表
      if (scanService && scanService.appEntry) {
        pageList = scanService.appEntry.json?.pages || []
      }
      else {
        // 后备方案：尝试从 dist/app.json 读取
        const appJsonPath = path.join(configService.cwd, 'dist', 'app.json')
        try {
          const appJsonContent = await fs.readFile(appJsonPath, 'utf-8')
          const appJson = JSON.parse(appJsonContent)
          pageList = appJson.pages || []
        }
        catch {
          // Ignore errors
        }
      }
      for (const pagePath of pageList) {
        // pagePath 格式: "pages/index/index"
        const entryId = path.join(configService.absoluteSrcRoot, pagePath)
        const relativeBase = pagePath
        const jsFileName = `${relativeBase}.js`

        // 检查是否已经在缓存中
        if (compilationCache.has(entryId)) {
          continue
        }

        // 检查是否存在对应的 .vue 文件
        const vuePath = `${entryId}.vue`
        if (!await fs.pathExists(vuePath)) {
          continue
        }

        // 读取并编译 .vue 文件
        try {
          const source = await fs.readFile(vuePath, 'utf-8')
          const result = await compileVueFile(source, vuePath)

          // 发出 .js 文件（脚本内容）
          if (result.script) {
            // 删除已存在的空 chunk
            if (bundle[jsFileName]) {
              delete bundle[jsFileName]
            }
            // 发出新的 asset
            this.emitFile({
              type: 'asset',
              fileName: jsFileName,
              source: result.script,
            })
          }

          // 发出 .wxml 文件
          if (result.template && !bundle[`${relativeBase}.wxml`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxml`,
              source: result.template,
            })
          }

          // 发出 .wxss 文件
          if (result.style && !bundle[`${relativeBase}.wxss`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.wxss`,
              source: result.style,
            })
          }

          // 发出 .json 文件（页面配置）
          if (result.config && !bundle[`${relativeBase}.json`]) {
            this.emitFile({
              type: 'asset',
              fileName: `${relativeBase}.json`,
              source: result.config,
            })
          }
        }
        catch {
          // 忽略编译错误，避免中断构建
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
