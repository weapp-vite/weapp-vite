<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'wevu'

const props = withDefaults(defineProps<{
  count?: number
}>(), {
  count: 1,
})
const emit = defineEmits<{
  ready: [number]
  closed: []
  change: [number]
}>()

const localCount = ref(props.count)
const doubled = computed(() => localCount.value * 2)

watch(() => props.count, (value) => {
  localCount.value = value
})

function increment() {
  localCount.value += 1
  emit('change', localCount.value)
}

onMounted(() => emit('ready', doubled.value))
onUnmounted(() => emit('closed'))
</script>

