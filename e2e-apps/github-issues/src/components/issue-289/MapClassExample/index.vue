<script setup lang="ts">
import { computed, ref } from 'wevu'

interface IssueEvent {
  id: string
  isPublic: boolean
  latitude: number
  longitude: number
  name: string
}

const props = withDefaults(defineProps<{
  calloutExpanded: boolean
  showCalloutList: boolean
  selectedEventIdx: number
  mockNativeMap?: boolean
}>(), {
  mockNativeMap: false,
})

const events: IssueEvent[] = [
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
]

const zoomScale = ref(13)
const showLocation = ref(false)
const lastRegionReason = ref('')

const safeSelectedEventIdx = computed(() => {
  if (props.selectedEventIdx < 0) {
    return 0
  }
  if (props.selectedEventIdx >= events.length) {
    return events.length - 1
  }
  return props.selectedEventIdx
})

const mapCenter = computed(() => {
  const current = events[safeSelectedEventIdx.value] ?? events[0]
  return {
    latitude: current.latitude,
    longitude: current.longitude,
  }
})

const markers = computed(() => events.map((event, index) => ({
  id: index,
  latitude: event.latitude,
  longitude: event.longitude,
  width: 28,
  height: 28,
  title: event.name,
  alpha: 1,
})))

const includePoints = computed(() => events.map(event => ({
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
  const focus = events[safeSelectedEventIdx.value] ?? events[0]
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

const mapMetaList = computed(() => events.map((event, index) => ({
  id: event.id,
  label: `${event.name}-${index}`,
  active: safeSelectedEventIdx.value === index,
  tone: event.isPublic ? 'public' : 'private',
})))

function handleMarkerTap(event: any) {
  const markerId = Number(event?.detail?.markerId ?? -1)
  if (!Number.isNaN(markerId)) {
    lastRegionReason.value = `markertap-${markerId}`
  }
}

function handleCalloutTap(event: any) {
  const markerId = Number(event?.detail?.markerId ?? -1)
  if (!Number.isNaN(markerId)) {
    lastRegionReason.value = `callouttap-${markerId}`
  }
}

function handleRegionChange(event: any) {
  lastRegionReason.value = event?.detail?.causedBy ?? ''
}
</script>

<template>
  <map
    v-if="!props.mockNativeMap"
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
    <template v-if="showCalloutList" #callout>
      <cover-view
        v-for="(event, index) in events"
        :key="event.id"
        :marker-id="index"
        class="event-chip"
        :class="[
          calloutExpanded ? 'event-chip-expanded' : 'event-chip-collapsed',
          safeSelectedEventIdx === index
            ? (event.isPublic ? 'event-chip-highlight' : 'event-chip-theme')
            : 'event-chip-default',
        ]"
      >
        {{ event.name }}-{{ index }}
      </cover-view>
    </template>
  </map>

  <view v-else class="issue289-map-mock">
    <template v-if="showCalloutList">
      <view
        v-for="(event, index) in events"
        :key="event.id"
        class="event-chip"
        :class="[
          calloutExpanded ? 'event-chip-expanded' : 'event-chip-collapsed',
          safeSelectedEventIdx === index
            ? (event.isPublic ? 'event-chip-highlight' : 'event-chip-theme')
            : 'event-chip-default',
        ]"
      >
        {{ event.name }}-{{ index }}
      </view>
    </template>
  </view>

  <view v-if="showCalloutList" id="issue289-map-meta-list" class="map-meta-list map-meta-list-open">
    <view
      v-for="meta in mapMetaList"
      :key="meta.id"
      class="map-meta-item"
      :class="[
        meta.active ? 'map-meta-item-active' : 'map-meta-item-idle',
        meta.tone === 'public' ? 'map-meta-item-public' : 'map-meta-item-private',
      ]"
    >
      {{ meta.label }}
      <text
        v-if="meta.active"
        class="map-meta-flag"
        :class="meta.tone === 'public' ? 'map-meta-flag-public' : 'map-meta-flag-private'"
      >
        active
      </text>
      <text v-else class="map-meta-flag map-meta-flag-idle">
        idle
      </text>
    </view>
  </view>

  <view v-else id="issue289-map-meta-list" class="map-meta-list map-meta-list-closed">
    <view class="map-meta-empty">
      callout hidden
    </view>
  </view>

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

.issue289-map-mock {
  margin-top: 20rpx;
  min-height: 120rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
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

.map-meta-list {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.map-meta-list-open {
  opacity: 1;
}

.map-meta-list-closed {
  opacity: 0.66;
}

.map-meta-item {
  min-height: 52rpx;
  line-height: 52rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
}

.map-meta-item-idle {
  transform: scale(1);
}

.map-meta-item-active {
  transform: scale(1.03);
}

.map-meta-item-public {
  color: #166534;
  background: #dcfce7;
}

.map-meta-item-private {
  color: #9f1239;
  background: #ffe4e6;
}

.map-meta-flag {
  margin-left: 8rpx;
  padding: 0 8rpx;
  border-radius: 9999rpx;
  font-size: 20rpx;
}

.map-meta-flag-public {
  color: #ffffff;
  background: #15803d;
}

.map-meta-flag-private {
  color: #ffffff;
  background: #be123c;
}

.map-meta-flag-idle {
  color: #334155;
  background: #e2e8f0;
}

.map-meta-empty {
  min-height: 52rpx;
  line-height: 52rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  font-size: 22rpx;
  color: #475569;
  background: #e2e8f0;
}

.map-meta {
  margin-top: 16rpx;
  font-size: 22rpx;
  color: #334155;
}
</style>
