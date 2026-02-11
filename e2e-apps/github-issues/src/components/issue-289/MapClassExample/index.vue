<script setup lang="ts">
import { ref } from 'wevu'

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
</script>

<template>
  <map class="issue289-map" :markers="markers" latitude="39.9100" longitude="116.4000" scale="13">
    <!-- eslint-disable-next-line vue/valid-v-slot -->
    <template #callout>
      <cover-view
        v-for="(event, index) in events"
        :key="event.id"
        :marker-id="index"
        class="event-chip"
        :class="[
          isExpand.callout ? 'event-chip-expanded' : 'event-chip-collapsed',
          selectedEventIdx === index
            ? (event.isPublic ? 'event-chip-highlight' : 'event-chip-theme')
            : 'event-chip-default',
        ]"
      >
        callout-{{ index }}
      </cover-view>
    </template>
  </map>
</template>

<style scoped>
.issue289-map {
  margin-top: 20rpx;
  width: 100%;
  height: 320rpx;
  border-radius: 16rpx;
}

.event-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  border-radius: 9999rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
  color: #fff;
  font-size: 24rpx;
}

.event-chip-expanded {
  width: 164rpx;
}

.event-chip-collapsed {
  width: 64rpx;
}

.event-chip-default {
  color: #475569;
  background: #fff;
}

.event-chip-highlight {
  background: #0ea5e9;
}

.event-chip-theme {
  background: #334155;
}
</style>
