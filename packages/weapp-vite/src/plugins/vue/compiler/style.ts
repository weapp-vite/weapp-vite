import type { SFCStyleBlock } from 'vue/compiler-sfc'

export interface StyleCompileResult {
  code: string
  map?: string
  scopedId?: string
  modules?: Record<string, Record<string, string>>
}

export interface StyleCompileOptions {
  id: string
  scoped?: boolean
  modules?: boolean | string
  preprocessOptions?: Record<string, any>
}

/**
 * 将 Vue SFC 的 style 块转换为 WXSS
 */
export function compileVueStyleToWxss(
  styleBlock: SFCStyleBlock,
  options: StyleCompileOptions,
): StyleCompileResult {
  const { id, scoped, modules } = options
  const source = styleBlock.content

  let code = source

  // 1. 处理 scoped 样式
  if (scoped || styleBlock.scoped) {
    code = transformScopedCss(code, id)
  }

  // 2. 处理 CSS Modules
  if (modules || styleBlock.module) {
    const moduleName = typeof styleBlock.module === 'string' ? styleBlock.module : '$style'
    const moduleResult = transformCssModules(code, id)
    return {
      code: moduleResult.code,
      modules: {
        [moduleName]: moduleResult.classes,
      },
    }
  }

  return { code }
}

/**
 * 转换 scoped CSS
 * 为每个选择器添加特定的 scoped 属性
 */
function transformScopedCss(source: string, id: string): string {
  const scopedId = `data-v-${id}`

  // 更智能的 CSS 处理：找到选择器并在其后添加 [data-v-xxx]
  // 使用正则匹配 CSS 规则
  const cssRuleRegex = /([^{]+)(\{[^}]*\})/g

  return source.replace(cssRuleRegex, (match, selector, rules) => {
    const trimmedSelector = selector.trim()

    // 跳过空选择器
    if (!trimmedSelector) {
      return match
    }

    // 跳过已经是 scoped 的选择器
    if (trimmedSelector.includes('[') || trimmedSelector.includes(':deep(') || trimmedSelector.includes(':slotted(')) {
      return match
    }

    // 跳过 @ 规则
    if (trimmedSelector.startsWith('@')) {
      return match
    }

    // 为选择器添加 scoped 属性
    // 处理多个选择器（用逗号分隔）
    const selectors = trimmedSelector.split(',').map((s: string) => {
      const sTrimmed = s.trim()
      // 为简单选择器添加 scoped
      return `${sTrimmed}[${scopedId}]`
    })

    return `${selectors.join(', ')} ${rules}`
  })
}

/**
 * 转换 CSS Modules
 */
function transformCssModules(source: string, id: string): {
  code: string
  classes: Record<string, string>
} {
  const classes: Record<string, string> = {}
  const hash = generateHash(id)

  // 匹配所有 .className { 形式的类
  const classRegex = /\.([a-z_][\w-]*)\s*\{/gi
  const foundClasses: string[] = []

  let result: RegExpExecArray | null = classRegex.exec(source)
  while (result !== null) {
    foundClasses.push(result[1])
    result = classRegex.exec(source)
  }

  // 为每个类生成 scoped 名称
  for (const className of foundClasses) {
    const scopedClassName = `${className}_${hash}`
    classes[className] = scopedClassName
  }

  // 替换源码中的类名
  let code = source
  for (const [original, scoped] of Object.entries(classes)) {
    // 使用正则替换所有出现的类名
    const regex = new RegExp(`\\.${original}\\b`, 'g')
    code = code.replace(regex, `.${scoped}`)
  }

  return {
    code,
    classes,
  }
}

/**
 * 样式转换：CSS → WXSS
 * 处理小程序不支持的 CSS 特性
 */
/**
 * 生成简单的 hash
 */
function generateHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转为 32 位整数
  }
  // 使用更好的散列方法
  const h = Math.abs(hash).toString(36)
  // 如果 hash 太短，添加一些变化
  return h + str.length.toString(36)
}
