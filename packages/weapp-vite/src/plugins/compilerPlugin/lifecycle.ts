import type {
  WeappCompilerPlugin,
  WeappCompilerPluginContext,
  WeappCompilerPluginController,
  WeappCompilerPluginFactory,
  WeappCompilerPluginOption,
} from '../../types/compilerPlugin'

export interface ControllerRecord {
  provider: WeappCompilerPlugin
  controller: WeappCompilerPluginController
}

export type ControllerCleanupMethod = 'closeBundle' | 'closeWatcher' | 'dispose'

/** 单个失败保持原异常身份，多个失败完整保留供上层诊断。 */
export function throwControllerErrors(errors: unknown[], message: string): void {
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, message)
  }
}

/** 清理只接管已成功返回的 controller，每项独立完成后再报告全部失败。 */
export async function collectControllerCleanupErrors(records: ControllerRecord[], method: ControllerCleanupMethod): Promise<unknown[]> {
  const results = await Promise.allSettled(records.map(async ({ controller }) => {
    await controller[method]?.()
  }))
  return results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
}

/** 初始化失败仍等待其余工厂收敛，只释放本轮已返回的 controller。 */
export async function initializeCompilerControllers(options: WeappCompilerPluginOption[], context: WeappCompilerPluginContext): Promise<ControllerRecord[]> {
  const results = await Promise.allSettled(options.map(async (option) => {
    const provider = await (typeof option === 'function' ? (option as WeappCompilerPluginFactory)(context) : option)
    const controller = await provider.create(context)
    return { provider, controller }
  }))
  const records = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  const names = new Set<string>()
  for (const { provider } of records) {
    if (names.has(provider.name)) {
      errors.push(new Error(`编译插件名称重复：\`${provider.name}\`。请为每个 compiler provider 使用唯一名称。`))
    }
    names.add(provider.name)
  }
  if (errors.length) {
    errors.push(...await collectControllerCleanupErrors(records, 'dispose'))
    throwControllerErrors(errors, 'Compiler provider initialization and cleanup failed')
  }
  return records
}
