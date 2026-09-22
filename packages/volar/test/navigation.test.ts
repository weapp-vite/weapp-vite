import path from 'node:path'
import {
  createVueLanguageService,
  findOffset,
  normalizeFileName,
} from './languageService'

describe('Volar navigation', () => {
  it('preserves import, template prop and event handler definitions through lightweight parser ownership', () => {
    const fixtureDir = normalizeFileName(path.resolve('packages/volar/test/fixtures/navigation'))
    const parentFile = `${fixtureDir}/Parent.vue`
    const childFile = `${fixtureDir}/Child.vue`
    const parentSource = `<script setup lang="ts">
import CartGroup from './Child.vue'
const props = defineProps<{ storeGoods: string[] }>()
function onGoodsSelect() {}
</script>
<template>
  <CartGroup :store-goods="props.storeGoods" @selectgoods="onGoodsSelect" />
</template>`
    const childSource = `<script setup lang="ts">
defineProps<{ storeGoods: string[] }>()
defineEmits<{ selectgoods: [] }>()
</script>
<template><view /></template>`
    const service = createVueLanguageService(new Map([
      [parentFile, parentSource],
      [childFile, childSource],
    ]))

    const importDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, './Child.vue') + 3,
    )
    expect(importDefinitions?.some(definition => definition.fileName === childFile)).toBe(true)

    const propDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, 'store-goods'),
    )
    expect(propDefinitions?.some(definition => definition.fileName === parentFile
      && definition.name === 'storeGoods')).toBe(true)

    const handlerDefinitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, 'onGoodsSelect', 1),
    )
    expect(handlerDefinitions?.some(definition => definition.fileName === parentFile
      && definition.name === 'onGoodsSelect')).toBe(true)
  })

  it('preserves Vue import definitions through defineOptions parser ownership', () => {
    const fixtureDir = normalizeFileName(path.resolve('packages/volar/test/fixtures/define-options-navigation'))
    const parentFile = `${fixtureDir}/Parent.vue`
    const childFile = `${fixtureDir}/Child.vue`
    const parentSource = `<script setup lang="ts">
import CouponCard from './Child.vue'
defineOptions({
  methods: {
    onCouponSelect() {},
  },
})
</script>
<template><CouponCard @select="onCouponSelect" /></template>`
    const childSource = `<script setup lang="ts">
defineOptions({ properties: { title: String } })
</script>
<template><view>{{ title }}</view></template>`
    const service = createVueLanguageService(new Map([
      [parentFile, parentSource],
      [childFile, childSource],
    ]))

    const definitions = service.getDefinitionAtPosition(
      parentFile,
      findOffset(parentSource, './Child.vue') + 3,
    )
    expect(definitions?.some(definition => definition.fileName === childFile)).toBe(true)
  })
})
