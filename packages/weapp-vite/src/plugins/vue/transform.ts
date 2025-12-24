import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import fs from 'fs-extra'
import { compileScript, parse } from 'vue/compiler-sfc'
import { compileVueStyleToWxss } from './compiler/style'
import { compileVueTemplateToWxml } from './compiler/template'
import { VUE_PLUGIN_NAME } from './index'
import { getSourceFromVirtualId } from './resolver'

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

    // 添加 createWevuComponent 调用
    let scriptCode = scriptCompiled.content

    // 如果没有导出 default，添加组件注册
    if (!scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }

    // 转换为 wevu 组件格式
    scriptCode = scriptCode.replace(
      /export default\s+(\{[\s\S]*?\})\s*(?:;\s*)?$/,
      (_match, options) => {
        return `import { createWevuComponent } from '@weapp-vite/plugin-wevu/runtime'\n`
          + `const __wevuOptions = ${options}\n`
          + `createWevuComponent(__wevuOptions)\n`
      },
    )

    result.script = scriptCode
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

  // 处理 <config>
  const configBlocks = descriptor.customBlocks.filter(b => b.type === 'config')
  if (configBlocks.length > 0) {
    // 合并所有 config 块
    const configContent = configBlocks.map(b => b.content).join('\n')
    try {
      // 尝试解析 JSON
      JSON.parse(configContent)
      result.config = configContent
    }
    catch {
      // 如果不是纯 JSON，可能需要评估 JS
      // TODO: 支持 JS/TS config
      result.config = '{}'
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
