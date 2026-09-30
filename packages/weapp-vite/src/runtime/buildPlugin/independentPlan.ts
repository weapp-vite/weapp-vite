import type { CompilerContext } from '../../context'

/** 先完成独立目标的内存构建，再由主发布阶段统一处理成功或失败。 */
export async function prepareIndependentOutputs(ctx: CompilerContext) {
  const { scanService, configService, buildService } = ctx
  const independentState = ctx.runtimeState.build.independent
  independentState.pendingOutputs = []
  scanService.loadSubPackages()
  const previousSubPackageRoot = configService.currentSubPackageRoot
  for (const root of scanService.drainIndependentDirtyRoots()) {
    const meta = scanService.independentSubPackageMap.get(root)
    if (!meta) {
      continue
    }
    // 保持串行，避免第三方插件的进程级状态在子构建间竞争。
    const task = buildService.buildIndependentBundle(root, meta)
    independentState.pendingOutputs.push(task)
    await task.catch(() => {})
  }
  if (configService.currentSubPackageRoot !== previousSubPackageRoot) {
    configService.options = { ...configService.options, currentSubPackageRoot: previousSubPackageRoot }
  }
}
