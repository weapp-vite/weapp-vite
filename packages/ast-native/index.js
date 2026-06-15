import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)

const bindingByPlatform = {
  'darwin:arm64': './weapp_vite_ast_native.darwin-arm64.node',
  'darwin:x64': './weapp_vite_ast_native.darwin-x64.node',
  'linux:arm64': './weapp_vite_ast_native.linux-arm64-gnu.node',
  'linux:x64': './weapp_vite_ast_native.linux-x64-gnu.node',
  'win32:arm64': './weapp_vite_ast_native.win32-arm64-msvc.node',
  'win32:x64': './weapp_vite_ast_native.win32-x64-msvc.node',
}

const bindingPath = bindingByPlatform[`${process.platform}:${process.arch}`]

if (!bindingPath) {
  throw new Error(`Unsupported @weapp-vite/ast-native platform: ${process.platform}:${process.arch}`)
}

const {
  collectOnPageScrollDiagnosticsNative,
} = require(bindingPath)

export {
  collectOnPageScrollDiagnosticsNative,
}
