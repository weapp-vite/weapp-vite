import type { AstParserLike } from '../../../../ast'
import type { WebRuntimeNativeInject } from '../../../../runtime/config/internal/injectRequestGlobals/nativeInject'
import MagicString from 'magic-string'
import { walk } from 'oxc-walker'
import { WEB_RUNTIME_GLOBAL_OBJECT_NAMES } from '../../../../runtime/config/internal/injectRequestGlobals/runtime'

const GLOBAL_OBJECT_NAMES = new Set<string>(WEB_RUNTIME_GLOBAL_OBJECT_NAMES)
const INJECTED_GLOBAL_MEMBER_RE = /^(globalThis|global|self|window)\.([A-Za-z_$][\w$]*)$/u
const SCRIPT_MODULE_ID_RE = /\.[cm]?[jt]sx?$/u

type NativeDeleteTargets = Map<string, Set<string>>

export function isNativeDeleteGuardModuleId(id: string) {
  return SCRIPT_MODULE_ID_RE.test(id)
}

export function createNativeDeleteTargets(plan: WebRuntimeNativeInject): NativeDeleteTargets {
  const targets: NativeDeleteTargets = new Map()
  for (const key of Object.keys(plan.inject)) {
    const match = key.match(INJECTED_GLOBAL_MEMBER_RE)
    if (!match) {
      continue
    }
    const [, objectName, target] = match
    let objectTargets = targets.get(objectName!)
    if (!objectTargets) {
      objectTargets = new Set()
      targets.set(objectName!, objectTargets)
    }
    objectTargets.add(target!)
  }
  return targets
}

function resolveDeleteLanguage(id: string, moduleType?: string) {
  if (moduleType === 'ts' || moduleType === 'tsx' || moduleType === 'jsx') {
    return moduleType
  }
  return /\.[cm]?tsx?$/u.test(id) ? 'ts' : 'js'
}

/**
 * 把会被 inject 改写的点号 delete 转成等价的计算属性访问。
 * Rolldown 的 inject 会先替换 delete 的操作数；直接生成 `delete <binding>` 会破坏严格模式语法。
 */
export function protectNativeInjectedGlobalDeletes(
  code: string,
  id: string,
  targets: NativeDeleteTargets,
  parserLike: AstParserLike,
  moduleType?: string,
) {
  if (!code.includes('delete') || targets.size === 0 || !parserLike.parse) {
    return null
  }

  const ast = parserLike.parse(code, { lang: resolveDeleteLanguage(id, moduleType) })
  if (!ast || typeof ast !== 'object') {
    return null
  }

  const source = new MagicString(code)
  let changed = false
  walk(ast as Parameters<typeof walk>[0], {
    enter(node) {
      if (node.type !== 'UnaryExpression' || node.operator !== 'delete') {
        return
      }
      const argument = node.argument
      if (
        argument?.type !== 'MemberExpression'
        || argument.computed
        || argument.object?.type !== 'Identifier'
        || argument.property?.type !== 'Identifier'
        || !GLOBAL_OBJECT_NAMES.has(argument.object.name)
        || !targets.get(argument.object.name)?.has(argument.property.name)
      ) {
        return
      }

      // 整体替换 member，避免 `(globalThis).fetch` 的括号在局部改写时丢失。
      source.overwrite(
        argument.start,
        argument.end,
        `${argument.object.name}[${JSON.stringify(argument.property.name)}]`,
      )
      changed = true
    },
  })

  return changed
    ? {
        code: source.toString(),
        map: source.generateMap({ hires: 'boundary' }),
      }
    : null
}
