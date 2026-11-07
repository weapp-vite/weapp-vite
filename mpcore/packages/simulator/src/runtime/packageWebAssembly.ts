import { createPackageAssetReader } from './packageAsset'

/** 使用宿主真实 WASM 引擎执行代码包路径，不向小程序暴露宿主文件系统。 */
export function createPackageWebAssembly(readBinary: (filePath: string) => ArrayBuffer | undefined) {
  const native = globalThis.WebAssembly
  const read = createPackageAssetReader(readBinary)
  return {
    Module: native.Module,
    Instance: native.Instance,
    Memory: native.Memory,
    Table: native.Table,
    Global: native.Global,
    CompileError: native.CompileError,
    LinkError: native.LinkError,
    RuntimeError: native.RuntimeError,
    compile: native.compile.bind(native),
    validate: native.validate.bind(native),
    async instantiate(source: string | BufferSource | WebAssembly.Module, imports?: WebAssembly.Imports) {
      if (typeof source !== 'string') {
        return native.instantiate(source, imports)
      }
      const binary = read(source)
      if (!binary) {
        throw new Error(`WXWebAssembly.instantiate:fail package file not found: ${source}`)
      }
      return native.instantiate(binary, imports)
    },
  }
}
