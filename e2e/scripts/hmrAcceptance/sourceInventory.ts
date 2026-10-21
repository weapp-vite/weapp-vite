import { parse } from '@babel/parser'
import * as t from '@babel/types'

export interface HmrSourceMutation {
  method: string
  line: number
  target?: string
  cleanup: boolean
}

export interface HmrSourceInspection {
  startsDevProcess: boolean
  mutations: HmrSourceMutation[]
  candidate: boolean
}

const MUTATION_METHODS = new Set([
  'writeFile',
  'appendFile',
  'writeJSON',
  'writeJson',
  'outputFile',
  'outputJSON',
  'outputJson',
  'rename',
  'copyFile',
  'cp',
  'rm',
  'unlink',
  'rmdir',
  'move',
  'remove',
  'copy',
  'replaceFileByRename',
  'writeNativeBatch',
  'saveNativeProfileSource',
  'renameAtomicFile',
])

function propertyName(node: t.Node): string {
  return t.isIdentifier(node) ? node.name : t.isStringLiteral(node) ? node.value : ''
}

function callName(callee: t.CallExpression['callee'] | t.OptionalCallExpression['callee'], bindings: Map<string, string>): string {
  if (t.isIdentifier(callee)) {
    return bindings.get(callee.name) ?? callee.name
  }
  if (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) {
    return !callee.computed || t.isStringLiteral(callee.property) ? propertyName(callee.property) : ''
  }
  return ''
}

/** 从真实调用识别 dev 与文件变更，不依赖文件名、注释或场景清单。 */
export function inspectHmrSource(source: string, file: string): HmrSourceInspection {
  const ast = parse(source, { sourceType: 'module', sourceFilename: file, plugins: ['typescript'] })
  const bindings = new Map<string, string>()
  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        if (t.isImportSpecifier(specifier)) {
          bindings.set(specifier.local.name, propertyName(specifier.imported))
        }
      }
    }
  }
  let startsDevProcess = false
  const mutations: HmrSourceMutation[] = []

  function visit(node: t.Node, teardown = false, cleanup = false) {
    if ((t.isObjectProperty(node) || t.isObjectMethod(node)) && !node.computed && propertyName(node.key) === 'cleanup') {
      cleanup = true
    }
    if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
      const method = callName(node.callee, bindings)
      teardown ||= method === 'afterAll' || method === 'afterEach'
      if (!teardown && method === 'startDevProcess') {
        startsDevProcess = true
      }
      if (!teardown && MUTATION_METHODS.has(method)) {
        const argument = node.arguments[0]
        mutations.push({
          method,
          line: node.loc?.start.line ?? 1,
          ...(t.isIdentifier(argument) ? { target: argument.name } : {}),
          cleanup,
        })
      }
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const value = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(value)) {
        for (const child of value) {
          if (t.isNode(child)) {
            visit(child, teardown, cleanup)
          }
        }
      }
      else if (t.isNode(value)) {
        visit(value, teardown, cleanup)
      }
    }
  }

  visit(ast)
  return { startsDevProcess, mutations, candidate: startsDevProcess && mutations.length > 0 }
}
