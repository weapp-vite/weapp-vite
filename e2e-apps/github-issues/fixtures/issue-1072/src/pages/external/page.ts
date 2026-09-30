import { definePageMeta as meta, ref } from 'wevu'
import { definePage as route } from 'wevu/router'

route({ name: 'external', meta: { access: 'public' } })
meta({ layout: false })
// eslint-disable-next-line ts/no-unused-vars -- 由外部 script setup 所属的 Vue 模板消费。
const count = ref(0)
