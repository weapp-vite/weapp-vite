// @ts-expect-error Node 侧打包真实 IDE 页面后注入浏览器虚拟文件。
import sources from 'virtual:set-data-phases-fixture'
import { it } from 'vitest'
import { assertSetDataPhases } from '../test/helpers/setDataPhaseAssertions'

it('preserves IDE phase boundaries in the browser host', async () => {
  await assertSetDataPhases(sources as Array<[string, string]>)
})
