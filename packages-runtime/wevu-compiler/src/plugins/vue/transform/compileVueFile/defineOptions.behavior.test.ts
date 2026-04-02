import os from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import * as fs from '../../../../utils/fs'
import { compileVueFile } from './index'

async function createTempProject() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-compile-behavior-'))
}

describe('compileVueFile defineOptions behaviors', () => {
  it('compiles built-in behavior string in script setup defineOptions', async () => {
    const filename = '/project/src/components/basic-behavior.vue'
    const source = `
<script setup lang="ts">
defineOptions({
  behaviors: ['wx://component-export'],
})
</script>
<template><view /></template>
    `.trim()

    const result = await compileVueFile(source, filename)

    expect(result.script).toContain('createWevuComponent')
    expect(result.script).toContain('wx://component-export')
  })

  it('keeps imported behavior identifier when behavior module uses native Behavior()', async () => {
    const projectDir = await createTempProject()
    const behaviorFile = path.join(projectDir, 'behavior.ts')
    const filename = path.join(projectDir, 'behavior-consumer.vue')
    const source = `
<script setup lang="ts">
import FooBehavior from './behavior'

defineOptions({
  behaviors: [FooBehavior],
})
</script>
<template><view /></template>
    `.trim()

    await fs.writeFile(
      behaviorFile,
      `export default Behavior({ methods: { ping() { return 'ok' } } })\n`,
      'utf8',
    )

    const result = await compileVueFile(source, filename)

    expect(result.script).toContain('import FooBehavior from')
    expect(result.script).toContain('behaviors: [FooBehavior]')
    expect(result.script).toContain('createWevuComponent')
  })
})
