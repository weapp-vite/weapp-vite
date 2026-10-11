import type { Fixture } from './types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const options: Fixture['options'] = { isPage: true, sourceMap: true, wevuDefaults: { component: { options: { virtualHost: false } } } }
export const REAL_INPUTS = [
  ['wevu-home', 'apps/wevu-vue-demo/src/pages/index/index.vue'],
  ['retail-detail', 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue'],
] as const

/** 原样读取两个真实页面；边界语料只补充真实页面未覆盖的脚本语义。 */
export async function createFixtures(root: string): Promise<Fixture[]> {
  const real = await Promise.all(REAL_INPUTS.map(async ([id, filename]) => ({ id, filename, source: await readFile(path.join(root, filename), 'utf8'), options })))
  const inline = (id: string, source: string, extra: Partial<Fixture> = {}): Fixture => ({ id, filename: `src/pages/compiler-batch-${id}/index.vue`, source, options, ...extra })
  return [
    ...real,
    inline('define-options', `<script setup lang="ts">
const title = '标题 😀'
defineOptions({ name: 'BatchPage', options: { virtualHost: false } })
</script><template><view>{{ title }}</view></template>`),
    inline('dual-script', `<script lang="ts">
export default { name: 'DualScript' }
</script><script setup lang="ts">
import { ref } from 'wevu'
const title = ref('two scripts')
</script><template><view>{{ title }}</view></template>`),
    inline('no-default-export', '<script lang="ts">const title = "plain script"</script><template><view>plain script</view></template>'),
    inline('imported-components', `<script setup lang="ts">
import Card from 'native/card'
import { Badge as LocalBadge } from 'native/badge'
import type { Model } from 'native/model'
const title = 'imports'
</script><template><Card :title="title" /><LocalBadge /></template>`, { autoComponents: true }),
    inline('options-api-components', `<script lang="ts">
import Button from 'native/button'
export default { components: { 'action-button': Button } }
</script><template><action-button /></template>`, { autoComponents: true }),
    inline('escaped-string-components', `<script setup lang="ts">
import Card from 'native/\\uD800'
</script><template><Card /></template>`, { autoComponents: true, expectParseFallback: true }),
    inline('invalid-template', `<script setup lang="ts">
const rows = []
</script><template><view v-for>{{ rows }}</view></template>`, { expectError: true }),
    inline('invalid-script', '<script setup lang="ts">const value =</script><template><view /></template>', { expectError: true, expectParseFallback: true }),
  ]
}
