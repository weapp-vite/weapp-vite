import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

interface VueSfcSignatureNativeBinding {
  getVueSfcSignaturePayloadNative: (source: string) => string | undefined
}

let binding: VueSfcSignatureNativeBinding | false | undefined

function resolveNativeAstModulePath() {
  const modulePath = process.env.WEAPP_VITE_NATIVE_AST_PATH?.trim()
  return modulePath || undefined
}

export function shouldUseNativeVueSfcSignature() {
  return process.env.WEAPP_VITE_NATIVE === '1' && Boolean(resolveNativeAstModulePath())
}

export async function loadVueSfcSignatureNativeBinding() {
  if (!shouldUseNativeVueSfcSignature()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    binding = await import(resolveNativeAstModulePath()!) as VueSfcSignatureNativeBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}

export function loadVueSfcSignatureNativeBindingSync() {
  if (!shouldUseNativeVueSfcSignature()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    const modulePath = resolveNativeAstModulePath()!
    binding = require(modulePath) as VueSfcSignatureNativeBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}
