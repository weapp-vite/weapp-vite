import type { Root } from 'postcss'
import valueParser from 'postcss-value-parser'

const RPX_DIMENSION = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)rpx$/i

/** 只转换 CSS 数值 token，保留字符串、URL 和注释中的同名字节。 */
export function resolveResponsiveUnits(stylesheet: Root, viewportWidth: number): void {
  const convert = (source: string) => {
    if (!/rpx/i.test(source)) {
      return source
    }
    const parsed = valueParser(source)
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        return false
      }
      if (node.type === 'word') {
        const match = RPX_DIMENSION.exec(node.value)
        if (match && Number.isFinite(Number(match[1]))) {
          node.value = `${Number(match[1]) * viewportWidth / 750}px`
        }
      }
    })
    return parsed.toString()
  }
  stylesheet.walkDecls((declaration) => {
    declaration.value = convert(declaration.value)
  })
  stylesheet.walkAtRules(/^(?:media|container|supports)$/i, (rule) => {
    rule.params = convert(rule.params)
  })
}
