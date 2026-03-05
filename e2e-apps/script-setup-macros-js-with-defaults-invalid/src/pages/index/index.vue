<script setup>
const props = withDefaults(defineProps({
  label: String,
}), {
  label: 'invalid-js-with-defaults',
})
</script>

<template>
  <view>{{ props.label }}</view>
</template>
