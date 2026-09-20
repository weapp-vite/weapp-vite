import os from 'node:os'
import { WEAPP_I18N_RUNTIME_MARKER } from '@weapp-core/constants'
import path from 'pathe'
import { expect, it } from 'vitest'
import * as fs from '../../../../utils/fs'
import { compileVueFile } from './index'

it.each([
  { declaration: 'import { i18n } from \'./i18n\'', reference: 'i18n.behavior' },
  { declaration: 'import * as localization from \'./i18n\'', reference: 'localization.i18n.behavior' },
])('preserves the runtime behavior reference in $reference instead of emitting its build placeholder', async ({ declaration, reference }) => {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-i18n-behavior-'))
  try {
    await fs.writeFile(path.join(projectDir, 'i18n.ts'), `
const behavior = { ${WEAPP_I18N_RUNTIME_MARKER}: true }
export const i18n = { behavior }
`, 'utf8')
    const source = `
<script setup lang="ts">
${declaration}
defineOptions({ behaviors: [${reference}] })
</script>
<template><view>语言设置</view></template>
`
    const result = await compileVueFile(source, path.join(projectDir, 'consumer.vue'))
    expect(result.script).toContain(`behaviors: [${reference}]`)
    expect(result.script).not.toContain(WEAPP_I18N_RUNTIME_MARKER)
    expect(result.script).toContain('createWevuComponent')
  }
  finally {
    await fs.remove(projectDir)
  }
})
