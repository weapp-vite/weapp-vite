<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <section
    aria-labelledby="home-varo-title"
    class="mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 rounded-2xl border border-emerald-700/25 bg-emerald-50 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6 dark:border-emerald-300/25 dark:bg-emerald-950/45"
  >
    <div class="grid size-10 place-items-center rounded-xl border border-emerald-700/15 bg-white sm:size-13 dark:border-emerald-200/15 dark:bg-black/25">
      <img :src="withBase('/varo-symbol.svg')" width="32" height="32" alt="" class="size-6 sm:size-8">
    </div>
    <div>
      <h2 id="home-varo-title" class="text-base/6 font-bold text-[var(--vp-c-text-1)] sm:text-xl/7">
        Varo · Weapp-vite <span class="inline-block">官方自研组件库</span>
      </h2>
      <p class="mt-1 text-sm/6 text-[var(--vp-c-text-2)]">
        为微信小程序（Wevu）和 H5（Vue 3）提供可编辑的组件源码。
      </p>
    </div>
    <a
      class="col-start-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-emerald-700/35 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:col-start-3 sm:px-4 dark:border-emerald-300/35 dark:bg-black/25 dark:text-emerald-200 dark:hover:bg-emerald-900/55 dark:focus-visible:outline-emerald-300"
      href="https://varo.weapp.dev/"
      target="_blank"
      rel="noreferrer"
    >
      访问 Varo 官网
      <span aria-hidden="true">↗</span>
    </a>
  </section>
</template>
