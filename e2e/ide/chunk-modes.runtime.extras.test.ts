import { chunkExtraCases, selectIdeRuntimeChunkExtraCases } from '../chunk-modes.matrix'
import { createChunkModesRuntimeSuite, withIdeSmokeRoutes } from './chunk-modes.runtime.shared'

createChunkModesRuntimeSuite(
  'e2e app: chunk-modes runtime extras matrix',
  withIdeSmokeRoutes(selectIdeRuntimeChunkExtraCases(chunkExtraCases)),
)
