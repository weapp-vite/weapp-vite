<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { type ContactProfile, loadContactProfile } from '../api'

const profile = ref<ContactProfile>()
const loading = ref(true)
const error = ref('')

onMounted(() => {
  void refresh()
})

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    profile.value = await loadContactProfile()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '联系人加载失败'
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
        <p class="mb-1 text-xs font-bold tracking-wide text-[#07c160] uppercase">Axios</p>
        <h1 class="m-0 text-[17px] leading-tight font-semibold">联系人档案</h1>
      </div>
      <button class="h-8.5 rounded border border-black/10 bg-white px-3 text-sm text-[#111]" type="button" @click="refresh">
        刷新
      </button>
    </header>

    <div v-if="loading" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#666]">正在加载联系人...</div>
    <div v-else-if="error" class="mt-3.5 rounded-md bg-white p-4.5 text-center text-[#b42318]">{{ error }}</div>
    <template v-else-if="profile">
      <section class="flex items-center gap-3.5 rounded-md bg-white p-4.5">
        <div class="flex size-13.5 shrink-0 items-center justify-center rounded-md bg-[#07c160] text-[22px] font-bold text-white">
          {{ profile.avatarText }}
        </div>
        <div class="min-w-0">
          <h2 class="m-0 text-xl font-semibold">{{ profile.name }}</h2>
          <p class="my-1 text-[#666]">{{ profile.title }} · {{ profile.city }}</p>
          <span class="text-[13px] text-[#17803d]">{{ profile.status }}</span>
        </div>
      </section>

      <p class="my-3 rounded-md bg-white p-4 leading-relaxed">{{ profile.signature }}</p>

      <div class="mb-3 flex flex-wrap gap-2">
        <span v-for="tag in profile.tags" :key="tag" class="rounded-full bg-[#dff5df] px-2.5 py-1.5 text-xs text-[#31553a]">
          {{ tag }}
        </span>
      </div>

      <div class="mb-3.5 grid grid-cols-3 gap-2">
        <article v-for="item in profile.stats" :key="item.label" class="rounded-md bg-white p-3.5 text-center">
          <strong class="mb-1 block text-lg">{{ item.value }}</strong>
          <span class="block text-xs text-[#777]">{{ item.label }}</span>
        </article>
      </div>

      <section class="rounded-md bg-white p-4">
        <h3 class="mb-3 text-[15px] font-semibold">最近互动</h3>
        <article
          v-for="item in profile.recent"
          :key="item.title"
          class="border-t border-black/6 pt-3 first:border-t-0 first:pt-0"
        >
          <span class="text-xs text-[#999]">{{ item.title }}</span>
          <p class="mt-1 mb-3 leading-normal">{{ item.detail }}</p>
        </article>
      </section>
    </template>
  </section>
</template>
