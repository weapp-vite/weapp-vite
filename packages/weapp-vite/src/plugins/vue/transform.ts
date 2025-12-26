import type { Plugin } from 'vite'
import type { File as BabelFile, SFCBlock } from 'vue/compiler-sfc'
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
function generateScopedId(filename: string): string {
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
interface TransformResult {
  code: string
  transformed: boolean
}

function transformScript(source: string): TransformResult {
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
  })

  if (!replaced) {
    return {
      code: source,
      transformed: false,
    }
  }

  // 添加 import 语句
  const importStatement = 'import { createWevuComponent } from \'../runtime\'\n\n'
  if (!source.includes('createWevuComponent')) {
    s.prepend(importStatement)
  }

  if (!source.endsWith('\n')) {
    s.append('\n')
  }
  s.append(`\ncreateWevuComponent(${DEFAULT_OPTIONS_IDENTIFIER});\n`)

  return {
    code: s.toString(),
    transformed: true,
  }
}

type JsLikeLang = 'js' | 'ts'

function normalizeConfigLang(lang?: string) {
  if (!lang) {
    return 'json'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'json'
  }
  return lower
}

function isJsonLikeLang(lang: string) {
  return lang === 'json' || lang === 'jsonc' || lang === 'json5'
}

function resolveJsLikeLang(lang: string): JsLikeLang {
  if (lang === 'ts' || lang === 'tsx' || lang === 'cts' || lang === 'mts') {
    return 'ts'
  }
  return 'js'
}

async function evaluateJsLikeConfig(source: string, filename: string, lang: string) {
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

async function compileVueFile(source: string, filename: string): Promise<VueTransformResult> {
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

export function createVueTransformPlugin(_ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, VueTransformResult>()

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    async transform(code, id) {
      const sourceId = getSourceFromVirtualId(id)

      // 只处理 .vue 文件
      if (!sourceId.endsWith('.vue')) {
        return null
      }

      const filename = sourceId

      // 读取源文件
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
