export {
  ensureWebRuntimeBlob,
  ensureWebRuntimeFile,
  ensureWebRuntimeFormData,
  ensureWebRuntimeHeaders,
  ensureWebRuntimeResponse,
  ensureWebRuntimeTextDecoder,
  ensureWebRuntimeTextDecoderStream,
  ensureWebRuntimeURL,
  ensureWebRuntimeURLSearchParams,
} from './ensureGlobals'
export {
  ensureWebRuntimeCrypto,
  ensureWebRuntimeGlobal,
  ensureWebRuntimePerformance,
} from './ensureLightweight'
export { markWebRuntimeGlobalInstalled, shouldInstallWebRuntimeGlobal } from './globalValue'
