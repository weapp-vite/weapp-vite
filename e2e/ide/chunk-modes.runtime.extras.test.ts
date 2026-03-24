import { chunkExtraCases } from '../chunk-modes.matrix'
import { createChunkModesRuntimeSuite, withBaseRoutes } from './chunk-modes.runtime.shared'

createChunkModesRuntimeSuite(
  'e2e app: chunk-modes runtime extras matrix',
  withBaseRoutes(chunkExtraCases.slice(0, 2)),
)
