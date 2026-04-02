import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it, vi } from 'vitest'
import { generate, parseJsLike } from '../../../../../utils/babel'
import {
  applyWevuDefaultsToComponentOptions,
  applyWevuDefaultsToOptionsObject,
  ensureNestedOptionValue,
  injectWevuDefaultsForApp,
  insertWevuDefaultsCall,
  serializeWevuDefaults,
  stripVirtualHostFromDefaults,
} from './defaults'

function parseFirstObjectExpression(source: string) {
  const ast = parseJsLike(source)
  const stmt = ast.program.body.find(node => t.isVariableDeclaration(node)) as t.VariableDeclaration | undefined
  const decl = stmt?.declarations?.[0]
  if (!decl || !t.isObjectExpression(decl.init)) {
    throw new Error('failed to parse object expression fixture')
  }
  return { ast, object: decl.init }
}

describe('transformScript rewrite defaults', () => {
  it('applies defaults to options object and keeps existing keys', () => {
    const { object } = parseFirstObjectExpression(`
const opts = {
  existing: true,
  options: {
    preserve: 1,
  },
}
    `.trim())

    const changed = applyWevuDefaultsToOptionsObject(object, {
      existing: false,
      injected: 'ok',
      options: {
        preserve: 2,
        virtualHost: true,
      },
      setData: {
        immediate: true,
      },
    })

    expect(changed).toBe(true)
    const code = generate(object).code
    expect(code).toContain('existing: true')
    expect(code).toContain('injected: "ok"')
    expect(code).toContain('virtualHost: true')
    expect(code).toContain('setData')
  })

  it('ensures nested option value for missing/existing/wrapped paths', () => {
    const missing = parseFirstObjectExpression(`const opts = {}`).object
    expect(ensureNestedOptionValue(missing, 'options', 'virtualHost', false)).toBe(true)
    expect(generate(missing).code).toContain('virtualHost: false')

    const existingObject = parseFirstObjectExpression(`const opts = { options: { a: 1 } }`).object
    expect(ensureNestedOptionValue(existingObject, 'options', 'virtualHost', true)).toBe(true)
    expect(generate(existingObject).code).toContain('virtualHost: true')

    const existingRef = parseFirstObjectExpression(`const opts = { options: sharedOptions }`).object
    expect(ensureNestedOptionValue(existingRef, 'options', 'virtualHost', false)).toBe(true)
    expect(generate(existingRef).code).toContain('...sharedOptions')
  })

  it('strips virtualHost from component defaults', () => {
    expect(stripVirtualHostFromDefaults({
      options: {
        virtualHost: true,
        styleIsolation: 'apply-shared',
      },
    })).toEqual({
      options: {
        styleIsolation: 'apply-shared',
      },
    })

    expect(stripVirtualHostFromDefaults({
      options: {
        virtualHost: true,
      },
    })).toEqual({})
  })

  it('serializes defaults and warns on invalid input', () => {
    const warn = vi.fn()
    const serialized = serializeWevuDefaults({
      app: {
        name: 'demo',
      },
    }, warn)
    expect(serialized).toContain('"name":"demo"')
    expect(warn).not.toHaveBeenCalled()

    const circular: any = { app: {} }
    circular.self = circular
    expect(serializeWevuDefaults(circular, warn)).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('inserts app defaults runtime call after imports', () => {
    const ast = parseJsLike(`
import { createApp } from 'wevu'
const setup = () => {}
    `.trim())

    insertWevuDefaultsCall(ast.program, JSON.stringify({
      app: {
        tabBar: {
          color: '#000000',
        },
      },
    }))

    const code = generate(ast).code
    expect(code).toContain('setWevuDefaults')
    expect(code).toContain('tabBar')
  })

  it('applies component/page defaults and injects app runtime bootstrap', () => {
    const componentExpr = parseFirstObjectExpression(`
const opts = {
  setup() {},
}
    `.trim()).object

    expect(applyWevuDefaultsToComponentOptions({
      componentExpr,
      parsedWevuDefaults: {
        component: {
          options: {
            virtualHost: true,
          },
          multipleSlots: true,
        },
      },
      options: {
        isPage: true,
      },
    })).toBe(true)

    const componentCode = generate(componentExpr).code
    expect(componentCode).toContain('multipleSlots: true')
    expect(componentCode).toContain('virtualHost: false')

    const ast = parseJsLike(`const appOptions = {}`)
    expect(injectWevuDefaultsForApp({
      astProgram: ast.program,
      options: { isApp: true },
      serializedWevuDefaults: JSON.stringify({ app: { debug: true } }),
    })).toBe(true)
    expect(generate(ast).code).toContain('setWevuDefaults')
  })
})
