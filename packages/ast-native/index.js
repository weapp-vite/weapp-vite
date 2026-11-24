import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

const targetByRuntime = {
  'darwin:arm64': { id: 'darwin-arm64', packageName: '@weapp-vite/ast-native-darwin-arm64' },
  'darwin:x64': { id: 'darwin-x64', packageName: '@weapp-vite/ast-native-darwin-x64' },
  'linux:arm64': { id: 'linux-arm64-gnu', packageName: '@weapp-vite/ast-native-linux-arm64-gnu' },
  'linux:x64': { id: 'linux-x64-gnu', packageName: '@weapp-vite/ast-native-linux-x64-gnu' },
  'win32:arm64': { id: 'win32-arm64-msvc', packageName: '@weapp-vite/ast-native-win32-arm64-msvc' },
  'win32:x64': { id: 'win32-x64-msvc', packageName: '@weapp-vite/ast-native-win32-x64-msvc' },
}

if (process.platform === 'linux' && !process.report?.getReport?.().header?.glibcVersionRuntime) {
  throw new Error(`Unsupported @weapp-vite/ast-native platform: linux:${process.arch}:musl-or-unknown-libc`)
}

const target = targetByRuntime[`${process.platform}:${process.arch}`]

if (!target) {
  throw new Error(`Unsupported @weapp-vite/ast-native platform: ${process.platform}:${process.arch}`)
}

let binding
try {
  binding = require(target.packageName)
}
catch (error) {
  const detail = error instanceof Error ? `: ${error.message}` : ''
  throw new Error(`Unable to load @weapp-vite/ast-native native binding for ${target.id}. Install ${target.packageName} or disable native AST.${detail}`, { cause: error })
}

const {
  analyzeCompilerScriptsNative,
  analyzeNpmChunksNative,
  analyzeScriptNative,
  analyzeScriptsNative,
  collectFeatureFlagsNative,
  collectOnPageScrollDiagnosticsNative,
  getVueSfcSignaturePayloadNative: getVueSfcSignaturePayloadNativeBinding,
  mayContainPlatformApiAccessNative,
  mayContainStaticRequireLiteralNative,
} = binding

function getVueSfcSignaturePayloadNative(source) {
  return getVueSfcSignaturePayloadNativeBinding(source) ?? undefined
}

export {
  analyzeCompilerScriptsNative,
  analyzeNpmChunksNative,
  analyzeScriptNative,
  analyzeScriptsNative,
  collectFeatureFlagsNative,
  collectOnPageScrollDiagnosticsNative,
  getVueSfcSignaturePayloadNative,
  mayContainPlatformApiAccessNative,
  mayContainStaticRequireLiteralNative,
}
