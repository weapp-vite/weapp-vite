<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadMoments, type Moment } from '../api'

const moments = ref<Moment[]>([])
const refreshedAt = ref(0)
const loading = ref(true)
const error = ref('')

onMounted(() => {
  void refresh()
})

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const response = await loadMoments()
    moments.value = response.items
    refreshedAt.value = response.refreshedAt
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '朋友圈加载失败'
  }
  finally {
    loading.value = false
  }
}

function formatRefreshTime(value: number) {
  if (!value) {
    return ''
  }
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <section class="min-h-0 flex-1 overflow-y-auto px-4 pb-4.5">
    <header class="-mx-4 mb-4 flex min-h-42 items-end justify-between bg-[#305c46] bg-[linear-gradient(135deg,rgba(0,0,0,0.16),rgba(0,0,0,0.62))] p-4 text-white">
      <button class="h-8.5 rounded border border-black/10 bg-white px-3 text-sm text-[#111]" type="button" @click="refresh">刷新</button>
      <div>
        <p class="mb-1 text-xs font-bold tracking-wide text-white/78 uppercase">Fetch</p>
        <h1 class="m-0 text-[17px] leading-tight font-semibold">朋友圈动态</h1>
        <span v-if="refreshedAt" class="mt-1 block text-xs text-white/78">更新于 {{ formatRefreshTime(refreshedAt) }}</span>
      </div>
    </header>

    <div v-if="loading" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#666]">正在加载动态...</div>
    <div v-else-if="error" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#b42318]">{{ error }}</div>

    <article v-for="moment in moments" v-else :key="moment.id" class="flex gap-3 border-b border-black/10 py-4">
      <div class="flex size-13.5 shrink-0 items-center justify-center rounded-md bg-[#07c160] text-[22px] font-bold text-white">
        {{ moment.avatarText }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-2 flex justify-between gap-3">
          <strong>{{ moment.author }}</strong>
          <span class="text-xs text-[#777]">{{ moment.time }}</span>
        </div>
        <p class="mb-2.5 leading-relaxed">{{ moment.content }}</p>
        <div
          class="mb-2.5 flex h-33 items-end rounded-md p-3 font-bold text-white"
          :class="moment.cover === 'blue' ? 'bg-[#2f5d8c]' : 'bg-[#305c46]'"
        >
          <span>{{ moment.author }}</span>
        </div>
        <div class="text-xs text-[#777]">
          <span>{{ moment.likes }} 人觉得有用</span>
        </div>
        <div class="mt-2 rounded-md bg-black/5 p-2.5">
          <p v-for="comment in moment.comments" :key="`${moment.id}-${comment.user}`" class="mb-1.5 text-[13px] last:mb-0">
            <strong>{{ comment.user }}：</strong>{{ comment.text }}
          </p>
        </div>
      </div>
    </article>
  </section>
</template>
