import type { CompilerContext } from '../../../../../context'
import type { Entry } from '../../../../../types'
import { isObject, removeExtensionDeep } from '@weapp-core/shared'
import { toKebabCaseComponentName } from '../../../../../utils/json'
import { isVueEntryJsonPublisher } from '../../../../utils/entryJson'

function componentBindings(config: unknown) {
  return isObject(config) && isObject(config.usingComponents)
    ? config.usingComponents as Record<string, unknown>
    : {}
}

function canonicalComponentBindings(config: unknown) {
  return Object.fromEntries(Object.entries(componentBindings(config))
    .map(([name, value]) => [toKebabCaseComponentName(name), value]))
}

/** 从当前入口输入补齐模板派生绑定，不读取历史产物或改写编译器配置。 */
export function composeVueEntryJsonConfig(
  ctx: CompilerContext,
  filename: string,
  compiledConfig: string | undefined,
) {
  const entries = ctx.runtimeState?.build?.hmr?.entriesMap
  if (!entries?.size) {
    return undefined
  }
  const key = removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(filename))
  const entry: Entry | undefined = entries.get(key)
  if (!entry || !isVueEntryJsonPublisher(entry.path, entry.type, ctx.configService)) {
    return undefined
  }
  // 编译器已按用户策略合成声明、默认值和 layout/slot 配置；不能再次执行策略
  // 或用 loader 中的原始声明复活被 replace/自定义策略删除的字段。
  const config = compiledConfig === undefined
    ? structuredClone(entry.json ?? {}) as Record<string, unknown>
    : JSON.parse(compiledConfig) as Record<string, unknown>
  // 声明和派生绑定先沿用编译器的标签命名，避免别名回灌或复活已删除的声明。
  const declaredBindings = canonicalComponentBindings(entry.declaredJson)
  const currentBindings = canonicalComponentBindings(entry.json)
  if (compiledConfig === undefined && isObject(config.usingComponents)) {
    config.usingComponents = currentBindings
  }
  const derivedBindings = Object.fromEntries(Object.entries(currentBindings)
    .filter(([name, value]) => declaredBindings[name] !== value))
  if (Object.keys(derivedBindings).length) {
    config.usingComponents = { ...derivedBindings, ...componentBindings(config) }
  }
  return JSON.stringify(config)
}
