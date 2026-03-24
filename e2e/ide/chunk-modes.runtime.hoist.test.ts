import { chunkMatrixCases } from '../chunk-modes.matrix'
import { createChunkModesRuntimeSuite, withBaseRoutes } from './chunk-modes.runtime.shared'

const hoistCases = chunkMatrixCases.filter(item => item.strategy === 'hoist')

createChunkModesRuntimeSuite(
  'e2e app: chunk-modes runtime hoist matrix',
  withBaseRoutes(hoistCases),
)
