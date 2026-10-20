import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { serializeCompilerOptions } from './compilerOptions'

describe('lib dts compiler options JSON', () => {
  it('round-trips API compiler options through the real JSON parser', () => {
    const options: ts.CompilerOptions = {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.Latest,
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      moduleDetection: ts.ModuleDetectionKind.Force,
      lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
      strict: true,
      declaration: true,
      maxNodeModuleJsDepth: 2,
      types: [],
      paths: { '#components/*': ['./components/*'] },
    }
    const serialized = serializeCompilerOptions(ts, options)
    const parsed = ts.convertCompilerOptionsFromJson(serialized, '.')

    expect(parsed.errors).toEqual([])
    expect(parsed.options).toEqual(options)
    expect(serialized).toMatchObject({
      jsx: 'react-jsx',
      module: 'nodenext',
      moduleResolution: 'nodenext',
      target: 'esnext',
      newLine: 'crlf',
      moduleDetection: 'force',
      lib: ['esnext', 'dom'],
      maxNodeModuleJsDepth: 2,
    })
    expect(options.lib).toEqual(['lib.esnext.d.ts', 'lib.dom.d.ts'])
  })

  it.each([
    ts.JsxEmit.Preserve,
    ts.JsxEmit.React,
    ts.JsxEmit.ReactNative,
    ts.JsxEmit.ReactJSX,
    ts.JsxEmit.ReactJSXDev,
  ])('preserves JSX API value %s after JSON parsing', (jsx) => {
    const parsed = ts.convertCompilerOptionsFromJson(serializeCompilerOptions(ts, { jsx }), '.')
    expect(parsed.errors).toEqual([])
    expect(parsed.options.jsx).toBe(jsx)
  })

  it('retains JSON-shaped values and deprecated API option intent', () => {
    const serialized = serializeCompilerOptions(ts, {
      target: 'ES2022',
      lib: ['DOM', 'ESNext'],
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Preserve,
      newLine: ts.NewLineKind.LineFeed,
    } as ts.CompilerOptions)
    expect(serialized).toEqual({
      target: 'ES2022',
      lib: ['DOM', 'ESNext'],
      importsNotUsedAsValues: 'preserve',
      newLine: 'lf',
    })
  })

  it('preserves invalid numeric options so TypeScript reports the original problem', () => {
    const serialized = serializeCompilerOptions(ts, { jsx: 999 as ts.JsxEmit })
    const parsed = ts.convertCompilerOptionsFromJson(serialized, '.')

    expect(serialized.jsx).toBe(999)
    expect(parsed.errors).toEqual([expect.objectContaining({ code: 5024 })])
  })
})
