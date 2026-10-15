import { expect, it } from 'vitest'
import { runBabelConsumerProcess } from '../../../test/utils/babelBackendProcess'

it('loads the compiler only for JSON macros and keeps configurations independent', async () => {
  const consumerUrl = new URL('./vueConfig.ts', import.meta.url).href
  const result = await runBabelConsumerProcess(`
    import { mkdtemp, rm } from 'node:fs/promises'
    import os from 'node:os'
    import path from 'node:path'
    const { extractConfigFromVue } = await import(${JSON.stringify(consumerUrl)})
    const root = await mkdtemp(path.join(os.tmpdir(), 'babel-vue-config-'))
    const read = (name, source) => extractConfigFromVue(path.join(root, name + '.vue'), { source, force: true })
    try {
      const plain = await read('plain', '<template><view /></template>')
      const script = await read('script', '<script setup lang="ts">const value: number = 42</script>')
      const json = await read('json', '<template><view /></template><json>{ "navigationBarTitleText": "json" }</json>')
      const lazy = { core: countCore(), owner: countOwner(), backend: countBackend('wevu/compiler') }
      const configs = await Promise.all([
        read('first', '<script setup>definePageJson({ navigationBarTitleText: "first" })</script>'),
        read('second', '<script setup>definePageJson({ navigationBarTitleText: "second" })</script>'),
      ])
      const invalid = await read('invalid', '<script setup>definePageJson({ title: missingValue })</script>')
      const retry = await read('retry', '<script setup>definePageJson({ navigationBarTitleText: "retry" })</script>')
      process.stdout.write(JSON.stringify({
        plain: plain === undefined, script: script === undefined, json, lazy, configs,
        invalid: invalid === undefined, retry,
        owner: countOwner(), backend: countBackend('wevu/compiler'),
      }))
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  `)

  expect(result).toEqual({
    plain: true,
    script: true,
    json: { navigationBarTitleText: 'json' },
    lazy: { core: 0, owner: 0, backend: 0 },
    configs: [{ navigationBarTitleText: 'first' }, { navigationBarTitleText: 'second' }],
    invalid: true,
    retry: { navigationBarTitleText: 'retry' },
    owner: 5,
    backend: 1,
  })
})
