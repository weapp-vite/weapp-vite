import type { MiniProgramNode } from '@mpcore/test'
import { mpcoreMatchers } from '@mpcore/test'
import { expectError, expectType } from 'tsd'

declare const node: MiniProgramNode

expectType<boolean>(mpcoreMatchers.toHaveTextContent(node).pass)
expectType<boolean>(mpcoreMatchers.toHaveTextContent(node, 2).pass)
expectType<boolean>(mpcoreMatchers.toHaveTextContent(node, /count/u, { normalizeWhitespace: true }).pass)
expectType<boolean>(mpcoreMatchers.toHaveAttribute(node, 'data-count', 2).pass)
expectError(mpcoreMatchers.toHaveTextContent(node, {}))
