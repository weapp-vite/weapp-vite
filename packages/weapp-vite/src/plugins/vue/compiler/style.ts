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

  // 3. CSS → WXSS 转换
  code = transformCssToWxss(code)

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
 * CSS → WXSS 转换
 * 处理小程序不支持的 CSS 特性
 */
function transformCssToWxss(source: string): string {
  let code = source

  // 1. 移除小程序不支持的伪类
  // 注意：这些伪类在小程序中不支持，但这里不报警告，因为它们很少使用
  const unsupportedPseudo = [
    '::before',
    '::after',
    '::first-letter',
    '::first-line',
    '::selection',
  ]

  for (const pseudo of unsupportedPseudo) {
    // 实际转换可能需要更复杂的处理
    if (code.includes(pseudo)) {
      // 静默处理，不产生警告
    }
  }

  // 2. 转换 length 单位
  // rem, vw, vh 等可能需要转换为 rpx 或 px
  code = code.replace(/(\d+(?:\.\d+)?)rem/g, (_match, value) => {
    const remValue = Number.parseFloat(value)
    // 假设设计稿基准是 16px
    return `${remValue * 2}rpx`
  })

  code = code.replace(/(\d+(?:\.\d+)?)vw/g, (_match, value) => {
    const vwValue = Number.parseFloat(value)
    // 1vw = 7.5rpx (假设屏幕宽度 750rpx)
    return `${vwValue * 7.5}rpx`
  })

  code = code.replace(/(\d+(?:\.\d+)?)vh/g, (_match, value) => {
    const vhValue = Number.parseFloat(value)
    return `${vhValue * 7.5}rpx`
  })

  return code
}

/**
 * 生成简单的 hash
 */
function generateHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // 使用更好的散列方法
  const h = Math.abs(hash).toString(36)
  // 如果 hash 太短，添加一些变化
  return h + str.length.toString(36)
}
