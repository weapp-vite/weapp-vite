import { withMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'

await withMachineE2ELease(cleanupResidualDevProcesses)
