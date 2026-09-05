import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractComponentPropsFromDts, extractInlinePropsTypeFromCode } from './dtsProps'
import { normalizePortableComponentPropType } from './portablePropType'

const propertyTypes = {
  identity: '<T>(value: T) => T',
  flags: '{ [K in "a" | "b" as K]: boolean }',
  values: '{ [K in "a" | "b"]: K }',
  boxed: '<T>(value: T) => Box<T>',
  inferred: '<T>(value: T) => T extends (infer U)[] ? U : U',
  constrained: '<T extends { id: string }>(value: T) => T',
  callable: '{ <T>(value: T): T; nested: { method<T>(value: T): T } }',
  constructor: 'new <T>(value: T) => { value: T }',
  nested: '<T>(value: T) => <T>(value: T) => T',
  free: 'MissingType',
}

const imports = 'import type { Box, T, K, U } from "portable-types"'

describe('portable prop lexical bindings', () => {
  it.each(['inline', 'declaration'] as const)('keeps bound parameters and rejects invalid consumers after %s extraction', (kind) => {
    const properties = Object.entries(propertyTypes)
      .map(([name, type]) => kind === 'inline' ? `${name}?: ${type}` : `${name}: { value: ${type} }`)
      .join('\n')
    const extracted = kind === 'inline'
      ? extractInlinePropsTypeFromCode(`${imports}\ndefineProps<{ ${properties} }>()`)
      : extractComponentPropsFromDts(`${imports}\ninterface NativeComponent { properties: { ${properties} } }`)
    const props = [...extracted].map(([name, type]) => `${name}: ${normalizePortableComponentPropType(type)}`).join('\n')
    const source = [
      'declare module "portable-types" {',
      '  export type Box<T> = { value: T }',
      '  export type T = { imported: true }',
      '  export type K = "imported"',
      '  export type U = Date',
      '}',
      `declare const props: { ${props} }`,
      'const identity: "ok" = props.identity("ok" as const)',
      'const flags: { a: boolean; b: boolean } = props.flags',
      'const values: { a: "a"; b: "b" } = props.values',
      'const boxed: { value: "ok" } = props.boxed("ok" as const)',
      'const inferred: number = props.inferred([1])',
      'const outsideInfer: Date = props.inferred(1)',
      'const constrained: { id: string; extra: number } = props.constrained({ id: "a", extra: 1 })',
      'const called: "ok" = props.callable("ok" as const)',
      'const method: 1 = props.callable.nested.method(1 as const)',
      'const constructed: { value: 1 } = new props.constructor(1 as const)',
      'const nested: "inner" = props.nested(1)("inner" as const)',
      '// @ts-expect-error 映射键不能漂移或扩大。',
      'props.flags.c',
      '// @ts-expect-error 映射值必须与键关联。',
      'const wrongValue: "b" = props.values.a',
      '// @ts-expect-error 泛型约束必须保留。',
      'props.constrained({ id: 1 })',
      '// @ts-expect-error 真正自由的类型引用只能是 unknown。',
      'const free: string = props.free',
    ].join('\n')
    const fileName = path.resolve(__dirname, 'portable-consumer.ts')
    const options: ts.CompilerOptions = {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      target: ts.ScriptTarget.ESNext,
      types: [],
    }
    const host = ts.createCompilerHost(options)
    const getSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => name === fileName
      ? ts.createSourceFile(name, source, languageVersion)
      : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
    const program = ts.createProgram([fileName], options, host)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  })
})
