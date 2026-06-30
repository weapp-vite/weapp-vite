import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

interface VueSfcSignatureNativeBinding {
  getVueSfcSignaturePayloadNative: (source: string) => string | undefined
}

let binding: VueSfcSignatureNativeBinding | false | undefined

export function shouldUseNativeVueSfcSignature() {
  return process.env.WEAPP_VITE_NATIVE === '1'
}

export async function loadVueSfcSignatureNativeBinding() {
  if (!shouldUseNativeVueSfcSignature()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    binding = await import('@weapp-vite/ast-native') as VueSfcSignatureNativeBinding
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
    const modulePath = '@weapp-vite/ast-native'
    binding = require(modulePath) as VueSfcSignatureNativeBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}
