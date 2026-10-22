import type Connection from '../Connection'
import { vi } from 'vitest'
import { createCallerHarness } from './testHelpers'

export function createConnectionHarness() {
  const harness = createCallerHarness()
  const sessions = new Map<string, ReturnType<typeof harness.create>>()
  let sequence = 0
  let failure: string | undefined
  let failAfterDispatch = false
  let conversionFailure = false
  let conversionException = false
  const send = vi.fn(async (method: string, payload: any = {}) => {
    if (method === 'App.getCurrentPage') {
      return { pageId: 3 }
    }
    if (method !== 'App.CDPCommand') {
      throw new Error(`Unexpected native protocol ${method}`)
    }
    const { domain, method: command, params } = payload
    if (command === 'releaseObject') {
      if (failure === 'release') {
        throw new Error('release failed')
      }
      sessions.delete(params.objectId)
      return {}
    }
    if (command === 'evaluate') {
      const token = `owned-${++sequence}`
      sessions.set(token, harness.create())
      return { result: { type: 'object', objectId: token } }
    }
    if (domain === 'WxComponent' && command === 'resolveComponentCaller') {
      harness.emit()
      if (failure === 'resolve') {
        throw new Error('resolve response lost')
      }
      return { componentCaller: { objectId: 'other-context-token' } }
    }
    if (command !== 'callFunctionOn') {
      throw new Error(`Unexpected CDP command ${command}`)
    }
    const session = sessions.get(params.objectId)
    if (!session) {
      if (conversionFailure) {
        throw new Error('return serialization failed')
      }
      if (conversionException) {
        return { result: { type: 'object' }, exceptionDetails: { text: 'Uncaught String conversion failed' } }
      }
      return { result: { type: 'string', value: '[object Object]' } }
    }
    let value: any
    try {
      const declaration: string = params.functionDeclaration
      if (declaration.includes('this.backend')) {
        value = session.backend
      }
      else if (declaration.includes('this.arm()')) {
        value = session.arm()
        if (failure === 'arm') {
          throw new Error('arm response lost')
        }
      }
      else if (declaration.includes('this.disarm()')) {
        value = session.disarm()
        if (failure === 'disarm') {
          throw new Error('disarm response lost')
        }
      }
      else if (declaration.includes('this.dispose()')) {
        if (failure === 'dispose') {
          throw new Error('dispose failed')
        }
        value = session.dispose()
      }
      else {
        const argumentsText = declaration.match(/this\.invoke\((.*)\) \}/)?.[1]
        if (!argumentsText) {
          throw new Error('Unexpected wrapper invocation')
        }
        const [name, args] = JSON.parse(`[${argumentsText}]`)
        value = session.invoke(name, args)
        if (failAfterDispatch) {
          throw new Error('invoke response lost')
        }
      }
    }
    catch (error) {
      return { exceptionDetails: { text: `Uncaught ${(error as Error).message}` }, result: { type: 'object' } }
    }
    if (value === undefined) {
      return { result: { type: 'undefined' } }
    }
    if (value === null) {
      return { result: { type: 'object', subtype: 'null', value: null } }
    }
    try {
      return { result: { type: typeof value, value: JSON.parse(JSON.stringify(value)) } }
    }
    catch {
      return { result: { type: typeof value, objectId: 'return-token', description: 'Object' } }
    }
  })
  const connection = { send, prefersComponentCallerBridge: true } as unknown as Connection
  return {
    ...harness,
    connection,
    send,
    fail: (stage: string | undefined) => { failure = stage },
    loseInvocationResponse: () => { failAfterDispatch = true },
    failConversion: () => { conversionFailure = true },
    throwDuringConversion: () => { conversionException = true },
  }
}
