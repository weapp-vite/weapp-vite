import type { MiniProgramEmissionSource, MiniProgramNode } from '@mpcore/test'
import { createMpcoreTest, mpcoreTest } from '@mpcore/vitest'
import { expectError, expectType } from 'tsd'
import { expect } from 'vitest'

expectType<string>(mpcoreTest().name)

const test = createMpcoreTest({
  artifact: { projectPath: '/project' },
})

test('fixture type', async ({ mpcore }) => {
  expectType<Promise<void>>(mpcore.close())
})

declare const emission: MiniProgramEmissionSource
declare const node: MiniProgramNode

expectType<void>(expect(node).toBeInTheMiniProgram())
expectType<void>(expect(node).toHaveAttribute('data-kind', 'counter'))
expectType<void>(expect(node).toHaveDataset({ kind: 'counter' }))
expectType<void>(expect(node).toHaveTextContent(/count/u))
expectType<void>(expect(emission).toHaveEmitted('change', { value: 1 }))
expectType<Promise<void>>(expect(Promise.resolve(node)).resolves.toBeInTheMiniProgram())
expectType<Promise<void>>(expect(Promise.reject<MiniProgramNode>(node)).rejects.toBeInTheMiniProgram())
expectError(expect('not-a-node').toBeInTheMiniProgram())
