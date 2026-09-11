<script setup lang="ts">
const count = ref(0)
onMounted(() => {
  count.value = 1
})
const route = useRoute()
const router = useRouter()
function goNext() {
  router.navigateTo('/pages/next/index')
}
</script>

<template>
  <view id="auto-import-presets"><text>{{ count }}:{{ route.path }}</text><button @tap="goNext">next</button></view>
</template>
