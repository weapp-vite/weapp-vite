import type { AtRule, Root } from 'postcss'
import { posix } from 'node:path'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'

function relativeReference(value: string): { pathname: string, suffix: string } | undefined {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|[/#?])/i.test(value)) {
    return undefined
  }
  // CSS 反斜杠是转义符，不能按 Windows 路径分隔符归一化。
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
  return { pathname: value.slice(0, index), suffix: value.slice(index) }
}

function rebaseReference(value: string, sourceFile: string, targetFile: string): string {
  const reference = relativeReference(value)
  if (!reference) {
    return value
  }
  const absolute = posix.join(posix.dirname(sourceFile), reference.pathname)
  const relative = posix.relative(posix.dirname(targetFile), absolute)
  return `${relative.startsWith('.') ? relative : `./${relative}`}${reference.suffix}`
}

function urlArgument(node: valueParser.Node): valueParser.StringNode | valueParser.WordNode | undefined {
  if (node.type !== 'function' || node.value.toLowerCase() !== 'url') {
    return undefined
  }
  // value-parser 仅对小写 url 启用 URL tokenizer；大写函数也遵循相同 CSS 语义。
  if (node.value !== 'url') {
    const normalized = valueParser(`url(${valueParser.stringify(node.nodes)})`).nodes[0]
    if (normalized?.type === 'function') {
      node.nodes = normalized.nodes
    }
  }
  const args = node.nodes.filter(child => child.type !== 'space' && child.type !== 'comment')
  if (args.length === 1 && (args[0]?.type === 'word' || args[0]?.type === 'string')) {
    return args[0]
  }
}

function rebaseUrls(value: string, sourceFile: string, targetFile: string): string {
  const parsed = valueParser(value)
  parsed.walk((node) => {
    const argument = urlArgument(node)
    if (argument) {
      argument.value = rebaseReference(argument.value, sourceFile, targetFile)
      return false
    }
  })
  return parsed.toString()
}

/** 仅从当前构建资产展开全局样式，保留未知导入与外部资源的引用语义。 */
export function createStatefulHmrStyleRebaser(sources: ReadonlyMap<string, string>) {
  const parsed = new Map<string, Root>()
  function expand(sourceFile: string, targetFile: string, ancestors: string[]): Root {
    if (ancestors.includes(sourceFile)) {
      throw new Error(`Stateful HMR circular stylesheet import: ${[...ancestors, sourceFile].join(' -> ')}`)
    }
    let original = parsed.get(sourceFile)
    if (!original) {
      const source = sources.get(sourceFile)
      if (source === undefined) {
        throw new Error(`Stateful HMR stylesheet missing from current output: ${sourceFile}`)
      }
      original = postcss.parse(source, { from: undefined })
      parsed.set(sourceFile, original)
    }
    const root = original.clone()
    root.walkDecls((declaration) => {
      declaration.value = rebaseUrls(declaration.value, sourceFile, targetFile)
    })
    // 先处理当前文件中的 URL，再插入已按目标页面重定位的依赖，避免重复改写。
    root.walkAtRules((rule) => {
      if (rule.name.toLowerCase() === 'charset') {
        rule.remove()
      }
      else if (rule.name.toLowerCase() !== 'import') {
        rule.params = rebaseUrls(rule.params, sourceFile, targetFile)
      }
    })
    const imports: AtRule[] = []
    root.walkAtRules((rule) => {
      if (rule.name.toLowerCase() === 'import') {
        imports.push(rule)
      }
    })
    for (const rule of imports) {
      const params = valueParser(rule.params)
      const first = params.nodes.find(node => node.type !== 'space' && node.type !== 'comment')
      const argument = first?.type === 'string' ? first : first ? urlArgument(first) : undefined
      if (!argument || !first) {
        continue
      }
      const reference = relativeReference(argument.value)
      const dependency = reference && posix.join(posix.dirname(sourceFile), reference.pathname)
      const tail = params.nodes.slice(params.nodes.indexOf(first) + 1)
      const modifiers = valueParser.stringify(tail).trim()
      // layer/supports 的导入限定语保留原语法；WXSS 原生导入和媒体条件可安全展开。
      const modernModifiers = tail.some(node => (node.type === 'word' || node.type === 'function') && /^(?:layer|supports)$/i.test(node.value))
      if (reference && dependency && !reference.suffix && posix.extname(dependency) === posix.extname(sourceFile) && sources.has(dependency) && !modernModifiers) {
        const child = expand(dependency, targetFile, [...ancestors, sourceFile])
        if (modifiers) {
          const media = postcss.atRule({ name: 'media', params: modifiers })
          media.append(child.nodes)
          rule.replaceWith(media)
        }
        else {
          rule.replaceWith(...child.nodes)
        }
      }
      else {
        argument.value = rebaseReference(argument.value, sourceFile, targetFile)
        rule.params = params.toString()
      }
    }
    return root
  }
  return (sourceFile: string, targetFile: string): string => expand(sourceFile, targetFile, []).toString()
}
