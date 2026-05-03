import { chunkMatrixCases, selectIdeRuntimeChunkMatrixCases } from '../chunk-modes.matrix'
import { createChunkModesRuntimeSuite, withIdeSmokeRoutes } from './chunk-modes.runtime.shared'

const hoistCases = selectIdeRuntimeChunkMatrixCases(chunkMatrixCases)
  .filter(item => item.strategy === 'hoist')

createChunkModesRuntimeSuite(
  'e2e app: chunk-modes runtime hoist matrix',
  withIdeSmokeRoutes(hoistCases),
)
