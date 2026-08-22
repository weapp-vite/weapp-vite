<script setup lang="ts">
import { computed, inject, onUnmounted } from 'wevu'

const props = defineProps<{
  value: number
}>()
const emit = defineEmits<{
  closed: [source: string]
}>()
const source = inject('consumer-source', 'missing')
const doubled = computed(() => props.value * 2)
void doubled

onUnmounted(() => emit('closed', source))
</script>
