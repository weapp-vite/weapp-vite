import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

interface NativeSfcBinding {
  getVueSfcSignaturePayloadNative?: (source: string) => string | undefined
}

let binding: NativeSfcBinding | false | undefined

function resolveNativeAstModulePath() {
  const modulePath = process.env.WEAPP_VITE_NATIVE_AST_PATH?.trim()
  return modulePath || undefined
}

export function shouldUseNativeSfc() {
  return process.env.WEAPP_VITE_NATIVE === '1' && Boolean(resolveNativeAstModulePath())
}

export function loadNativeSfcBindingSync() {
  if (!shouldUseNativeSfc()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    binding = require(resolveNativeAstModulePath()!) as NativeSfcBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}
