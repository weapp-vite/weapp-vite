<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

type NavbarStatus = 'online' | 'syncing' | 'offline'

type NavbarActionType = 'refresh' | 'more' | 'pill'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    pills?: string[]
    status?: NavbarStatus
    dense?: boolean
  }>(),
  {
    title: 'WeVU Template',
    subtitle: '',
    pills: () => [],
    status: 'online',
    dense: false,
  },
)

const emit = defineEmits<{
  (e: 'action', payload: { type: NavbarActionType, value?: string }): void
}>()

const activePill = ref('')

watch(
  () => props.pills,
  (nextPills) => {
    if (!nextPills.length) {
      activePill.value = ''
      return
    }

    if (!activePill.value || !nextPills.includes(activePill.value)) {
      activePill.value = nextPills[0] ?? ''
    }
  },
  { immediate: true },
)

const navbarClass = computed(() => {
  return props.dense ? 'navbar navbar-dense' : 'navbar'
})

const statusText = computed(() => {
  if (props.status === 'online') {
    return '运行正常'
  }
  if (props.status === 'syncing') {
    return '同步中'
  }
  return '待激活'
})

const statusClass = computed(() => {
  if (props.status === 'online') {
    return 'status status-online'
  }
  if (props.status === 'syncing') {
    return 'status status-syncing'
  }
  return 'status status-offline'
})

function emitAction(type: NavbarActionType, value?: string) {
  emit('action', { type, value })
}

function selectPill(pill: string) {
  activePill.value = pill
  emitAction('pill', pill)
}
</script>

<template>
  <view :class="navbarClass">
    <view class="navbar-main">
      <text class="navbar-title">
        {{ props.title }}
      </text>
      <text v-if="props.subtitle" class="navbar-subtitle">
        {{ props.subtitle }}
      </text>
      <view :class="statusClass">
        <text class="status-dot" />
        <text class="status-text">
          {{ statusText }}
        </text>
      </view>
    </view>

    <view v-if="props.pills.length" class="navbar-pills">
      <button
        v-for="pill in props.pills"
        :key="pill"
        class="pill"
        :class="pill === activePill ? 'pill-active' : ''"
        @tap.stop="selectPill(pill)"
      >
        {{ pill }}
      </button>
    </view>

    <view class="navbar-actions">
      <button class="ghost-btn" @tap.catch="emitAction('refresh')">
        刷新
      </button>
      <slot name="right">
        <button class="ghost-btn" @tap.catch="emitAction('more')">
          更多
        </button>
      </slot>
    </view>
  </view>
</template>

<style>
.navbar {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: calc(env(safe-area-inset-top) + 20rpx) 28rpx 20rpx;
  margin-bottom: 24rpx;
  color: #fff;
  background: linear-gradient(135deg, #4c6ef5, #7048e8);
  border-radius: 24rpx;
}

.navbar-dense {
  gap: 12rpx;
  padding-top: calc(env(safe-area-inset-top) + 12rpx);
}

.navbar-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.navbar-title {
  font-size: 38rpx;
  font-weight: 700;
  color: #fff;
}

.navbar-subtitle {
  font-size: 24rpx;
  color: rgb(255 255 255 / 84%);
}

.status {
  display: inline-flex;
  gap: 8rpx;
  align-items: center;
  width: fit-content;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.status-online {
  background: rgb(18 184 134 / 24%);
}

.status-syncing {
  background: rgb(255 212 59 / 24%);
}

.status-offline {
  background: rgb(255 107 107 / 24%);
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  background: #fff;
  border-radius: 999rpx;
}

.status-text {
  font-size: 20rpx;
  color: #fff;
}

.navbar-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.pill {
  min-width: 100rpx;
  height: 56rpx;
  padding: 0 18rpx;
  margin: 0;
  font-size: 22rpx;
  line-height: 56rpx;
  color: #e5dbff;
  background: rgb(255 255 255 / 14%);
  border-radius: 999rpx;
}

.pill-active {
  font-weight: 600;
  color: #3b2b78;
  background: #fff;
}

.pill::after {
  border: 0;
}

.navbar-actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.ghost-btn {
  min-width: 110rpx;
  height: 60rpx;
  padding: 0 18rpx;
  margin: 0;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #fff;
  background: rgb(255 255 255 / 18%);
  border-radius: 14rpx;
}

.ghost-btn::after {
  border: 0;
}
</style>
