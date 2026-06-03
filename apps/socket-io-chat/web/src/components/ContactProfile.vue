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
  <section class="business-page contact-page">
    <header class="page-header">
      <div>
        <p class="page-kicker">Axios</p>
        <h1>联系人档案</h1>
      </div>
      <button class="plain-button" type="button" @click="refresh">
        刷新
      </button>
    </header>

    <div v-if="loading" class="loading-row">正在加载联系人...</div>
    <div v-else-if="error" class="error-row">{{ error }}</div>
    <template v-else-if="profile">
      <section class="profile-hero">
        <div class="profile-avatar">{{ profile.avatarText }}</div>
        <div class="profile-main">
          <h2>{{ profile.name }}</h2>
          <p>{{ profile.title }} · {{ profile.city }}</p>
          <span>{{ profile.status }}</span>
        </div>
      </section>

      <p class="profile-signature">{{ profile.signature }}</p>

      <div class="tag-row">
        <span v-for="tag in profile.tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="metric-grid">
        <article v-for="item in profile.stats" :key="item.label" class="metric-item">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>

      <section class="timeline-block">
        <h3>最近互动</h3>
        <article v-for="item in profile.recent" :key="item.title" class="timeline-item">
          <span>{{ item.title }}</span>
          <p>{{ item.detail }}</p>
        </article>
      </section>
    </template>
  </section>
</template>
