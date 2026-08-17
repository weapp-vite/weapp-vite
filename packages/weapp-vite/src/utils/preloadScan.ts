import path from 'pathe'
import { parseJsLike, traverse } from './babel'
import { toPosixPath } from './path'

const ROUTER_METHODS = new Set([
  'navigateTo',
  'redirectTo',
  'reLaunch',
  'switchTab',
  'push',
  'replace',
])
const TEMPLATE_NAVIGATOR_RE = /<navigator(?=\s|>)[^>]*?\surl\s*=\s*(["'])([^"'{}\s]+)\1/gi

function normalizePagePath(value: string) {
  return path.posix.normalize(value).replace(/^\/+/, '').replace(/^\.\//, '')
}

function normalizeStaticTarget(target: string, sourcePage: string) {
  const route = toPosixPath(target).split(/[?#]/, 1)[0]
  const resolved = route.startsWith('/')
    ? route
    : route.startsWith('./') || route.startsWith('../')
      ? path.posix.join(path.posix.dirname(sourcePage), route)
      : route
  return normalizePagePath(resolved)
}

function getStaticString(node: any) {
  if (node?.type === 'StringLiteral' || (node?.type === 'Literal' && typeof node.value === 'string')) {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw
  }
  return undefined
}

function getPropertyName(node: any) {
  if (!node) {
    return undefined
  }
  if (node.type === 'Identifier' && !node.computed) {
    return node.name
  }
  return getStaticString(node)
}

function getRouteFromObject(argument: any) {
  if (argument?.type !== 'ObjectExpression') {
    return undefined
  }
  for (const property of argument.properties ?? []) {
    if (property.type !== 'ObjectProperty' && property.type !== 'Property') {
      continue
    }
    const name = getPropertyName(property.key)
    if (name !== 'url' && name !== 'path') {
      continue
    }
    const value = getStaticString(property.value)
    if (value) {
      return value
    }
  }
  return undefined
}

function collectScriptTargets(source: string, sourcePage: string) {
  const targets: string[] = []
  try {
    const ast = parseJsLike(source)
    traverse(ast, {
      CallExpression(callPath: any) {
        const callee = callPath.node.callee
        const method = callee?.type === 'Identifier'
          ? callee.name
          : callee?.type === 'MemberExpression'
            ? getPropertyName(callee.property)
            : undefined
        if (!ROUTER_METHODS.has(method)) {
          return
        }
        const argument = callPath.node.arguments?.[0]
        const target = getStaticString(argument) ?? getRouteFromObject(argument)
        if (target) {
          targets.push(normalizeStaticTarget(target, sourcePage))
        }
      },
    })
  }
  catch {
    // 解析失败的脚本不应阻断整份分析结果。
  }
  return [...new Set(targets)]
}

function collectTemplateTargets(source: string, sourcePage: string) {
  const targets: string[] = []
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '')
  TEMPLATE_NAVIGATOR_RE.lastIndex = 0
  for (const match of withoutComments.matchAll(TEMPLATE_NAVIGATOR_RE)) {
    const target = match[2]
    if (target) {
      targets.push(normalizeStaticTarget(target, sourcePage))
    }
  }
  return [...new Set(targets)]
}

export function collectStaticRouteTargets(
  source: string,
  kind: 'template' | 'script',
  sourcePage: string,
) {
  return kind === 'template'
    ? collectTemplateTargets(source, sourcePage)
    : collectScriptTargets(source, sourcePage)
}
