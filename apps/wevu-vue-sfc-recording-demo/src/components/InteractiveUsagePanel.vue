<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

type Tone = 'sky' | 'emerald' | 'amber'
type Mode = 'light' | 'dark'

const props = withDefaults(defineProps<{
  modelValue: number
  title: string
  step: number
  tone: Tone
  mode?: Mode
  badge?: boolean
  tags: string[]
}>(), {
  mode: 'light',
  badge: true,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void
  (event: 'plus', next: number): void
  (event: 'toneChange', tone: Tone): void
}>()

const local = ref(props.modelValue)

watch(() => props.modelValue, (next) => {
  local.value = next
})

const toneClass = computed(() => {
  const toneClassMap: Record<Mode, Record<Tone, string>> = {
    light: {
      sky: 'border-sky-200 bg-sky-50 text-sky-900',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      amber: 'border-amber-200 bg-amber-50 text-amber-900',
    },
    dark: {
      sky: 'border-sky-400/35 bg-slate-900 text-sky-100',
      emerald: 'border-emerald-400/35 bg-slate-900 text-emerald-100',
      amber: 'border-amber-400/35 bg-slate-900 text-amber-100',
    },
  }
  return toneClassMap[props.mode][props.tone]
})

function plusLocal() {
  const next = props.modelValue + props.step
  emit('update:modelValue', next)
  emit('plus', next)
}

function changeTone() {
  const tones: Tone[] = ['sky', 'emerald', 'amber']
  const current = tones.indexOf(props.tone)
  emit('toneChange', tones[(current + 1) % tones.length])
}

function minusLocal() {
  const next = Math.max(0, props.modelValue - props.step)
  emit('update:modelValue', next)
}
</script>

<template>
  <view class="rounded-2xl border p-4 space-y-3" :class="toneClass">
    <view class="flex items-center justify-between">
      <text class="text-base font-semibold">{{ title }}</text>
      <text
        v-if="badge"
        class="rounded-full px-2 py-1 text-xs"
        :class="mode === 'light' ? 'bg-white text-slate-600' : 'bg-slate-800 text-slate-200'"
      >
        badge on
      </text>
    </view>

    <text class="block text-sm">model {{ modelValue }} / local {{ local }} / step {{ step }}</text>

    <view class="flex flex-wrap gap-2">
      <text
        v-for="tag in tags"
        :key="tag"
        class="rounded-md px-2 py-1 text-xs"
        :class="mode === 'light' ? 'bg-white text-slate-500' : 'bg-slate-800 text-slate-300'"
      >
        {{ tag }}
      </text>
    </view>

    <view class="flex gap-2">
      <button size="mini" class="flex-1" @tap="minusLocal">
        model -
      </button>
      <button size="mini" class="flex-1" type="primary" @tap="plusLocal">
        model +
      </button>
      <button size="mini" class="flex-1" @tap="changeTone">
        emit tone
      </button>
    </view>
  </view>
</template>
