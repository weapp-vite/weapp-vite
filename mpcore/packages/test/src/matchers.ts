import type { MiniProgramNode } from './screen'
import type { MiniProgramEmissionSource, MiniProgramMatcherResult } from './types'

export function toBeInTheMiniProgram(node: MiniProgramNode): MiniProgramMatcherResult {
  const pass = node?.isConnected === true
  return {
    message: () => pass
      ? 'Expected node not to be present in the mini-program tree.'
      : 'Expected node to be present in the mini-program tree.',
    pass,
  }
}

export function toHaveTextContent(node: MiniProgramNode, expected?: string | number | RegExp, options?: { normalizeWhitespace: boolean }): MiniProgramMatcherResult {
  const actual = options?.normalizeWhitespace ? node.textContent.replace(/\s+/gu, ' ').trim() : node.textContent
  if (expected instanceof RegExp) {
    expected.lastIndex = 0
  }
  const pass = expected === undefined
    ? actual.length > 0
    : expected instanceof RegExp ? expected.test(actual) : actual.includes(String(expected))
  return {
    message: () => `Expected mini-program node text ${JSON.stringify(actual)} to match ${String(expected)}.`,
    pass,
  }
}

export function toHaveEmitted(
  source: MiniProgramEmissionSource,
  eventName: string,
  expected?: unknown,
): MiniProgramMatcherResult {
  const emissions = source.emitted(eventName)
  const pass = expected === undefined
    ? emissions.length > 0
    : emissions.some(value => JSON.stringify(value) === JSON.stringify(expected))
  return {
    message: () => `Expected mini-program event ${eventName} to be emitted${expected === undefined ? '' : ` with ${JSON.stringify(expected)}`}, received ${JSON.stringify(emissions)}.`,
    pass,
  }
}

export function toHaveAttribute(node: MiniProgramNode, name: string, expected?: unknown): MiniProgramMatcherResult {
  const actual = node.getAttribute(name)
  const pass = expected === undefined ? actual !== undefined : actual === expected
  return {
    message: () => `Expected mini-program node attribute ${name} to be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    pass,
  }
}

export function toHaveDataset(node: MiniProgramNode, expected: Record<string, unknown>): MiniProgramMatcherResult {
  const actual = node.dataset
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  return {
    message: () => `Expected mini-program node dataset ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}.`,
    pass,
  }
}

export const mpcoreMatchers = {
  toBeInTheMiniProgram,
  toHaveAttribute,
  toHaveDataset,
  toHaveEmitted,
  toHaveTextContent,
}
