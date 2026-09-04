import type { File } from '@weapp-vite/ast/babelTypes'
import { generate, parse } from '@weapp-vite/ast/babel'
import babelTraverse from '@weapp-vite/ast/babelTraverse'
import { print } from 'esrap'
import ts from 'esrap/languages/ts'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import { describe } from 'vitest'
import { createJsFixtureForOxc, defaultBenchOptions, defineBenchmark } from './utils'

interface RequireToken {
  start: number
  end: number
  value: string
  async?: boolean
}

function collectRequireTokensWithOxc(ast: unknown) {
  const requireTokens: RequireToken[] = []

  walk(ast as Parameters<typeof walk>[0], {
    enter(node) {
      if (
        node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && node.callee.object.name === 'require'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'async'
      ) {
        const argv0 = node.arguments[0]
        if (argv0 && argv0.type === 'Literal' && typeof argv0.value === 'string') {
          requireTokens.push({
            start: argv0.start,
            end: argv0.end,
            value: argv0.value,
            async: true,
          })
        }
      }
    },
  })

  return requireTokens
}

function collectRequireTokensWithBabel(ast: File) {
  const requireTokens: RequireToken[] = []

  babelTraverse(ast, {
    CallExpression(path) {
      const { node } = path
      if (
        node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && node.callee.object.name === 'require'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'async'
      ) {
        const argv0 = node.arguments[0]
        if (argv0?.type === 'StringLiteral') {
          requireTokens.push({
            start: argv0.start ?? 0,
            end: argv0.end ?? 0,
            value: argv0.value,
            async: true,
          })
        }
      }
    },
  })

  return requireTokens
}

function parseWithBabel(source: string) {
  return parse(source, {
    sourceType: 'module',
    plugins: ['typescript'],
  }) as File
}

describe('ast comparison: oxc stack vs babel stack', () => {
  const source = createJsFixtureForOxc({ asyncRequireCount: 1_000 })
  const oxcParsed = parseSync('bench.ts', source).program
  const babelParsed = parseWithBabel(source)

  defineBenchmark(
    'oxc parseSync',
    () => {
      parseSync('bench.ts', source)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel parse',
    () => {
      parseWithBabel(source)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'oxc parseSync + walk',
    () => {
      const parsed = parseSync('bench.ts', source)
      collectRequireTokensWithOxc(parsed.program)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel parse + traverse',
    () => {
      const parsed = parseWithBabel(source)
      collectRequireTokensWithBabel(parsed)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'oxc walk only',
    () => {
      collectRequireTokensWithOxc(oxcParsed)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel traverse only',
    () => {
      collectRequireTokensWithBabel(babelParsed)
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'oxc parseSync + esrap print',
    () => {
      const parsed = parseSync('bench.ts', source)
      print(parsed.program, ts())
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel parse + generator',
    () => {
      const parsed = parseWithBabel(source)
      generate(parsed, {})
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'oxc parseSync + walk + esrap print',
    () => {
      const parsed = parseSync('bench.ts', source)
      collectRequireTokensWithOxc(parsed.program)
      print(parsed.program, ts())
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel parse + traverse + generator',
    () => {
      const parsed = parseWithBabel(source)
      collectRequireTokensWithBabel(parsed)
      generate(parsed, {})
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'esrap print only',
    () => {
      print(oxcParsed, ts())
    },
    defaultBenchOptions,
  )

  defineBenchmark(
    'babel generator only',
    () => {
      generate(babelParsed, {})
    },
    defaultBenchOptions,
  )
})
