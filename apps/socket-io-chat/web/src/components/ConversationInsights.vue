<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type ConversationInsight, loadConversationInsight } from '../api'

const insight = ref<ConversationInsight>()
const loading = ref(true)
const error = ref('')

onMounted(() => {
  void refresh()
})

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    insight.value = await loadConversationInsight()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '会话洞察加载失败'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="business-page insight-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">GraphQL</p>
        <h1>会话洞察</h1>
      </div>
      <button class="plain-button" type="button" @click="refresh">
        同步
      </button>
    </header>

    <div v-if="loading" class="loading-row">正在分析会话...</div>
    <div v-else-if="error" class="error-row">{{ error }}</div>

    <template v-else-if="insight">
      <section class="insight-summary">
        <span>{{ insight.summary.health }}</span>
        <h2>{{ insight.summary.title }}</h2>
        <p>{{ insight.summary.description }}</p>
      </section>

      <div class="metric-grid">
        <article v-for="metric in insight.metrics" :key="metric.label" class="metric-item">
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.label }}</span>
          <em>{{ metric.trend }}</em>
        </article>
      </div>

      <section class="thread-list">
        <h3>重点会话</h3>
        <article v-for="thread in insight.threads" :key="thread.id" class="thread-item">
          <div>
            <strong>{{ thread.name }}</strong>
            <p>{{ thread.lastMessage }}</p>
          </div>
          <span>{{ thread.unread }}</span>
        </article>
      </section>

      <section class="action-list">
        <h3>建议动作</h3>
        <article v-for="action in insight.actions" :key="action.title" class="action-item">
          <strong>{{ action.title }}</strong>
          <p>{{ action.detail }}</p>
        </article>
      </section>
    </template>
  </section>
</template>
