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
          class="mt-6 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 dark:from-emerald-400 dark:via-lime-300 dark:to-emerald-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl"
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

  <!-- Code demo + CTA -->
  <section class="relative">
    <!-- subtle background grid to reduce empty feel -->
    <div class="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]">
      <div class="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
    <div class="mx-auto max-w-7xl px-6 py-12 lg:py-16">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Terminal: mimic docs code-group style and content -->
        <div class="lg:col-span-2">
          <div class="vp-doc">
            <div class="vp-code-group">
              <div class="tabs">
                <input id="home-tab-pnpm" type="radio" name="home-code-group" checked>
                <label data-title="pnpm" for="home-tab-pnpm">pnpm</label>
                <input id="home-tab-yarn" type="radio" name="home-code-group">
                <label data-title="yarn" for="home-tab-yarn">yarn</label>
                <input id="home-tab-npm" type="radio" name="home-code-group">
                <label data-title="npm" for="home-tab-npm">npm</label>
                <input id="home-tab-bun" type="radio" name="home-code-group">
                <label data-title="bun" for="home-tab-bun">bun</label>
              </div>
              <div class="blocks">
                <div class="language-sh active">
                  <span class="lang">sh</span>
                  <pre><code>pnpm create weapp-vite@latest</code></pre>
                </div>
                <div class="language-sh">
                  <span class="lang">sh</span>
                  <pre><code>yarn create weapp-vite@latest</code></pre>
                </div>
                <div class="language-sh">
                  <span class="lang">sh</span>
                  <pre><code>npm create weapp-vite@latest</code></pre>
                </div>
                <div class="language-sh">
                  <span class="lang">sh</span>
                  <pre><code>bun create weapp-vite@latest</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CTA card -->
        <div class="relative rounded-2xl border border-emerald-500/30 bg-white/60 p-6 sm:p-8 text-center shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:bg-white/5">
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
          <!-- soft glow to make it less empty while staying subtle -->
          <div class="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-emerald-400/10 to-emerald-600/10 blur-xl" />
        </div>
      </div>
    </div>
  </section>

  <!-- End code demo + CTA -->
</template>
