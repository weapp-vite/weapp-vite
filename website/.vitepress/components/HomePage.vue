<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import TechBackground from './TechBackground.vue'

const { isDark } = useData()
const glowClass = computed(() => (isDark.value ? 'from-emerald-500/25 to-lime-400/20' : 'from-emerald-400/25 to-emerald-300/15'))
</script>

<template>
  <section class="relative overflow-hidden isolate">
    <!-- Animated background -->
    <TechBackground class="absolute inset-0" :speed="0.35" :density="0.9" />

    <!-- Hero -->
    <div class="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:py-28">
      <div class="mx-auto max-w-3xl text-center">
        <div
          class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-600 dark:text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_8px_24px_rgba(16,185,129,0.15)]"
        >
          <span class="i-mdi-lightning-bolt text-emerald-500" />
          现代小程序工程化
        </div>
        <h1
          class="mt-6 bg-gradient-to-br from-emerald-400 via-lime-300 to-emerald-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl"
        >
          Weapp‑vite
        </h1>
        <p class="mt-5 text-balance text-base/7 text-zinc-700 dark:text-zinc-300 sm:text-lg/8">
          把现代化的开发模式带入小程序开发：极速热更、类型安全、插件生态、原子化样式与工程化能力，一站式串联。
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <a
            class="group relative inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-600/20 px-5 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-50 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_24px_rgba(16,185,129,0.25)] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.5)_inset,0_16px_40px_rgba(16,185,129,0.35)] transition"
            href="/guide/"
          >
            <span class="i-mdi-rocket-launch-outline text-emerald-600 dark:text-emerald-300" />
            快速开始
            <span
              class="absolute -inset-px -z-10 rounded-xl bg-gradient-to-r from-emerald-400/20 via-lime-300/20 to-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition"
            />
          </a>
          <a
            class="inline-flex items-center gap-2 rounded-xl border border-zinc-400/40 px-5 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-900/5 dark:hover:bg-white/5 transition"
            href="https://github.com/weapp-vite/weapp-vite"
            target="_blank"
            rel="noreferrer"
          >
            <span class="i-mdi-github" />
            GitHub
          </a>
        </div>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span class="rounded-full bg-white/60 dark:bg-white/10 px-3 py-1 ring-1 ring-inset ring-zinc-900/5 dark:ring-white/10">
            TypeScript/ESM
          </span>
          <span class="rounded-full bg-white/60 dark:bg-white/10 px-3 py-1 ring-1 ring-inset ring-zinc-900/5 dark:ring-white/10">
            Vite / Rolldown 插件
          </span>
          <span class="rounded-full bg-white/60 dark:bg-white/10 px-3 py-1 ring-1 ring-inset ring-zinc-900/5 dark:ring-white/10">
            自动构建 npm
          </span>
          <span class="rounded-full bg-white/60 dark:bg-white/10 px-3 py-1 ring-1 ring-inset ring-zinc-900/5 dark:ring-white/10">
            自动引入组件
          </span>
        </div>
      </div>
    </div>

    <!-- gradient glows -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden blur-2xl">
      <div class="mx-auto h-64 w-[40rem] rounded-full bg-gradient-to-tr" :class="glowClass" />
    </div>
  </section>

  <!-- Features -->
  <section class="relative">
    <div class="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]">
      <div class="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
    <div class="mx-auto max-w-7xl px-6 py-8 sm:py-12">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <a href="/guide/" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              🛠️
            </div>
            <h3 class="text-lg font-semibold">丰富的功能</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">对 TypeScript、SCSS 等支持开箱即用。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>

        <a href="/guide/npm" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              🌲
            </div>
            <h3 class="text-lg font-semibold">自动构建 npm</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">内置小程序构建 npm 与内联 npm 代码两种策略。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>

        <a href="/guide/auto-import" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              🔑
            </div>
            <h3 class="text-lg font-semibold">自动引入组件</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">直接在模板中使用组件，自动感应注册。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>

        <a href="/config/" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              🔩
            </div>
            <h3 class="text-lg font-semibold">通用的插件</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">在开发与构建过程中复用 Vite/Rolldown 插件接口。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>

        <a href="/guide/alias" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              ❤️
            </div>
            <h3 class="text-lg font-semibold">完全的别名支持</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">任意 js/ts 或 json 文件中使用别名，自动转译。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>

        <a href="/guide/subpackage" class="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              🌞
            </div>
            <h3 class="text-lg font-semibold">分包适配</h3>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">自动计算分包依赖，独立分包自动创建编译上下文。</p>
          <div class="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-100 bg-gradient-to-br from-emerald-400/10 via-lime-300/10 to-emerald-600/10" />
        </a>
      </div>
    </div>
  </section>

  <!-- Code demo -->
  <section class="relative">
    <div class="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
      <div
        class="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-[radial-gradient(1200px_400px_at_50%_-10%,rgba(16,185,129,0.16),transparent_60%),linear-gradient(180deg,rgba(0,0,0,0.06),transparent_40%)] shadow-[0_0_0_1px_rgba(16,185,129,0.1)_inset,0_10px_30px_rgba(0,0,0,0.18)]"
      >
        <div class="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-xs text-zinc-500">
          <div class="flex gap-1.5 pr-2">
            <span class="size-2.5 rounded-full bg-red-400/80" />
            <span class="size-2.5 rounded-full bg-yellow-400/80" />
            <span class="size-2.5 rounded-full bg-green-400/80" />
          </div>
          <span class="i-mdi-console" />
          终端
        </div>
        <pre class="relative m-0 max-h-[28rem] overflow-auto bg-transparent p-6 text-[13px] leading-relaxed text-emerald-900 dark:text-emerald-100">
<code><span class="opacity-60"># 初始化项目</span>
pnpm dlx create-weapp-vite my-miniapp
cd my-miniapp

<span class="opacity-60"># 开发预览</span>
pnpm dev

<span class="opacity-60"># 构建</span>
pnpm build</code>
        </pre>
        <div class="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-emerald-400/25" />
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="relative pb-14">
    <div class="mx-auto max-w-4xl rounded-2xl border border-emerald-500/30 bg-white/60 px-6 py-10 text-center shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:bg-white/5">
      <h2 class="text-xl font-bold tracking-tight">
        准备好上手了么？
      </h2>
      <p class="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        阅读指南以了解最佳实践，或直接从模板开始。
      </p>
      <div class="mt-5 flex items-center justify-center gap-3">
        <a
          class="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-600/20 px-5 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-50 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_24px_rgba(16,185,129,0.25)]"
          href="/guide/"
        >
          <span class="i-mdi-book-open-page-variant-outline" />
          阅读指南
        </a>
        <a
          class="inline-flex items-center gap-2 rounded-xl border border-zinc-400/40 px-5 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-900/5 dark:hover:bg-white/5 transition"
          href="https://github.com/weapp-vite/weapp-vite"
          target="_blank"
          rel="noreferrer"
        >
          <span class="i-mdi-star-outline" />
          GitHub Star
        </a>
      </div>
    </div>
  </section>
</template>
