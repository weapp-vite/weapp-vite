import type { NodePath } from '@babel/traverse'
import type { CallExpression } from '@babel/types'
import type { SourceMap } from 'magic-string'

import type { ModuleMeta } from './types'
import { parse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import * as t from '@babel/types'

import MagicString from 'magic-string'
import { STYLE_QUERY, TEMPLATE_QUERY } from './constants'
import { appendQuery, resolveRuntimePolyfillPath, toRelativeImport, toViteFsImport } from './path'

type TraverseFunction = typeof _babelTraverse extends (...args: any[]) => any
  ? typeof _babelTraverse
  : typeof _babelTraverse extends { default: infer D }
    ? D
    : typeof _babelTraverse

export function resolveBabelTraverse(mod: any): TraverseFunction {
  if (typeof mod === 'function') {
    return mod
  }
  if (mod?.default && typeof mod.default === 'function') {
    return mod.default
  }
  if (mod?.traverse && typeof mod.traverse === 'function') {
    return mod.traverse
  }
  throw new TypeError('[@weapp-vite/web] Failed to resolve @babel/traverse export.')
}

const traverse = resolveBabelTraverse(_babelTraverse)

function getRegisterName(kind: ModuleMeta['kind'], callee: string) {
  if (kind === 'page' && (callee === 'Page' || callee === 'Component')) {
    return 'registerPage'
  }
  if (kind === 'component' && callee === 'Component') {
    return 'registerComponent'
  }
  if (kind === 'app' && callee === 'App') {
    return 'registerApp'
  }
  return undefined
}

function createRegisterMetaCode(
  meta: ModuleMeta,
  templateIdent: string | undefined,
  styleIdent: string | undefined,
  includeKind = false,
) {
  const metaParts: string[] = [`id: ${JSON.stringify(meta.id)}`]
  if (includeKind) {
    metaParts.push(`kind: ${JSON.stringify(meta.kind)}`)
  }
  if (templateIdent) {
    metaParts.push(`template: ${templateIdent}`)
  }
  if (styleIdent) {
    metaParts.push(`style: ${styleIdent}`)
  }
  if (meta.navigationBar) {
    metaParts.push(`navigationBar: ${JSON.stringify(meta.navigationBar)}`)
  }
  return `{ ${metaParts.join(', ')} }`
}

function overwriteCall(
  path: NodePath<CallExpression>,
  meta: ModuleMeta,
  registerName: string,
  templateIdent: string | undefined,
  styleIdent: string | undefined,
  s: MagicString,
  includeKind = false,
) {
  const node = path.node
  const callee = node.callee
  const identifier = callee as t.Identifier
  const end = node.end!
  const insertPosition = end - 1
  const metaCode = createRegisterMetaCode(meta, templateIdent, styleIdent, includeKind)
  s.overwrite(identifier.start!, identifier.end!, registerName)
  s.appendLeft(insertPosition, `, ${metaCode}`)
}

interface TransformScriptModuleOptions {
  code: string
  cleanId: string
  meta: ModuleMeta
  enableHmr: boolean
  runtimeModuleId?: string
  hmrAcceptCode?: string
}

export function transformScriptModule({
  code,
  cleanId,
  meta,
  enableHmr,
  runtimeModuleId,
  hmrAcceptCode,
}: TransformScriptModuleOptions): null | { code: string, map: SourceMap } {
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

  const imports: string[] = []
  const runtimePolyfillId = runtimeModuleId ?? toViteFsImport(resolveRuntimePolyfillPath())
  const templateIdent = meta.templatePath ? '__weapp_template__' : undefined
  const styleIdent = meta.stylePath ? '__weapp_style__' : undefined

  if (meta.templatePath && templateIdent) {
    imports.push(`import ${templateIdent} from '${appendQuery(toRelativeImport(cleanId, meta.templatePath), TEMPLATE_QUERY)}'`)
  }

  if (meta.stylePath && styleIdent) {
    const styleQuery = meta.stylePath.endsWith('.wxss') ? STYLE_QUERY : 'inline'
    imports.push(`import ${styleIdent} from '${appendQuery(toRelativeImport(cleanId, meta.stylePath), styleQuery)}'`)
  }

  const registerImports = new Set<string>()

  traverse(ast, {
    CallExpression(path: NodePath<CallExpression>) {
      if (!t.isIdentifier(path.node.callee)) {
        return
      }
      const name = path.node.callee.name
      const registerName = getRegisterName(meta.kind, name)
      if (registerName) {
        registerImports.add(registerName)
        overwriteCall(path, meta, registerName, templateIdent, styleIdent, s)
      }
    },
  })

  registerImports.add('installWebModuleRegistration')
  imports.unshift(`import { ${Array.from(registerImports).join(', ')} } from '${runtimePolyfillId}'`)

  const moduleMetaCode = createRegisterMetaCode(meta, templateIdent, styleIdent, true)
  const restoreIdent = '__weapp_web_restore_registration__'
  const prefix = `${imports.join('\n')}\nconst ${restoreIdent} = installWebModuleRegistration(${moduleMetaCode})\n`
  s.prepend(prefix)

  s.append(`\n${restoreIdent}()\n`)

  if (enableHmr && hmrAcceptCode) {
    s.append(`\n${hmrAcceptCode}\n`)
  }

  return {
    code: s.toString(),
    map: s.generateMap({
      hires: true,
    }),
  }
}
