import { chunkMatrixCases, selectIdeRuntimeChunkMatrixCases } from '../chunk-modes.matrix'
import { createChunkModesRuntimeSuite, withIdeSmokeRoutes } from './chunk-modes.runtime.shared'

const duplicateCases = selectIdeRuntimeChunkMatrixCases(chunkMatrixCases)
  .filter(item => item.strategy === 'duplicate')

createChunkModesRuntimeSuite(
  'e2e app: chunk-modes runtime duplicate matrix',
  withIdeSmokeRoutes(duplicateCases),
)
