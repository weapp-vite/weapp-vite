import { WEVU_SETUP_READY_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { wechatPlatform } from '../../compiler/template'
import { compileVueFile } from './index'
import { wrapInitialSetupTemplate } from './initialRender'

describe('setup initial render barrier', () => {
  it('keeps raw modules and named declarations outside the render condition', () => {
    const module = '<wxs module="m">module.exports = { compare: function(a,b) { return a < b } }</wxs>'
    const declarations = `${module}<import src="./other.wxml" /><template name="named"><text>named</text></template>`
    expect(wrapInitialSetupTemplate(`${declarations}<status-label text="{{value}}" />`, wechatPlatform))
      .toBe(`${declarations}<block wx:if="{{${WEVU_SETUP_READY_KEY}}}"><status-label text="{{value}}" /></block>`)
  })

  it.each(['computed(() => "ready")', 'reactive(createState())'])('waits for a runtime initial value: %s', async (initializer) => {
    const result = await compileVueFile(`<script setup lang="ts">
      import { computed, reactive } from 'wevu'
      import StatusLabel from './StatusLabel.vue'
      const createState = () => ({ label: 'ready' })
      const value = ${initializer}
    </script><template><StatusLabel :text="value" v-if="value" /><StatusLabel v-else text="fallback" /></template>`, 'src/pages/index.vue', { isPage: true, autoSetDataPick: true })
    expect(result.template).toMatch(new RegExp(`^<block wx:if="{{${WEVU_SETUP_READY_KEY}}}">`))
    expect(result.template).toContain('wx:else')
    expect(result.script).toContain(`${WEVU_SETUP_READY_KEY}: false`)
    expect(result.bindingManifest?.bindings).toContainEqual(expect.objectContaining({ kind: 'if', outputPath: WEVU_SETUP_READY_KEY }))
    expect(result.script).toContain(`"${WEVU_SETUP_READY_KEY}"`)
  })

  it.each(['<StatusLabel text="static" />', '<text>{{value}}</text>'])('keeps templates without setup component properties eager: %s', async (template) => {
    const result = await compileVueFile(`<script setup>import StatusLabel from './StatusLabel.vue'; const value = 'static'</script><template>${template}</template>`, 'src/pages/index.vue')
    expect(result.template).not.toContain(WEVU_SETUP_READY_KEY)
    expect(result.script).not.toContain(WEVU_SETUP_READY_KEY)
  })
})
