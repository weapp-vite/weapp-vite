import type { MiniProgramEmissionSource, MiniProgramNode } from '@mpcore/test'
import { createMpcoreTest, createVitestProject, mpcoreTest } from '@mpcore/vitest'
import { mpcoreTest as configureMpcore } from '@mpcore/vitest/config'
import { expectError, expectType } from 'tsd'
import { expect, inject } from 'vitest'
import { defineConfig } from 'vitest/config'

expectType<string>(mpcoreTest().name)
expectType<string>(inject('mpcoreArtifact').projectPath)
expectType<Promise<void>>(createVitestProject().close())
defineConfig({
  plugins: [configureMpcore({ artifact: {
    build: async () => ({ projectPath: 'fixture' }),
    watch: async ({ onRebuilt, onError }) => {
      expectType<Promise<void>>(onRebuilt({ projectPath: 'fixture' }))
      expectType<void>(onError(new Error('build')))
      return { artifact: { projectPath: 'fixture' }, close: async () => {} }
    },
  } })],
})
expectError(configureMpcore({ artifact: { build: () => 'not-an-artifact' } }))
createMpcoreTest()('injected fixture type', async ({ mpcore }) => {
  expectType<Promise<void>>(mpcore.close())
})

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
expectType<Promise<void>>(expect(Promise.reject(node)).rejects.toEqual(node))
expectError(expect(Promise.reject(node)).rejects.toBeInTheMiniProgram())
expectError(expect('not-a-node').toBeInTheMiniProgram())
