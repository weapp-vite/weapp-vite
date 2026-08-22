import { workerSharedMarker } from './worker-shared'

globalThis.postMessage(workerSharedMarker)
void import('./worker-dynamic')
