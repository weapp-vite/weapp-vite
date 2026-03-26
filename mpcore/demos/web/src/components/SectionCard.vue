<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="sim-card">
    <header class="sim-card__header">
      <h2 class="sim-card__title">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="sim-card__subtitle">
        {{ subtitle }}
      </p>
    </header>
    <div class="sim-card__body">
      <slot />
    </div>
  </section>
</template>
