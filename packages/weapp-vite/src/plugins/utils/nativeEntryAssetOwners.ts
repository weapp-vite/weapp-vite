import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import { parseLogicalEntryId } from '../../moduleGraph/protocol'
import { normalizeSourceId } from '../../moduleGraph/traversal'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { withRealpathScope } from '../../utils/realpathScope'

interface NativeAssetOutputScope {
  dir?: string
  file?: string
  format?: string
}

interface NativeAssetOwnerContext {
  moduleGraphService?: Pick<CompilerContext['moduleGraphService'], 'getEntryDependencies'>
  configService?: Pick<CompilerContext['configService'], 'relativeOutputPath' | 'outputExtensions'>
}

const generations = new WeakMap<object, WeakMap<object, Map<string, ReadonlySet<string>>>>()
const noOwners: ReadonlySet<string> = new Set()

function outputScopeKey(output: NativeAssetOutputScope) {
  return JSON.stringify([output.dir?.replaceAll('\\', '/'), output.file?.replaceAll('\\', '/'), output.format])
}

function getEnvironmentGenerations(ctx: object) {
  let environments = generations.get(ctx)
  if (!environments) {
    environments = new WeakMap()
    generations.set(ctx, environments)
  }
  return environments
}

/** 新构建先撤销旧代所有权，早退或失败不能继承上轮授权。 */
export function clearNativeEntryAssetOwners(ctx: object, environment?: object) {
  generations.get(ctx)?.delete(environment ?? ctx)
}

/** 编译缓存只保存结果；原生资产由当前输出图中的逻辑注册入口拥有。 */
export function collectNativeEntryAssetOwners(bundle: OutputBundle): ReadonlySet<string> {
  return withRealpathScope(() => {
    const owners = new Set<string>()
    const add = (id: string | null | undefined) => {
      const entry = id && parseLogicalEntryId(id)
      if (entry) {
        owners.add(normalizeSourceId(entry.sourceId))
      }
    }
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') {
        continue
      }
      add(output.facadeModuleId)
      for (const id of output.moduleIds ?? []) {
        add(id)
      }
    }
    return owners
  })
}

/** 无脚本布局的 JS 是原生资产，只能由当前合法父入口及实际发射的 stub 共同授权。 */
function collectOwnedScriptlessLayouts(ctx: NativeAssetOwnerContext, bundle: OutputBundle, logicalOwners: ReadonlySet<string>) {
  const { moduleGraphService, configService } = ctx
  if (!moduleGraphService || !configService) {
    return logicalOwners
  }
  return withRealpathScope(() => {
    const owners = new Set(logicalOwners)
    const { scriptExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
    for (const owner of owners) {
      for (const dependency of moduleGraphService.getEntryDependencies(owner)) {
        if (dependency.kind !== 'layout' || !dependency.sourceId.endsWith('.vue')) {
          continue
        }
        const sourceId = normalizeSourceId(dependency.sourceId)
        if (owners.has(sourceId)) {
          continue
        }
        const relativeBase = configService.relativeOutputPath(removeExtensionDeep(sourceId))
        if (relativeBase && bundle[`${relativeBase}.${scriptExtension}`]?.type === 'asset') {
          owners.add(sourceId)
        }
      }
    }
    return owners
  })
}

/** 在 core 裁剪 chunk 前按环境和 output 保存本代逻辑入口图。 */
export function captureNativeEntryAssetOwners(ctx: NativeAssetOwnerContext, environment: object | undefined, output: NativeAssetOutputScope, bundle: OutputBundle) {
  const environments = getEnvironmentGenerations(ctx)
  const scope = environment ?? ctx
  let outputs = environments.get(scope)
  if (!outputs) {
    outputs = new Map()
    environments.set(scope, outputs)
  }
  const key = outputScopeKey(output)
  outputs.delete(key)
  outputs.set(key, collectOwnedScriptlessLayouts(ctx, bundle, collectNativeEntryAssetOwners(bundle)))
}

/** Vue 消费同代所有权；未捕获、空图和已释放环境均不授权资产。 */
export function readNativeEntryAssetOwners(ctx: object, environment: object | undefined, output: NativeAssetOutputScope): ReadonlySet<string> {
  return generations.get(ctx)?.get(environment ?? ctx)?.get(outputScopeKey(output)) ?? noOwners
}
