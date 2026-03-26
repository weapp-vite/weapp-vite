<script setup lang="ts">
import { computed } from 'vue'
import { sectionCard } from '../lib/ui'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  tone?: 'embedded' | 'standalone'
}>(), {
  tone: 'embedded',
})

const styles = computed(() => sectionCard({ tone: props.tone }))
</script>

<template>
  <section :class="styles.base()">
    <header :class="styles.header()">
      <h2 :class="styles.title()">
        {{ title }}
      </h2>
      <p v-if="subtitle" :class="styles.subtitle()">
        {{ subtitle }}
      </p>
    </header>
    <div :class="styles.body()">
      <slot />
    </div>
  </section>
</template>
