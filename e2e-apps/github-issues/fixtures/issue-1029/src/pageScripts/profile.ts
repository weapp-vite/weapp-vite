import { computed, onMounted } from 'wevu'
import { definePage as declarePage, useRoute } from 'wevu/router'
import { navigate, snapshot, trace } from '../router'

declarePage({ name: 'profile', meta: { title: '个人资料', requiresAuth: true, role: 'member', limits: { count: 3 }, nullable: null } })
const route = useRoute()
const title = computed(() => route.meta?.title ?? '')
onMounted(() => trace.push({ phase: 'mounted', to: route.name }))
function _runE2E(command = 'snapshot') {
  return command === 'snapshot' ? snapshot() : navigate(command)
}
defineExpose({ _runE2E })
