import type { ChildNode, Root } from 'postcss'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { validatePublicAssetUrl } from './urls'

const PUBLIC_ASSET_PREFIX = '__VITE_PUBLIC_ASSET__'
const PUBLIC_ASSET_RE = /^__VITE_PUBLIC_ASSET__\S+?__(?:[?#].*)?$/

interface UrlSlot {
  value: string
  start: number
  end: number
}
interface StyleValue {
  node: ChildNode
  value: string
  urls: UrlSlot[]
}
interface Description {
  root: Root
  shape: string
  values: StyleValue[]
}

function describeValue(value: string, urls: UrlSlot[], importUrl = false) {
  const slot = (node: valueParser.Node, offset = 0) => {
    if (node.type !== 'string' && node.type !== 'word') {
      throw new Error('URL 参数结构不明确')
    }
    if ('unclosed' in node && node.unclosed) {
      throw new Error('URL 参数没有闭合')
    }
    urls.push({ value: node.value, start: offset + node.sourceIndex, end: offset + node.sourceEndIndex })
    return ['url']
  }
  const visit = (nodes: valueParser.Node[], imageSet = false, firstImport = false): unknown[] => {
    const significant = nodes.filter(node => node.type !== 'space' && node.type !== 'comment')
    return significant.map((node, index) => {
      if (node.type === 'string' && (imageSet || (firstImport && index === 0))) {
        return slot(node)
      }
      if (node.type === 'function') {
        if (node.unclosed) {
          throw new Error('CSS 函数没有闭合')
        }
        const name = node.value.toLowerCase()
        if (name === 'url') {
          // parser 只对小写 url 特判；按原始跨度重读，保证大写 URL 的 data 内容也是完整叶子。
          const parsed = valueParser(`url${value.slice(node.sourceIndex + node.value.length, node.sourceEndIndex)}`).nodes[0]
          if (parsed?.type !== 'function' || parsed.unclosed) {
            throw new Error('URL 函数结构不明确')
          }
          const args = parsed.nodes.filter(node => node.type !== 'space' && node.type !== 'comment')
          if (args.length !== 1) {
            throw new Error('URL 参数数量不明确')
          }
          // url 的内容整体视为一个叶子，不递归解释 data URL 内的逗号和括号。
          return slot(args[0]!, node.sourceIndex)
        }
        return ['function', node.value, visit(node.nodes, /^(?:-webkit-)?image-set$/.test(name))]
      }
      return [node.type, node.value]
    })
  }
  return visit(valueParser(value).nodes, false, importUrl)
}

function describe(source: string, sourceId: string): Description {
  const root = postcss.parse(source, { from: sourceId })
  const values: StyleValue[] = []
  const valueShape = (node: ChildNode, value: string, importUrl = false) => {
    const raw = node.type === 'decl' ? node.raws.value : node.type === 'atrule' ? node.raws.params : undefined
    // PostCSS 的语义值会去掉部分注释；槽位与替换都必须基于同一份原始正文。
    value = raw?.value === value ? raw.raw : value
    const urls: UrlSlot[] = []
    values.push({ node, value, urls })
    return describeValue(value, urls, importUrl)
  }
  const visit = (nodes: ChildNode[]): unknown[] => nodes.filter(node => node.type !== 'comment').map((node) => {
    if (node.type === 'decl') {
      return ['decl', node.prop, Boolean(node.important), valueShape(node, node.value)]
    }
    if (node.type === 'rule') {
      return ['rule', node.selector, visit(node.nodes)]
    }
    if (node.type === 'atrule') {
      return ['atrule', node.name, valueShape(node, node.params, node.name.toLowerCase() === 'import'), node.nodes ? visit(node.nodes) : null]
    }
    throw new Error('CSS 节点结构不明确')
  })
  return { root, shape: JSON.stringify(visit(root.nodes)), values }
}

/** 保留图阶段编译正文，仅用同一预处理结果中可证明对应的 public URL 替换占位符。 */
export async function restoreCompiledPublicAssetUrls(compiled: string, processed: string, sourceId: string, publicDir: string | false) {
  if (!compiled.includes(PUBLIC_ASSET_PREFIX)) {
    return compiled
  }
  try {
    const target = describe(compiled, sourceId)
    const original = describe(processed, sourceId)
    if (target.shape !== original.shape) {
      throw new Error('声明、规则或 URL 槽位结构不一致')
    }
    const mappings = new Map<string, string>()
    for (const [index, value] of target.values.entries()) {
      const raw = original.values[index]!
      const edits: Array<{ start: number, end: number, text: string }> = []
      for (const [urlIndex, url] of value.urls.entries()) {
        if (!url.value.startsWith(PUBLIC_ASSET_PREFIX)) {
          continue
        }
        if (!PUBLIC_ASSET_RE.test(url.value)) {
          throw new Error('public 占位符结构不明确')
        }
        const rawUrl = raw.urls[urlIndex]!
        const decoded = await validatePublicAssetUrl(rawUrl.value, publicDir)
        const previous = mappings.get(url.value)
        if (previous !== undefined && previous !== decoded) {
          throw new Error('同一 public 占位符对应多个不同 URL')
        }
        mappings.set(url.value, decoded)
        edits.push({ start: url.start, end: url.end, text: raw.value.slice(rawUrl.start, rawUrl.end) })
      }
      if (edits.length) {
        let updated = value.value
        for (const edit of edits.reverse()) {
          updated = updated.slice(0, edit.start) + edit.text + updated.slice(edit.end)
        }
        if (value.node.type === 'decl') {
          delete value.node.raws.value
          value.node.value = updated
        }
        else if (value.node.type === 'atrule') {
          delete value.node.raws.params
          value.node.params = updated
        }
      }
    }
    return target.root.toString()
  }
  catch (cause) {
    throw new Error('[weapp-vite] 样式 public 资源 URL 无法与本轮预处理结果精确对应，请检查 CSS 转换前后的声明和 URL 结构。', { cause })
  }
}
