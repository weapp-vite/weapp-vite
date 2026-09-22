import { computed, definePageMeta as declarePageMeta, onMounted } from 'wevu'
import { useRoute } from 'wevu/router'
import { navigate, snapshot, trace } from '../router'

declarePageMeta({ route: { name: 'profile', meta: { title: '个人资料', requiresAuth: true, role: 'member', limits: { count: 3 }, nullable: null } } })
const route = useRoute()
const title = computed(() => route.meta?.title ?? '')
onMounted(() => trace.push({ phase: 'mounted', to: route.name }))
function _runE2E(command = 'snapshot') {
  return command === 'snapshot' ? snapshot() : navigate(command)
}
defineExpose({ _runE2E })
