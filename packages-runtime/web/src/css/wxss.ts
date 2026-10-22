import { tokenize, TokenType } from '@csstools/css-tokenizer'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { resolveNativeComponentWebTag } from '../shared/nativeComponents'

export interface WxssTransformOptions {
  /**
   * 1rpx 对应的 CSS 像素数。
   * 默认值近似于 750rpx 设计稿在 375px 屏幕上的换算。
   */
  pxPerRpx?: number
  /**
   * rpx 换算的设计宽度。传入后会把 rpx 转为
   * `calc(var(--rpx) * N)` 以实现响应式缩放。
   */
  designWidth?: number
  /**
   * 用于存储运行时 rpx 大小的 CSS 变量名。
   * @default "--rpx"
   */
  rpxVar?: string
}

export interface WxssTransformResult {
  css: string
}

const RPX_RE = /(-?(?:\d+(?:\.\d+)?|\.\d+))rpx/gi
const SAFE_AREA_ENV_RE = /env\(\s*safe-area-inset-(top|right|bottom|left)(?:\s*,[^)]*)?\)/gi
const PAGE_HOST_SELECTOR = selectorParser().astSync(':host(:where([data-weapp-page-active]))').nodes[0]!.nodes[0]!

/**
 * 小程序里 `1vw` 是屏幕宽度的 1%，浏览器里是窗口宽度的 1%。
 * 宽屏下运行时会把页面放进居中的设备视口（默认 375px），直接用 `vw` 会让全屏弹层、
 * 遮罩按浏览器窗口宽度渲染。这里改为读取运行时提供的设备视口变量，
 * 与 safe-area 的处理方式一致。
 */
function resolveViewportUnitBase(unit: string) {
  if (unit === 'vw') {
    return 'var(--weapp-viewport-width)'
  }
  if (unit === 'vh') {
    return 'var(--weapp-viewport-height)'
  }
  if (unit === 'vmin') {
    return 'min(var(--weapp-viewport-width), var(--weapp-viewport-height))'
  }
  return 'max(var(--weapp-viewport-width), var(--weapp-viewport-height))'
}

function transformViewportUnits(value: string) {
  let urlDepth = 0
  return tokenize({ css: value }).map((token) => {
    if (urlDepth > 0) {
      if (token[0] === TokenType.Function || token[0] === TokenType.OpenParen) {
        urlDepth += 1
      }
      else if (token[0] === TokenType.CloseParen) {
        urlDepth -= 1
      }
      return token[1]
    }
    if (token[0] === TokenType.Function && token[4].value.toLowerCase() === 'url') {
      urlDepth = 1
      return token[1]
    }
    if (token[0] !== TokenType.Dimension || !/^(?:vw|vh|vmin|vmax)$/i.test(token[4].unit) || !Number.isFinite(token[4].value)) {
      return token[1]
    }
    const numeric = token[4].value
    const base = resolveViewportUnitBase(token[4].unit.toLowerCase())
    return numeric === 0 ? '0px' : numeric === 100 ? base : `calc(${base} * ${numeric} / 100)`
  }).join('')
}

function isDeepPseudo(pseudo: selectorParser.Pseudo) {
  return pseudo.value === ':deep' || pseudo.value === '::v-deep'
}

function flattenDeepPseudos(selector: selectorParser.Selector) {
  selector.walkPseudos((pseudo) => {
    if (!isDeepPseudo(pseudo)) {
      return
    }
    const nestedSelector = pseudo.nodes?.[0]
    if (nestedSelector && nestedSelector.nodes.length > 0) {
      pseudo.replaceWith(...nestedSelector.nodes.map(node => node.clone()))
      return
    }
    pseudo.remove()
  })
}

function transformNativeTags(selector: selectorParser.Selector) {
  selector.walkTags((tag) => {
    if (tag.parent?.type === 'selector' && tag.parent.parent?.type === 'pseudo' && tag.parent.parent.value === '::part') {
      return
    }
    if (tag.value === 'page') {
      tag.replaceWith(PAGE_HOST_SELECTOR.clone())
      return
    }
    const webTag = resolveNativeComponentWebTag(tag.value)
    if (webTag) {
      tag.value = webTag
    }
  })
}

function createPartPseudo(className: string) {
  return selectorParser.pseudo({
    value: '::part',
    nodes: [selectorParser.selector({
      value: '',
      nodes: [selectorParser.tag({ value: className })],
    })],
  })
}

function createVirtualHostPartSelector(source: selectorParser.Selector) {
  const selector = source.clone()
  let deepPseudo: selectorParser.Pseudo | undefined
  selector.walkPseudos((pseudo) => {
    if (!deepPseudo && isDeepPseudo(pseudo)) {
      deepPseudo = pseudo
    }
  })
  if (!deepPseudo || deepPseudo.parent?.type !== 'selector') {
    return undefined
  }

  const parent = deepPseudo.parent
  const pseudoIndex = parent.nodes.indexOf(deepPseudo)
  const nestedNodes = deepPseudo.nodes?.[0]?.nodes ?? []
  const nestedTargetClass = nestedNodes.find(node => node.type === 'class')?.value
  let targetStart = pseudoIndex
  if (nestedNodes.length > 0) {
    deepPseudo.replaceWith(...nestedNodes.map(node => node.clone()))
  }
  else {
    deepPseudo.remove()
    while (parent.nodes[targetStart]?.type === 'combinator') {
      targetStart += 1
    }
  }

  let targetEnd = targetStart
  while (targetEnd + 1 < parent.nodes.length && parent.nodes[targetEnd + 1]?.type !== 'combinator') {
    targetEnd += 1
  }
  if (targetStart >= parent.nodes.length || targetEnd < parent.nodes.length - 1) {
    return undefined
  }

  const targetNodes = parent.nodes.slice(targetStart, targetEnd + 1)
  const targetClass = nestedTargetClass
    ?? targetNodes.find(node => node.type === 'class')?.value
  const targetNode = parent.nodes[targetEnd]!
  if (!targetClass) {
    return undefined
  }

  const firstTargetPseudo = targetNodes.find(node => node.type === 'pseudo')
  if (firstTargetPseudo?.value.startsWith(':') && !firstTargetPseudo.value.startsWith('::')) {
    return undefined
  }
  if (firstTargetPseudo) {
    parent.insertBefore(firstTargetPseudo, createPartPseudo(targetClass))
  }
  else {
    parent.insertAfter(targetNode, createPartPseudo(targetClass))
  }
  flattenDeepPseudos(selector)
  transformNativeTags(selector)
  return selector
}

function transformWxssSelector(selector: string) {
  const root = selectorParser().astSync(selector)
  const output: string[] = []
  for (const sourceSelector of root.nodes) {
    const partSelector = createVirtualHostPartSelector(sourceSelector)
    const flatSelector = sourceSelector.clone()
    flattenDeepPseudos(flatSelector)
    transformNativeTags(flatSelector)
    output.push(flatSelector.toString())
    if (partSelector) {
      output.push(partSelector.toString())
    }
  }
  return output.join(',\n')
}

function transformWxssRoot(root: postcss.Root, options?: WxssTransformOptions) {
  const rpxVar = options?.rpxVar ?? '--rpx'
  const useVariable = options?.pxPerRpx === undefined
    || (typeof options.designWidth === 'number' && Number.isFinite(options.designWidth))
  const ratio = options?.pxPerRpx ?? 0.5
  root.walkRules((rule) => {
    if (rule.selector) {
      rule.selector = transformWxssSelector(rule.selector)
    }
  })
  root.walkDecls((declaration) => {
    declaration.value = declaration.value
      .replace(
        SAFE_AREA_ENV_RE,
        (_, side: string) => `var(--weapp-safe-area-inset-${side})`,
      )
      .replace(RPX_RE, (_, value: string) => {
        const numeric = Number.parseFloat(value)
        if (useVariable) {
          return `calc(var(${rpxVar}) * ${numeric})`
        }
        const converted = Math.round(numeric * ratio * 1000) / 1000
        return `${converted}px`
      })
    if (useVariable) {
      declaration.value = transformViewportUnits(declaration.value)
    }
  })
}

export function createWxssPostcssPlugin(options?: WxssTransformOptions) {
  return {
    postcssPlugin: 'weapp-vite-web-wxss',
    Once(root: postcss.Root) {
      transformWxssRoot(root, options)
    },
  }
}

export function transformWxssToCss(source: string, options?: WxssTransformOptions): WxssTransformResult {
  const root = postcss.parse(source)
  transformWxssRoot(root, options)
  return {
    css: root.toString(),
  }
}
