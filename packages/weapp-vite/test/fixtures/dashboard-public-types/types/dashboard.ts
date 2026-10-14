import type { AnalyzeDashboardDevframeController, CreateAnalyzeDashboardDevframeOptions, DashboardDevframeState } from 'weapp-vite/dashboard'
import { createAnalyzeDashboardDevframe, createDashboardArtifactSnapshot } from 'weapp-vite/dashboard'

const create: (options: CreateAnalyzeDashboardDevframeOptions) => AnalyzeDashboardDevframeController = createAnalyzeDashboardDevframe
function publicContract(options: CreateAnalyzeDashboardDevframeOptions, state: DashboardDevframeState) {
  const controller = create(options)
  const artifacts = createDashboardArtifactSnapshot()
  return { definition: controller.definition, dispose: controller.dispose, update: controller.update, state, artifacts }
}
void publicContract
