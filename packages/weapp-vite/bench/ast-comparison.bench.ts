import type { File } from '@weapp-vite/ast/babelTypes'
import { generate, parse } from '@weapp-vite/ast/babel'
import babelTraverse from '@weapp-vite/ast/babelTraverse'
import { print } from 'esrap'
import ts from 'esrap/languages/ts'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import { bench, describe } from 'vitest'
import { createJsFixtureForOxc, defaultBenchOptions } from './utils'

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

  bench(
    'oxc parseSync',
    () => {
      parseSync('bench.ts', source)
    },
    defaultBenchOptions,
  )

  bench(
    'babel parse',
    () => {
      parseWithBabel(source)
    },
    defaultBenchOptions,
  )

  bench(
    'oxc parseSync + walk',
    () => {
      const parsed = parseSync('bench.ts', source)
      collectRequireTokensWithOxc(parsed.program)
    },
    defaultBenchOptions,
  )

  bench(
    'babel parse + traverse',
    () => {
      const parsed = parseWithBabel(source)
      collectRequireTokensWithBabel(parsed)
    },
    defaultBenchOptions,
  )

  bench(
    'oxc walk only',
    () => {
      collectRequireTokensWithOxc(oxcParsed)
    },
    defaultBenchOptions,
  )

  bench(
    'babel traverse only',
    () => {
      collectRequireTokensWithBabel(babelParsed)
    },
    defaultBenchOptions,
  )

  bench(
    'oxc parseSync + esrap print',
    () => {
      const parsed = parseSync('bench.ts', source)
      print(parsed.program, ts())
    },
    defaultBenchOptions,
  )

  bench(
    'babel parse + generator',
    () => {
      const parsed = parseWithBabel(source)
      generate(parsed, {})
    },
    defaultBenchOptions,
  )

  bench(
    'oxc parseSync + walk + esrap print',
    () => {
      const parsed = parseSync('bench.ts', source)
      collectRequireTokensWithOxc(parsed.program)
      print(parsed.program, ts())
    },
    defaultBenchOptions,
  )

  bench(
    'babel parse + traverse + generator',
    () => {
      const parsed = parseWithBabel(source)
      collectRequireTokensWithBabel(parsed)
      generate(parsed, {})
    },
    defaultBenchOptions,
  )

  bench(
    'esrap print only',
    () => {
      print(oxcParsed, ts())
    },
    defaultBenchOptions,
  )

  bench(
    'babel generator only',
    () => {
      generate(babelParsed, {})
    },
    defaultBenchOptions,
  )
})
