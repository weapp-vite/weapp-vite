import type * as ts from 'typescript'

export function serializeCompilerOptions(tsInstance: typeof ts, options: ts.CompilerOptions) {
  const serialized: Record<string, unknown> = { ...options }
  const protocol = tsInstance.server.protocol
  const enumOptions: Record<string, [Record<string, string | number>, Record<string, string>]> = {
    jsx: [tsInstance.JsxEmit, protocol.JsxEmit],
    module: [tsInstance.ModuleKind, protocol.ModuleKind],
    moduleResolution: [tsInstance.ModuleResolutionKind, protocol.ModuleResolutionKind],
    target: [tsInstance.ScriptTarget, protocol.ScriptTarget],
  }

  // 使用公开协议枚举的拼写，避免 JSX 短横线及 Latest 等别名在反向映射中丢失。
  for (const [name, [numericEnum, jsonEnum]] of Object.entries(enumOptions)) {
    const value = options[name]
    if (typeof value === 'number') {
      const member = Object.keys(jsonEnum).find(key => numericEnum[key] === value)
      if (member !== undefined) {
        serialized[name] = jsonEnum[member]
      }
    }
  }

  if (options.newLine === tsInstance.NewLineKind.CarriageReturnLineFeed) {
    serialized.newLine = protocol.NewLineKind.Crlf.toLowerCase()
  }
  else if (options.newLine === tsInstance.NewLineKind.LineFeed) {
    serialized.newLine = protocol.NewLineKind.Lf.toLowerCase()
  }
  for (const [name, numericEnum] of Object.entries({
    moduleDetection: tsInstance.ModuleDetectionKind,
    importsNotUsedAsValues: tsInstance.ImportsNotUsedAsValues,
  })) {
    const value = options[name]
    if (typeof value === 'number' && typeof numericEnum[value] === 'string') {
      serialized[name] = numericEnum[value].toLowerCase()
    }
  }
  if (options.lib) {
    serialized.lib = options.lib.map(lib => lib.replace(/^lib\.(.+)\.d\.ts$/i, '$1'))
  }
  return serialized
}
