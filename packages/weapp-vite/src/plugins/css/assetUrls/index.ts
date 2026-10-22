import type { OutputBundle } from 'rolldown'
import path from 'pathe'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

type AssetIndex = Map<string, string | null>
const indexes = new WeakMap<OutputBundle, { root: string, assets: AssetIndex }>()
const URL_VALUE_RE = /(?:url|(?:-webkit-)?image-set)\s*\(/i
const CSS_ESCAPE_RE = /\\(?:([a-f\d]{1,6})(?:\r\n|[ \t\n\r\f])?|\r\n|[\n\r\f]|(.))/gi
const EXTERNAL_URL_RE = /^(?:[a-z][a-z\d+.-]*:|[/#?])/i

function assetIndex(bundle: OutputBundle, root: string) {
  const cached = indexes.get(bundle)
  if (cached?.root === root) {
    return cached.assets
  }
  const assets: AssetIndex = new Map()
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') {
      continue
    }
    for (const original of output.originalFileNames ?? []) {
      const source = path.resolve(root, original)
      const fileName = path.normalize(output.fileName)
      const previous = assets.get(source)
      assets.set(source, previous === undefined || previous === fileName ? fileName : null)
    }
  }
  indexes.set(bundle, { root, assets })
  return assets
}

function unescapeCss(value: string) {
  return value.replace(CSS_ESCAPE_RE, (_escape, hex: string | undefined, character: string | undefined) => {
    if (hex) {
      const code = Number.parseInt(hex, 16)
      return String.fromCodePoint(code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF) ? 0xFFFD : code)
    }
    return character ?? ''
  })
}

function relativeReference(value: string) {
  let index = 0
  while (index < value.length) {
    if (value[index] === '\\') {
      index += 2
      continue
    }
    if (value[index] === '?' || value[index] === '#') {
      break
    }
    index++
  }
  const pathname = unescapeCss(value.slice(0, index))
  if (!pathname || EXTERNAL_URL_RE.test(pathname)) {
    return undefined
  }
  try {
    // 先分离原始 query/hash，再解码路径，避免把 %23 文件名误作 fragment。
    return { pathname: decodeURIComponent(pathname), suffix: value.slice(index) }
  }
  catch {
    return undefined
  }
}

function encodePath(value: string) {
  return value.split('/').map(segment => encodeURIComponent(segment).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
}

function resolveReference(value: string, sourceId: string, fileName: string, assets: AssetIndex) {
  const reference = relativeReference(value)
  if (!reference || EXTERNAL_URL_RE.test(reference.pathname)) {
    return value
  }
  const output = assets.get(path.resolve(path.dirname(sourceId), reference.pathname))
  if (!output) {
    return value
  }
  const relative = path.posix.relative(path.posix.dirname(path.normalize(fileName)), output)
  return `${encodePath(relative.startsWith('.') ? relative : `./${relative}`)}${reference.suffix}`
}

function urlArgument(node: valueParser.Node) {
  if (node.type !== 'function' || node.value.toLowerCase() !== 'url') {
    return undefined
  }
  if (node.value !== 'url') {
    const normalized = valueParser(`url(${valueParser.stringify(node.nodes)})`).nodes[0]
    if (normalized?.type === 'function') {
      node.nodes = normalized.nodes
    }
  }
  const args = node.nodes.filter(child => child.type !== 'space' && child.type !== 'comment')
  return args.length === 1 && (args[0]?.type === 'word' || args[0]?.type === 'string') ? args[0] : undefined
}

/** 在原生资产定稿后，只重定位当前输出可唯一归属的资产；调用点必须仍持有单份样式的源码位置。 */
export function resolveNativeStyleAssetUrls(source: string, sourceId: string, fileName: string, bundle: OutputBundle, root: string) {
  if (!URL_VALUE_RE.test(source)) {
    return source
  }
  const assets = assetIndex(bundle, root)
  if (!assets.size) {
    return source
  }
  const rewrite = (value: string) => {
    const parsed = valueParser(value)
    parsed.walk((node) => {
      const argument = urlArgument(node)
      if (argument) {
        argument.value = resolveReference(argument.value, sourceId, fileName, assets)
        return false
      }
      if (node.type === 'function' && /^(?:-webkit-)?image-set$/i.test(node.value)) {
        for (const child of node.nodes) {
          if (child.type === 'string') {
            child.value = resolveReference(child.value, sourceId, fileName, assets)
          }
        }
      }
    })
    return parsed.toString()
  }
  const css = postcss.parse(source, { from: sourceId })
  css.walkDecls((declaration) => {
    declaration.value = rewrite(declaration.value)
  })
  css.walkAtRules((rule) => {
    if (rule.name.toLowerCase() !== 'import') {
      rule.params = rewrite(rule.params)
    }
  })
  return css.toString()
}
