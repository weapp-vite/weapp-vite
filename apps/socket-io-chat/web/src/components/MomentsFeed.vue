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
  <section class="business-page moments-page">
    <header class="moments-cover">
      <button class="plain-button" type="button" @click="refresh">刷新</button>
      <div>
        <p class="page-kicker">Fetch</p>
        <h1>朋友圈动态</h1>
        <span v-if="refreshedAt">更新于 {{ formatRefreshTime(refreshedAt) }}</span>
      </div>
    </header>

    <div v-if="loading" class="loading-row">正在加载动态...</div>
    <div v-else-if="error" class="error-row">{{ error }}</div>

    <article v-for="moment in moments" v-else :key="moment.id" class="moment-card">
      <div class="moment-avatar">{{ moment.avatarText }}</div>
      <div class="moment-body">
        <div class="moment-title">
          <strong>{{ moment.author }}</strong>
          <span>{{ moment.time }}</span>
        </div>
        <p>{{ moment.content }}</p>
        <div class="moment-image" :class="`moment-image--${moment.cover}`">
          <span>{{ moment.author }}</span>
        </div>
        <div class="moment-social">
          <span>{{ moment.likes }} 人觉得有用</span>
        </div>
        <div class="comment-list">
          <p v-for="comment in moment.comments" :key="`${moment.id}-${comment.user}`">
            <strong>{{ comment.user }}：</strong>{{ comment.text }}
          </p>
        </div>
      </div>
    </article>
  </section>
</template>
