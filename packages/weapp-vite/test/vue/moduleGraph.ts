import { createModuleGraphService } from '../../src/moduleGraph'
import { createRuntimeState } from '../../src/runtime/runtimeState'

export function createTestModuleGraphService() {
  return createModuleGraphService()
}

export function createTestRuntimeState() {
  const runtimeState = createRuntimeState()
  runtimeState.scan.isDirty = false
  return runtimeState
}
