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
      tag.replaceWith(selectorParser.pseudo({ value: ':host' }))
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
  const targetNode = parent.nodes[targetEnd]
  if (!targetClass || !targetNode) {
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
        if (Number.isNaN(numeric)) {
          return `${value}px`
        }
        if (useVariable) {
          return `calc(var(${rpxVar}) * ${numeric})`
        }
        const converted = Math.round(numeric * ratio * 1000) / 1000
        return `${converted}px`
      })
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
