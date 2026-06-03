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
  <section class="min-h-0 flex-1 overflow-y-auto px-4 pb-4.5">
    <header class="-mx-4 mb-4 flex items-center justify-between border-b border-black/10 bg-[#ededed] px-4.5 py-3.5">
      <div>
        <p class="mb-1 text-xs font-bold tracking-wide text-[#07c160] uppercase">GraphQL</p>
        <h1 class="m-0 text-[17px] leading-tight font-semibold">会话洞察</h1>
      </div>
      <button class="h-8.5 rounded border border-black/10 bg-white px-3 text-sm text-[#111]" type="button" @click="refresh">
        同步
      </button>
    </header>

    <div v-if="loading" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#666]">正在分析会话...</div>
    <div v-else-if="error" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#b42318]">{{ error }}</div>

    <template v-else-if="insight">
      <section class="mb-3 rounded-md bg-[#111] p-4.5 text-white">
        <span class="inline-flex rounded-full bg-[#95ec69] px-2.5 py-1 text-xs text-[#07582f]">{{ insight.summary.health }}</span>
        <h2 class="my-3.5 text-[22px] font-semibold">{{ insight.summary.title }}</h2>
        <p class="m-0 leading-relaxed text-white/74">{{ insight.summary.description }}</p>
      </section>

      <div class="mb-3.5 grid grid-cols-3 gap-2">
        <article v-for="metric in insight.metrics" :key="metric.label" class="rounded-md bg-white p-3.5 text-center">
          <strong class="mb-1 block text-lg">{{ metric.value }}</strong>
          <span class="block text-xs text-[#777]">{{ metric.label }}</span>
          <em class="block text-xs not-italic text-[#777]">{{ metric.trend }}</em>
        </article>
      </div>

      <section class="rounded-md bg-white p-4">
        <h3 class="mb-3 text-[15px] font-semibold">重点会话</h3>
        <article
          v-for="thread in insight.threads"
          :key="thread.id"
          class="flex items-start justify-between gap-3 border-t border-black/6 pt-3 first:border-t-0 first:pt-0"
        >
          <div>
            <strong>{{ thread.name }}</strong>
            <p class="mt-1 mb-3 leading-normal">{{ thread.lastMessage }}</p>
          </div>
          <span class="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-[#07c160] text-xs text-white">
            {{ thread.unread }}
          </span>
        </article>
      </section>

      <section class="mt-3 rounded-md bg-white p-4">
        <h3 class="mb-3 text-[15px] font-semibold">建议动作</h3>
        <article
          v-for="action in insight.actions"
          :key="action.title"
          class="border-t border-black/6 pt-3 first:border-t-0 first:pt-0"
        >
          <strong>{{ action.title }}</strong>
          <p class="mt-1 mb-3 leading-normal">{{ action.detail }}</p>
        </article>
      </section>
    </template>
  </section>
</template>
