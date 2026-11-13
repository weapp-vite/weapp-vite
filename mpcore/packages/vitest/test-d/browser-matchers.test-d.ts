import type { MiniProgramNode } from '@mpcore/test'
import { expectType } from 'tsd'
import { expect } from 'vitest'
import '@mpcore/vitest'
import '@vitest/browser/matchers'

declare const node: MiniProgramNode
declare const element: HTMLElement

expectType<void>(expect(node).toHaveAttribute('data-kind', 'counter'))
expectType<void>(expect(node).toHaveTextContent(/count/u))
expectType<Promise<void>>(expect(Promise.resolve(node)).resolves.toHaveTextContent(/count/u))
expectType<void>(expect(element).toHaveAttribute('data-count', 2))
expectType<void>(expect(element).toHaveTextContent(2, { normalizeWhitespace: true }))
expectType<Promise<void>>(expect.element(element).toHaveAttribute('data-count', 2))
expectType<Promise<void>>(expect.element(element).toHaveTextContent())
