import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

interface NativeAstBinding {
  getVueSfcSignaturePayloadNative?: (source: string) => string | undefined
}

let binding: NativeAstBinding | false | undefined

function resolveNativeAstModulePath() {
  const modulePath = process.env.WEAPP_VITE_NATIVE_AST_PATH?.trim()
  return modulePath || undefined
}

export function shouldUseNativeAst() {
  return process.env.WEAPP_VITE_NATIVE === '1' && Boolean(resolveNativeAstModulePath())
}

export function loadNativeAstBindingSync() {
  if (!shouldUseNativeAst()) {
    return undefined
  }
  if (binding !== undefined) {
    return binding || undefined
  }

  try {
    binding = require(resolveNativeAstModulePath()!) as NativeAstBinding
  }
  catch {
    binding = false
  }

  return binding || undefined
}
