import type { NodePath } from '@babel/traverse'
import type { CallExpression } from '@babel/types'
import type { SourceMap } from 'magic-string'

import type { ModuleMeta } from './types'
import { parse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import * as t from '@babel/types'

import MagicString from 'magic-string'
import { appendInlineQuery, toRelativeImport } from './path'

type TraverseFunction = typeof _babelTraverse extends (...args: any[]) => any
  ? typeof _babelTraverse
  : typeof _babelTraverse extends { default: infer D }
    ? D
    : typeof _babelTraverse

const traverseCandidate: any = (() => {
  const mod: any = _babelTraverse
  if (typeof mod === 'function') {
    return mod
  }
  if (mod?.default && typeof mod.default === 'function') {
    return mod.default
  }
  if (mod?.traverse && typeof mod.traverse === 'function') {
    return mod.traverse
  }
  return undefined
})()

if (typeof traverseCandidate !== 'function') {
  throw new TypeError('[@weapp-vite/web] Failed to resolve @babel/traverse export.')
}

const traverse: TraverseFunction = traverseCandidate

function mapRegisterIdentifier(kind: ModuleMeta['kind']) {
  if (kind === 'page') {
    return 'Page'
  }
  if (kind === 'component') {
    return 'Component'
  }
  if (kind === 'app') {
    return 'App'
  }
  return ''
}

function getRegisterName(kind: ModuleMeta['kind']) {
  if (kind === 'page') {
    return 'registerPage'
  }
  if (kind === 'component') {
    return 'registerComponent'
  }
  if (kind === 'app') {
    return 'registerApp'
  }
  return undefined
}

function overwriteCall(
  path: NodePath<CallExpression>,
  meta: ModuleMeta,
  registerName: string,
  templateIdent: string | undefined,
  styleIdent: string | undefined,
  s: MagicString,
) {
  const node = path.node
  const callee = node.callee
  if (!t.isIdentifier(callee)) {
    return
  }
  const end = node.end!
  const insertPosition = end - 1
  const metaParts: string[] = [`id: ${JSON.stringify(meta.id)}`]
  if (templateIdent) {
    metaParts.push(`template: ${templateIdent}`)
  }
  if (styleIdent) {
    metaParts.push(`style: ${styleIdent}`)
  }
  const metaCode = `{ ${metaParts.join(', ')} }`
  s.overwrite(callee.start!, callee.end!, registerName)
  s.appendLeft(insertPosition, `, ${metaCode}`)
}

interface TransformScriptModuleOptions {
  code: string
  cleanId: string
  meta: ModuleMeta
  enableHmr: boolean
}

export function transformScriptModule({
  code,
  cleanId,
  meta,
  enableHmr,
}: TransformScriptModuleOptions): null | { code: string, map: SourceMap } {
  const registerName = getRegisterName(meta.kind)
  if (!registerName) {
    return null
  }

  let ast: ReturnType<typeof parse> | undefined
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
      ranges: true,
    })
  }
  catch {
    return null
  }

  const s = new MagicString(code)
  let transformed = false

  const imports: string[] = []
  const templateIdent = meta.templatePath ? '__weapp_template__' : undefined
  const styleIdent = meta.stylePath ? '__weapp_style__' : undefined

  if (meta.templatePath && templateIdent) {
    imports.push(`import ${templateIdent} from '${toRelativeImport(cleanId, meta.templatePath)}'`)
  }

  if (meta.stylePath && styleIdent) {
    imports.push(`import ${styleIdent} from '${appendInlineQuery(toRelativeImport(cleanId, meta.stylePath))}'`)
  }

  const registerImports = new Set<string>()

  traverse(ast, {
    CallExpression(path: NodePath<CallExpression>) {
      if (!t.isIdentifier(path.node.callee)) {
        return
      }
      const name = path.node.callee.name
      if (name === mapRegisterIdentifier(meta.kind)) {
        registerImports.add(registerName)
        overwriteCall(path, meta, registerName, templateIdent, styleIdent, s)
        transformed = true
      }
    },
  })

  if (!transformed) {
    return null
  }

  if (registerImports.size > 0) {
    imports.unshift(`import { ${Array.from(registerImports).join(', ')} } from '@weapp-vite/web/runtime/polyfill'`)
  }

  const prefix = `${imports.join('\n')}\n`
  s.prepend(prefix)

  if (enableHmr) {
    s.append(`\nif (import.meta.hot) { import.meta.hot.accept() }\n`)
  }

  return {
    code: s.toString(),
    map: s.generateMap({
      hires: true,
    }),
  }
}
