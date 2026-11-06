import type { OutputBundle } from 'rolldown'
import type { LogicalEntryType } from '../../src/moduleGraph/protocol'
import { createModuleGraphService } from '../../src/moduleGraph'
import { createLogicalEntryId } from '../../src/moduleGraph/protocol'
import { captureNativeEntryAssetOwners } from '../../src/plugins/utils/nativeEntryAssetOwners'
import { createRuntimeState } from '../../src/runtime/runtimeState'

export function createTestModuleGraphService() {
  return createModuleGraphService()
}

export function createTestRuntimeState() {
  const runtimeState = createRuntimeState()
  runtimeState.scan.isDirty = false
  return runtimeState
}

/** 独立 Vue hook fixture 显式声明本代逻辑入口，模拟 core 裁剪前捕获的资产归属。 */
export function captureTestNativeEntryAssetOwners(
  ctx: object,
  entries: ReadonlyArray<readonly [sourceId: string, type: LogicalEntryType]>,
) {
  const bundle = Object.fromEntries(entries.map(([sourceId, type], index) => [`entry-${index}.js`, {
    type: 'chunk',
    facadeModuleId: createLogicalEntryId(sourceId, type),
    moduleIds: [],
  }])) as OutputBundle
  captureNativeEntryAssetOwners(ctx, undefined, {}, bundle)
}
