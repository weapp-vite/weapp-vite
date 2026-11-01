import type { Diagnostic } from '../types'
import type { ScriptProfile } from './parse'
import type { ScriptOptions, ScriptReference } from './types'
import { traverse } from '@weapp-vite/ast'
import { staticScriptString } from './facts'
import { checkFilterRules } from './filter'
import { nativeWxsSyntaxIssue } from './nativeWxs'

const HOST_GLOBALS = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs', 'qq', 'ks', 'ty', 'App', 'Page', 'Component', 'Behavior', 'getApp', 'getCurrentPages', 'window', 'document', 'process', 'global', 'globalThis'])

/** 平台规则只在对应方言生效，保留已文档化的 SJS 模块与现代语法差异。 */
export function checkScriptRules(ast: Parameters<typeof traverse>[0], source: string, profile: ScriptProfile, options: ScriptOptions): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const wxs = profile.dialect === 'wxs'
  const native = profile.sourceKind === 'native'
  const tt = profile.dialect === 'sjs' && options.platform === 'tt'
  const swan = profile.dialect === 'sjs' && options.platform === 'swan'
  const isolated = wxs || profile.filter || (profile.dialect === 'sjs' && ['swan', 'ty'].includes(options.platform ?? ''))
  const codePrefix = profile.filter ? 'filter' : wxs ? 'wxs' : 'sjs'
  const label = profile.filter ? 'Filter' : wxs ? 'WXS' : 'SJS'
  const add = (code: string, message: string, node: { start?: number | null, end?: number | null }) => {
    diagnostics.push({ code: `script/${codePrefix}-${code}`, message, severity: 'error', start: Math.min(source.length, node.start ?? 0), end: Math.min(source.length, node.end ?? 0) })
  }
  traverse(ast, {
    enter(path) {
      const syntax = native && wxs ? nativeWxsSyntaxIssue(path.node) : undefined
      if (syntax) {
        add('syntax', `原生 WXS 不支持${syntax}；需要现代语法时请使用 .wxs.ts 或 .wxs.js 交给构建转换。`, path.node)
      }
    },
    ReferencedIdentifier(path) {
      if (!isolated || path.findParent(parent => parent.isTSType() || parent.isTSInterfaceDeclaration() || parent.isTSTypeAliasDeclaration() || parent.isTSDeclareFunction()) || path.parentPath.isUnaryExpression({ operator: 'typeof' })) {
        return
      }
      const name = path.node.name
      if (HOST_GLOBALS.has(name) && !path.scope.getBinding(name)) {
        add('host-api', `${label} 独立于 AppService、浏览器和 Node 环境，不能访问全局 ${name}。`, path.node)
      }
    },
    'ImportDeclaration|ExportNamedDeclaration|ExportDefaultDeclaration|ExportAllDeclaration': function (path) {
      if (native && (wxs || tt)) {
        add('module', `原生 ${label} 使用 require() 与 module.exports；ESM 源码请使用 .${profile.dialect}.ts 或 .${profile.dialect}.js 交给构建转换。`, path.node)
      }
    },
    NewExpression(path) {
      const callee = path.node.callee
      if (native && tt) {
        add('constructor', '抖音原生 SJS 不支持 new 运算，请使用对应的 getDate()/getRegExp() 等受支持方式。', path.node)
      }
      else if (native && wxs && callee.type === 'Identifier' && ['Date', 'RegExp'].includes(callee.name) && !path.scope.getBinding(callee.name)) {
        add('constructor', `原生 WXS 使用 ${callee.name === 'Date' ? 'getDate' : 'getRegExp'}() 创建对象。`, callee)
      }
    },
    Super(path) {
      if (native && swan) {
        add('super', '百度原生 SJS 不支持 super 关键字。', path.node)
      }
    },
    RegExpLiteral(path) {
      if (native && wxs) {
        add('regexp', '原生 WXS 使用 getRegExp()，不使用 JavaScript 正则字面量。', path.node)
      }
    },
    CallExpression(path) {
      const callee = path.node.callee
      if (callee.type !== 'Identifier' || path.scope.getBinding(callee.name)) {
        return
      }
      if (native && tt && callee.name === 'require' && staticScriptString(path.node.arguments[0]) === undefined) {
        add('dynamic-require', '抖音原生 SJS 不支持动态 require()；请直接使用相对 .sjs 字符串路径。', path.node)
      }
      if (callee.name === 'getRegExp' && (wxs || swan)) {
        const flags = staticScriptString(path.node.arguments[1])
        if (flags !== undefined && (!/^[gim]*$/.test(flags) || new Set(flags).size !== flags.length)) {
          add('regexp-flags', `${label} 正则修饰符仅支持不重复的 g、i、m。`, path.node.arguments[1]!)
        }
      }
    },
  })
  if (native && profile.filter) {
    diagnostics.push(...checkFilterRules(ast, source.length))
  }
  return diagnostics
}

/** 引用限制源自各平台模块文档；不把示例路径升级为未经证实的强制规则。 */
export function checkScriptReferences(references: ScriptReference[], profile: ScriptProfile, options: ScriptOptions): Diagnostic[] {
  if (profile.sourceKind !== 'native') {
    return []
  }
  const wxs = profile.dialect === 'wxs'
  const sjs = profile.dialect === 'sjs'
  const relative = wxs || (sjs && ['tt', 'ty'].includes(options.platform ?? ''))
  const extension = wxs ? '.wxs' : sjs && ['tt', 'ty', 'swan'].includes(options.platform ?? '') ? '.sjs' : undefined
  if (!extension) {
    return []
  }
  return references.filter(reference => (reference.kind === 'require' || (sjs && options.platform === 'swan'))
    && (!reference.source.toLowerCase().endsWith(extension) || (relative && (!/^\.\.?\//.test(reference.source) || reference.source.includes('\\')))))
    .map(reference => ({
      code: `script/${profile.dialect}-require`,
      message: `原生 ${profile.dialect.toUpperCase()} 的模块引用必须使用${relative ? '相对路径的 ' : ''}${extension} 文件。`,
      severity: 'error',
      start: reference.start,
      end: reference.end,
    }))
}
