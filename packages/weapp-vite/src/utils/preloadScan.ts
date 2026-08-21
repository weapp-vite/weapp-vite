import path from 'pathe'
import { parseJsLike, traverse } from './babel'
import { toPosixPath } from './path'

const HOST_ROUTER_METHODS = new Set([
  'navigateTo',
  'redirectTo',
  'reLaunch',
  'switchTab',
])
const ROUTER_METHODS = new Set([
  'push',
  'replace',
])
const ROUTER_MODULES = new Set([
  'vue-router',
  'wevu',
  'wevu/router',
])
const ROUTER_FACTORY_METHODS = new Map<string, ReadonlySet<string>>([
  ['createRouter', ROUTER_METHODS],
  ['useNativeRouter', HOST_ROUTER_METHODS],
  ['useRouter', ROUTER_METHODS],
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

function getIdentifierName(node: any) {
  return node?.type === 'Identifier' ? node.name as string : undefined
}

function collectRouterBindings(ast: any) {
  const importedFactories = new Map<unknown, ReadonlySet<string>>()
  const routerObjects = new Map<unknown, ReadonlySet<string>>()
  const routerFunctions = new Map<unknown, string>()

  traverse(ast, {
    ImportDeclaration(importPath: any) {
      if (!ROUTER_MODULES.has(importPath.node.source?.value)) {
        return
      }
      for (const specifier of importPath.node.specifiers ?? []) {
        if (specifier.type !== 'ImportSpecifier') {
          continue
        }
        const imported = getIdentifierName(specifier.imported) ?? getStaticString(specifier.imported)
        const local = getIdentifierName(specifier.local)
        const methods = imported ? ROUTER_FACTORY_METHODS.get(imported) : undefined
        const binding = local ? importPath.scope.getBinding(local) : undefined
        if (methods && binding) {
          importedFactories.set(binding, methods)
        }
      }
    },
  })

  traverse(ast, {
    VariableDeclarator(declaratorPath: any) {
      const init = declaratorPath.node.init
      const factory = init?.type === 'CallExpression'
        ? getIdentifierName(init.callee)
        : undefined
      if (!factory) {
        return
      }
      const factoryBinding = declaratorPath.scope.getBinding(factory)
      const methods = factoryBinding
        ? importedFactories.get(factoryBinding)
        : ROUTER_FACTORY_METHODS.get(factory)
      if (!methods) {
        return
      }

      const id = declaratorPath.node.id
      const objectName = getIdentifierName(id)
      if (objectName) {
        const binding = declaratorPath.scope.getBinding(objectName)
        if (binding?.constant) {
          routerObjects.set(binding, methods)
        }
        return
      }
      if (id?.type !== 'ObjectPattern') {
        return
      }
      for (const property of id.properties ?? []) {
        if (property.type !== 'ObjectProperty' && property.type !== 'Property') {
          continue
        }
        const importedMethod = getPropertyName(property.key)
        const local = getIdentifierName(property.value)
        const binding = local ? declaratorPath.scope.getBinding(local) : undefined
        if (importedMethod && methods.has(importedMethod) && binding?.constant) {
          routerFunctions.set(binding, importedMethod)
        }
      }
    },
  })

  return { routerFunctions, routerObjects }
}

function getNavigationMethod(
  callPath: any,
  bindings: ReturnType<typeof collectRouterBindings>,
) {
  const callee = callPath.node.callee
  const directName = getIdentifierName(callee)
  const directMethod = directName
    ? bindings.routerFunctions.get(callPath.scope.getBinding(directName))
    : undefined
  if (directMethod) {
    return directMethod
  }
  if (callee?.type !== 'MemberExpression' && callee?.type !== 'OptionalMemberExpression') {
    return undefined
  }

  const objectName = getIdentifierName(callee.object)
  const method = getPropertyName(callee.property)
  if (objectName === 'wx' && !callPath.scope.getBinding('wx') && method && HOST_ROUTER_METHODS.has(method)) {
    return method
  }
  if (
    objectName
    && method
  ) {
    const methods = bindings.routerObjects.get(callPath.scope.getBinding(objectName))
    if (methods?.has(method)) {
      return method
    }
  }
}

function collectScriptTargets(source: string, sourcePage: string) {
  const targets: string[] = []
  try {
    const ast = parseJsLike(source)
    const bindings = collectRouterBindings(ast)
    traverse(ast, {
      CallExpression(callPath: any) {
        if (!getNavigationMethod(callPath, bindings)) {
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
