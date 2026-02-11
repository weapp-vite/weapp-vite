<script setup lang="ts">
import { computed, ref } from 'wevu'

defineProps<{
  root: { a: string }
}>()

const markers = ref([
  {
    id: 1,
    latitude: 39.908823,
    longitude: 116.39747,
    width: 18,
    height: 18,
  },
])

const events = ref([
  {
    id: 'event-0',
    isPublic: true,
  },
  {
    id: 'event-1',
    isPublic: false,
  },
])

const selectedEventIdx = ref(1)
const isExpand = ref({
  callout: true,
})
const source = ref(true)
const computedValue = computed(() => Boolean(source.value))
</script>

<template>
  <view class="page">
    <InfoBanner :root="{ a: 'aaaa' }" />

    <map :markers="markers" latitude="39.9100" longitude="116.4000" scale="13">
      <!-- eslint-disable-next-line vue/valid-v-slot -->
      <template #callout>
        <cover-view
          v-for="(event, index) in events"
          :key="event.id"
          :marker-id="index"
          class="relative h-[64rpx] flex items-center rounded-full p-[8rpx] shadow-lg" :class="[
            isExpand.callout ? 'w-[164rpx]' : 'w-[64rpx]',
            selectedEventIdx === index ? (event.isPublic ? 'bg-highlight-dark' : 'bg-theme-dark') : 'bg-white',
          ]"
        >
          callout-{{ index }}
        </cover-view>
      </template>
    </map>

    <view v-if="root" :class="root.a" />

    <view :class="computedValue ? 'a' : 'b'" />
  </view>
</template>

<json>
{
  "component": false,
  "usingComponents": {
    "InfoBanner": "/components/InfoBanner/index"
  }
}
</json>
