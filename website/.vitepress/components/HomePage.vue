<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import TechBackground from './TechBackground.vue'

const { isDark } = useData()
const glowClass = computed(() => (isDark.value ? 'from-emerald-500/25 to-lime-400/20' : 'from-emerald-400/25 to-emerald-300/15'))
const heroKeywordTextClass = computed(() => (isDark.value ? 'text-zinc-100' : 'text-zinc-800'))
const heroKeywordChipToneClass = computed(() => (
  isDark.value
    ? 'border-emerald-300/45 bg-slate-900/75 text-emerald-50 shadow-[0_10px_20px_rgba(2,6,23,0.28)]'
    : 'border-emerald-500/20 bg-white/90 text-zinc-800 shadow-[0_6px_14px_rgba(16,185,129,0.1)]'
))

interface HomeFeatureCard {
  href: string
  icon: string
  title: string
  packageName: string
  description: string
}

const packageFeatureCards: HomeFeatureCard[] = [
  {
    href: '/packages/create-weapp-vite',
    icon: '🚀',
    title: '官方脚手架',
    packageName: 'create-weapp-vite',
    description: '内置 default / Wevu / tailwindcss / tdesign 等模板，快速创建并对齐依赖组合。',
  },
  {
    href: '/wevu/',
    icon: '⚡',
    title: '轻量运行时',
    packageName: 'Wevu',
    description: '提供 Vue 3 风格响应式与 Store，采用快照 diff 策略，尽量减少 setData 更新。',
  },
  {
    href: '/packages/wevu-compiler',
    icon: '🧩',
    title: '编译能力底座',
    packageName: '@wevu/compiler',
    description: '独立复用 SFC script/template/style/config 编译链，支持页面特性分析与注入。',
  },
  {
    href: '/packages/rolldown-require/index.zh',
    icon: '🧠',
    title: '配置加载引擎',
    packageName: 'rolldown-require',
    description: '基于 Rolldown 的 bundle + require，支持 ts/mjs/cjs 配置加载，适配 CLI 与 Node 脚本。',
  },
  {
    href: '/packages/weapp-ide-cli',
    icon: '🤖',
    title: '开发者工具自动化',
    packageName: 'weapp-ide-cli',
    description: '增强 open / preview / upload 命令，补齐路径与非交互参数，便于本地脚本和 CI。',
  },
  {
    href: '/packages/',
    icon: '📦',
    title: '工具链能力矩阵',
    packageName: 'rolldown-require / vite-plugin-performance / volar / web / mcp',
    description: '覆盖配置加载、插件性能分析、编辑器智能提示与实验运行时，按场景自由组合。',
  },
]
</script>

<template>
  <section class="relative overflow-hidden isolate home-hero">
    <!-- Animated background -->
    <TechBackground class="absolute inset-0" :speed="0.35" :density="0.9" />

    <!-- Hero -->
    <div class="relative z-10 mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:py-28">
      <div class="mx-auto max-w-3xl text-center hero-reveal">
        <div
          class="hero-chip inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-600 dark:text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_8px_24px_rgba(16,185,129,0.15)]"
        >
          <span class="i-mdi-lightning-bolt text-emerald-500" />
          现代小程序工程化
        </div>
        <h1
          class="mt-6 bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 dark:from-emerald-400 dark:via-lime-300 dark:to-emerald-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl"
        >
          Weapp‑vite
        </h1>
        <div class="hero-logo-formula" aria-label="Vue + Vite + Rolldown = weapp-vite">
          <span class="hero-logo-badge">
            <span class="i-vscode-icons-file-type-vue h-[18px] w-[18px]" aria-hidden="true" />
            <span>Vue</span>
          </span>
          <span class="hero-logo-sign">+</span>
          <span class="hero-logo-badge">
            <span class="i-vscode-icons-file-type-vite h-[18px] w-[18px] shrink-0 dark:brightness-110 dark:saturate-125" aria-hidden="true" />
            <span>Vite</span>
          </span>
          <span class="hero-logo-sign">+</span>
          <span class="hero-logo-badge">
            <span class="i-vscode-icons-file-type-rolldown h-[18px] w-[18px] shrink-0 dark:brightness-115 dark:saturate-120" aria-hidden="true" />
            <span>Rolldown</span>
          </span>
          <span class="hero-logo-sign">=</span>
          <span class="hero-logo-badge hero-logo-badge-target">
            <img src="/logo.svg" alt="weapp-vite logo" class="h-[18px] w-[18px] object-contain">
            <span>Weapp‑vite</span>
          </span>
        </div>
        <p class="mt-5 text-balance text-base/7 text-zinc-700 dark:text-zinc-300 sm:text-lg/8">
          把现代化的开发模式带入小程序开发：极速热更、类型安全、插件生态、原子化样式与工程化能力，一站式串联。
        </p>
        <div class="mt-8 flex items-center justify-center gap-3">
          <a
            class="group relative inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-600/20 px-5 py-3 text-sm font-semibold text-emerald-900 dark:text-emerald-50 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_24px_rgba(16,185,129,0.25)] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.5)_inset,0_16px_40px_rgba(16,185,129,0.35)] transition interactive-cta"
            href="/guide/"
          >
            <span class="i-mdi-rocket-launch-outline text-lg text-emerald-600 dark:text-emerald-300" />
            快速开始
            <span
              class="absolute -inset-px -z-10 rounded-xl bg-gradient-to-r from-emerald-400/20 via-lime-300/20 to-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition"
            />
          </a>
          <a
            class="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-white/80 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_24px_rgba(16,185,129,0.15)] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.5)_inset,0_14px_36px_rgba(16,185,129,0.25)] transition interactive-cta dark:border-emerald-300/40 dark:bg-white/10 dark:text-emerald-50"
            href="/ai"
          >
            <span class="i-bi-openai text-lg" />
            AI 学习入口
          </a>
          <a class="inline-flex items-center gap-2 rounded-xl border border-zinc-400/40 px-5 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-900/5 dark:hover:bg-white/5 transition interactive-cta" href="https://github.com/weapp-vite/weapp-vite" target="_blank" rel="noreferrer">
            <span class="i-mdi-github text-lg" /> GitHub
          </a>
        </div>
        <div class="hero-keywords mt-6 flex flex-wrap items-center justify-center gap-2 text-xs" :class="heroKeywordTextClass">
          <span class="hero-keyword-chip" :class="heroKeywordChipToneClass">
            TypeScript/ESM
          </span>
          <span class="hero-keyword-chip" :class="heroKeywordChipToneClass">
            Vite / Rolldown 插件
          </span>
          <span class="hero-keyword-chip" :class="heroKeywordChipToneClass">
            自动构建 npm
          </span>
          <span class="hero-keyword-chip" :class="heroKeywordChipToneClass">
            自动引入组件
          </span>
        </div>
      </div>
    </div>

    <!-- gradient glows -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden blur-2xl floating-glow">
      <div class="mx-auto h-64 w-[40rem] rounded-full bg-gradient-to-tr" :class="glowClass" />
    </div>
  </section>

  <!-- Features -->
  <section class="relative feature-section">
    <div class="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]">
      <div class="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
    </div>
    <div class="mx-auto max-w-7xl px-6 py-8 sm:py-12">
      <div class="feature-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <a
          v-for="(feature, featureIndex) in packageFeatureCards"
          :key="feature.title"
          :href="feature.href"
          class="feature-card group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:border-emerald-300/20 dark:bg-white/5"
          :style="{ '--card-index': featureIndex }"
        >
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              {{ feature.icon }}
            </div>
            <div>
              <h3 class="text-lg font-semibold">{{ feature.title }}</h3>
              <p class="text-[11px] font-semibold tracking-wide text-emerald-700/90 dark:text-emerald-200/90">
                {{ feature.packageName }}
              </p>
            </div>
          </div>
          <p class="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{{ feature.description }}</p>
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
        <div class="cta-card relative rounded-2xl border border-emerald-500/30 bg-white/60 p-6 sm:p-8 text-center shadow-[0_0_0_1px_rgba(16,185,129,0.15)_inset,0_10px_30px_rgba(16,185,129,0.12)] dark:bg-white/5">
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

<style scoped lang="scss">
.home-hero {
  position: relative;
}

.hero-reveal > * {
  opacity: 0;
  transform: translateY(12px);
  animation: fade-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.hero-reveal > *:nth-child(1) {
  animation-delay: 0.05s;
}

.hero-reveal > *:nth-child(2) {
  animation-delay: 0.12s;
}

.hero-reveal > *:nth-child(3) {
  animation-delay: 0.18s;
}

.hero-reveal > *:nth-child(4) {
  animation-delay: 0.26s;
}

.hero-reveal > *:nth-child(5) {
  animation-delay: 0.34s;
}

.hero-chip {
  animation: gentle-pulse 9s ease-in-out infinite;
}

.hero-logo-formula {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
}

.hero-logo-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(6 95 70);
  letter-spacing: 0.01em;
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(16 185 129 / 22%);
  border-radius: 999px;
  box-shadow: 0 6px 18px rgb(16 185 129 / 12%);
}

.hero-logo-sign {
  font-size: 12px;
  font-weight: 800;
  color: rgb(5 150 105);
}

.hero-logo-badge-target {
  color: rgb(6 78 59);
  background: linear-gradient(180deg, rgb(209 250 229 / 92%), rgb(187 247 208 / 72%));
  border-color: rgb(16 185 129 / 35%);
}

:global(html.dark) .hero-logo-badge {
  color: rgb(209 250 229 / 96%);
  background: rgb(6 46 35 / 72%);
  border-color: rgb(16 185 129 / 38%);
  box-shadow: 0 10px 24px rgb(3 10 8 / 30%);
}

:global(html.dark) .hero-logo-sign {
  color: rgb(110 231 183 / 92%);
}

:global(html.dark) .hero-logo-badge-target {
  color: rgb(236 253 245);
  background: linear-gradient(180deg, rgb(6 95 70 / 62%), rgb(4 47 46 / 68%));
  border-color: rgb(110 231 183 / 52%);
}

.hero-keyword-chip {
  padding: 4px 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: 999px;
}

.interactive-cta {
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms ease,
    filter 220ms ease;
}

.interactive-cta:hover {
  box-shadow: 0 10px 28px rgb(16 185 129 / 20%);
  filter: drop-shadow(0 10px 25px rgb(16 185 129 / 15%));
  transform: translateY(-1px) scale(1.01);
}

.floating-glow > div {
  animation: slow-pulse 14s ease-in-out infinite;
}

.feature-section {
  .feature-grid {
    --card-stagger: 90ms;
  }

  .feature-card {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    opacity: 0;
    transform: translateY(12px) scale(0.995);
    transition:
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 260ms ease,
      border-color 260ms ease,
      background-color 260ms ease;
    animation: fade-rise 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: calc(var(--card-index, 0) * var(--card-stagger) + 0.18s);
  }

  .feature-card::after {
    position: absolute;
    inset: -30% auto auto -30%;
    z-index: -1;
    width: 60%;
    height: 60%;
    pointer-events: none;
    content: '';
    background: radial-gradient(circle, rgb(16 185 129 / 20%), transparent 60%);
    opacity: 0;
    filter: blur(32px);
    transform: t ranslate3d(0, 0, 0);
    transition: opacity 240ms ease;
    animation: orbit 18s linear infinite;
  }

  .feature-card:hover {
    border-color: rgb(16 185 129 / 50%);
    box-shadow:
      0 14px 36px rgb(16 185 129 / 16%),
      0 18px 40px rgb(0 0 0 / 8%);
    transform: translateY(-6px) scale(1.01);
  }

  .feature-card:hover::after {
    opacity: 1;
  }

  .feature-card :deep(div.rounded-lg) {
    transition:
      transform 220ms ease,
      filter 220ms ease;
  }

  .feature-card:hover :deep(div.rounded-lg) {
    filter: drop-shadow(0 10px 20px rgb(16 185 129 / 30%));
    transform: translateY(-2px) scale(1.05);
  }
}

.cta-card {
  overflow: hidden;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 260ms ease;
}

.cta-card::after {
  position: absolute;
  inset: 12%;
  z-index: -1;
  pointer-events: none;
  content: '';
  background: conic-gradient(from 120deg, rgb(16 185 129 / 16%), rgb(190 242 100 / 12%), rgb(16 185 129 / 16%));
  border-radius: 28px;
  opacity: 0.75;
  filter: blur(26px);
  animation: slow-pan 16s ease-in-out infinite;
}

.cta-card:hover {
  box-shadow:
    0 16px 36px rgb(16 185 129 / 18%),
    0 16px 40px rgb(0 0 0 / 8%);
  transform: translateY(-4px);
}

@keyframes fade-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.99);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes gentle-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgb(16 185 129 / 15%) inset,
      0 8px 24px rgb(16 185 129 / 15%);
  }

  50% {
    box-shadow:
      0 0 0 1px rgb(16 185 129 / 30%) inset,
      0 14px 36px rgb(16 185 129 / 22%);
  }
}

@keyframes slow-pulse {
  0%,
  100% {
    filter: blur(32px);
    transform: translate3d(0, -6px, 0) scale(1);
  }

  50% {
    filter: blur(42px);
    transform: translate3d(0, 8px, 0) scale(1.05);
  }
}

@keyframes orbit {
  from {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  to {
    transform: translate3d(0, 0, 0) rotate(360deg);
  }
}

@keyframes slow-pan {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }

  50% {
    transform: rotate(5deg) scale(1.03);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-reveal > *,
  .feature-card,
  .floating-glow > div,
  .hero-chip,
  .cta-card::after {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }

  .interactive-cta,
  .feature-card,
  .cta-card {
    transition: none !important;
  }
}
</style>
