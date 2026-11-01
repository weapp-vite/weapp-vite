import type { Plugin } from 'vite'
import assert from 'node:assert/strict'
import { build } from 'vite'
import { createOwnedPluginGeneration, markOwnedPlugin } from '../../src/plugins/ownedInstances'
import { createPackageImportsQueryPlugin } from '../../src/plugins/packageImports'
import { chunk, fixture, imported } from './support'

export async function hooks() {
  const observations: string[] = []
  await fixture({ 'entry.js': 'export const value = 41' }, async (root) => {
    const source = markOwnedPlugin({
      name: 'product:owned-hook',
      transform: {
        order: 'pre' as const,
        filter: { id: /entry\.js$/ },
        handler(code: string) {
          assert.equal(this.environment.name, 'client')
          observations.push('pre')
          return code.replace('41', '42')
        },
      },
    } satisfies Plugin)
    for (let generation = 0; generation < 2; generation++) {
      const output = await build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [createOwnedPluginGeneration()(source), {
          name: 'product:third-party-hook',
          transform(code, id) {
            if (id.endsWith('/entry.js')) {
              assert.ok(code.includes('42'))
              observations.push('normal')
            }
          },
        }],
        build: { write: false, minify: false, rolldownOptions: { input: 'entry.js', preserveEntrySignatures: 'strict' } },
      })
      assert.equal((await imported(chunk(output).code)).value, 42)
    }
  })
  assert.deepEqual(observations, ['pre', 'normal', 'pre', 'normal'])
  return { generations: 2, order: observations, runtimeValue: 42 }
}

export async function resolver() {
  await fixture({
    'package.json': JSON.stringify({ type: 'module', imports: { '#answer?literal': './answer.js', '#part/*': './parts/*.js', '#condition': { product: './answer.js', default: './wrong.js' }, '#blocked': './answer.js', '#blocked?query': { absent: './answer.js' } } }),
    'entry.js': 'import { answer } from "#answer?literal"; import { part } from "#part/part"; import { answer as condition } from "#condition"; export const value = answer + part + condition',
    'answer.js': 'export const answer = 20',
    'parts/part.js': 'export const part = 2',
    'wrong.js': 'throw new Error("wrong imports condition")',
    'blocked.js': 'import value from "#blocked?query"; export { value }',
  }, async (root) => {
    const config = (input: string) => ({
      root,
      configFile: false as const,
      logLevel: 'silent' as const,
      plugins: [createPackageImportsQueryPlugin()],
      resolve: { conditions: ['product'] },
      build: { write: false, minify: false, rolldownOptions: { input, preserveEntrySignatures: 'strict' as const } },
    })
    const output = await build(config('entry.js'))
    assert.equal((await imported(chunk(output).code)).value, 42)
    await assert.rejects(build(config('blocked.js')), /No known conditions/)
  })
  return { exactQuery: true, wildcard: true, condition: true, blockedConditionError: true, runtimeValue: 42 }
}
