<script setup lang="ts">
import { computed, ref } from 'wevu'

interface IssueEvent {
  id: string
  isPublic: boolean
  latitude: number
  longitude: number
  name: string
}

const events = ref<IssueEvent[]>([
  {
    id: 'event-0',
    isPublic: true,
    latitude: 39.9102,
    longitude: 116.4006,
    name: '公开活动',
  },
  {
    id: 'event-1',
    isPublic: false,
    latitude: 39.9092,
    longitude: 116.3988,
    name: '内部活动',
  },
])

const selectedEventIdx = ref(1)
const isExpand = ref({
  callout: true,
})
const zoomScale = ref(13)
const showLocation = ref(false)
const lastRegionReason = ref('')

const mapCenter = computed(() => {
  const current = events.value[selectedEventIdx.value] ?? events.value[0]
  return {
    latitude: current.latitude,
    longitude: current.longitude,
  }
})

const markers = computed(() => events.value.map((event, index) => ({
  id: index,
  latitude: event.latitude,
  longitude: event.longitude,
  width: 28,
  height: 28,
  title: event.name,
  alpha: 1,
})))

const includePoints = computed(() => events.value.map(event => ({
  latitude: event.latitude,
  longitude: event.longitude,
})))

const polyline = computed(() => [
  {
    points: includePoints.value,
    color: '#3B82F6AA',
    width: 4,
    dottedLine: true,
  },
])

const circles = computed(() => {
  const focus = events.value[selectedEventIdx.value] ?? events.value[0]
  return [
    {
      latitude: focus.latitude,
      longitude: focus.longitude,
      radius: 120,
      strokeWidth: 2,
      color: '#0EA5E9AA',
      fillColor: '#0EA5E922',
    },
  ]
})

function updateSelectedEvent(markerId: number) {
  if (markerId >= 0 && markerId < events.value.length) {
    selectedEventIdx.value = markerId
  }
}

function handleMarkerTap(event: any) {
  const markerId = Number(event?.detail?.markerId ?? -1)
  if (!Number.isNaN(markerId)) {
    updateSelectedEvent(markerId)
  }
}

function handleCalloutTap(event: any) {
  const markerId = Number(event?.detail?.markerId ?? -1)
  if (!Number.isNaN(markerId)) {
    updateSelectedEvent(markerId)
  }
}

function handleRegionChange(event: any) {
  lastRegionReason.value = event?.detail?.causedBy ?? ''
}
</script>

<template>
  <map
    class="issue289-map"
    :markers="markers"
    :latitude="mapCenter.latitude"
    :longitude="mapCenter.longitude"
    :scale="zoomScale"
    :min-scale="3"
    :max-scale="20"
    :polyline="polyline"
    :circles="circles"
    :include-points="includePoints"
    :show-location="showLocation"
    :show-compass="true"
    :enable-zoom="true"
    :enable-scroll="true"
    :enable-rotate="true"
    @markertap="handleMarkerTap"
    @callouttap="handleCalloutTap"
    @regionchange="handleRegionChange"
  >
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
        {{ event.name }}-{{ index }}
      </cover-view>
    </template>
  </map>

  <view class="map-meta">
    region causedBy: {{ lastRegionReason || 'none' }}
  </view>
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
  font-size: 22rpx;
}

.event-chip-expanded {
  width: 176rpx;
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

.map-meta {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
