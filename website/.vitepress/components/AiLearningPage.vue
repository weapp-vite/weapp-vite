<script setup lang="ts">
import { computed, ref } from 'vue'
import TechBackground from './TechBackground.vue'

const props = withDefaults(defineProps<{
  entryPath?: string
  altPath?: string
}>(), {
  entryPath: '/ai',
  altPath: '/llms',
})

const resources = computed(() => [
  {
    title: '/llms.txt',
    desc: '轻量索引入口，适合作为对话起点。',
    href: '/llms.txt',
    badge: 'Quick Index',
  },
  {
    title: '/llms-full.txt',
    desc: '完整文档语料，适合检索与向量化。',
    href: '/llms-full.txt',
    badge: 'Full Corpus',
  },
  {
    title: '/llms-index.json',
    desc: '结构化索引，包含标题、摘要、关键词、章节与来源路径。',
    href: '/llms-index.json',
    badge: 'Structured Index',
  },
  {
    title: props.altPath,
    desc: `备用入口 ${props.altPath}，可与当前地址互跳。`,
    href: props.altPath,
    badge: 'Alt Entry',
  },
])

const installPresets = [
  {
    title: '推荐（最短）',
    code: 'npx skills add sonofmagic/skills',
  },
  {
    title: '安装后可直接使用',
    code: '$weapp-vite-best-practices\n$weapp-vite-vue-sfc-best-practices\n$wevu-best-practices',
  },
]

const copiedInstallIndex = ref<number | null>(null)

function copyInstallCommand(code: string, index: number) {
  const normalizedCode = code.replace(/^\$/gm, '')
  const onSuccess = () => {
    copiedInstallIndex.value = index
    setTimeout(() => {
      if (copiedInstallIndex.value === index) {
        copiedInstallIndex.value = null
      }
    }, 1400)
  }
  const fallbackCopy = () => {
    const textarea = document.createElement('textarea')
    textarea.value = normalizedCode
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (copied) {
      onSuccess()
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(normalizedCode).then(onSuccess).catch(fallbackCopy)
    return
  }

  fallbackCopy()
}
</script>

<template>
  <section class="ai-shell">
    <TechBackground class="ai-bg" :speed="0.28" :density="0.7" />

    <div class="ai-overlay" />

    <div class="ai-content">
      <header class="hero">
        <p class="hero-chip">
          <span class="hero-chip-dot" />
          Weapp-vite AI Console
        </p>
        <h1>AI 学习入口 {{ props.entryPath }}</h1>
        <p class="hero-lead">
          用统一入口快速喂给 AI 可检索文档、最佳实践 Skill 与可执行安装命令。
        </p>
        <div class="hero-actions">
          <a href="/llms.txt" target="_blank" rel="noopener noreferrer">打开 /llms.txt</a>
          <a href="/llms-full.txt" target="_blank" rel="noopener noreferrer">打开 /llms-full.txt</a>
          <a href="/llms-index.json" target="_blank" rel="noopener noreferrer">打开 /llms-index.json</a>
          <a :href="props.altPath" target="_blank" rel="noopener noreferrer">访问备用入口 {{ props.altPath }}</a>
        </div>
      </header>

      <section class="resource-grid" aria-label="AI resources">
        <a
          v-for="item in resources"
          :key="item.href"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="resource-card"
        >
          <p class="resource-badge">{{ item.badge }}</p>
          <h2>{{ item.title }}</h2>
          <p>{{ item.desc }}</p>
        </a>
      </section>

      <section class="workflow" aria-label="workflow">
        <article>
          <span>01</span>
          <h3>先读取索引</h3>
          <p>对话开始时先加载 <code>/llms.txt</code>，建立目录级语义地图。</p>
        </article>
        <article>
          <span>02</span>
          <h3>再按需拉全文</h3>
          <p>定位到主题后，针对性读取 <code>/llms-full.txt</code>，减少无效上下文。</p>
        </article>
        <article>
          <span>03</span>
          <h3>挂载专用 Skills</h3>
          <p>通过 <code>npx skills add sonofmagic/skills</code> 安装技能，让 AI 走统一工程流程回答。</p>
        </article>
      </section>

      <section class="install-section" aria-label="skills install">
        <h2>Skills 安装命令</h2>
        <div class="install-grid">
          <article v-for="(cmd, index) in installPresets" :key="cmd.title" class="install-card">
            <header class="install-card-header">
              <h3>{{ cmd.title }}</h3>
              <button type="button" @click="copyInstallCommand(cmd.code, index)">
                {{ copiedInstallIndex === index ? '已复制' : '复制命令' }}
              </button>
            </header>
            <pre><code>{{ cmd.code }}</code></pre>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ai-shell {
  position: relative;
  margin: 8px 0 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 20%, rgb(14 165 233 / 14%), transparent 45%),
    radial-gradient(circle at 85% 15%, rgb(59 130 246 / 12%), transparent 40%),
    linear-gradient(160deg, #03101f 0%, #071c33 48%, #0a2036 100%);
  border: 1px solid rgb(14 165 233 / 28%);
  border-radius: 24px;
  box-shadow: 0 24px 80px rgb(2 6 23 / 42%);
}

.ai-bg {
  position: absolute;
  inset: 0;
  opacity: 0.42;
}

.ai-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, rgb(14 165 233 / 10%), transparent 28%),
    linear-gradient(300deg, rgb(16 185 129 / 8%), transparent 34%);
}

.ai-content {
  position: relative;
  z-index: 1;
  max-width: 1100px;
  padding: 32px 26px 28px;
  margin: 0 auto;
  color: #e6f2ff;
}

.hero {
  position: relative;
  margin-bottom: 24px;
}

.hero-chip {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 6px 12px;
  margin: 0;
  font-size: 12px;
  color: #9fe7ff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgb(3 20 36 / 72%);
  border: 1px solid rgb(125 211 252 / 38%);
  border-radius: 999px;
  backdrop-filter: blur(6px);
}

.hero-chip-dot {
  width: 8px;
  height: 8px;
  background: #22d3ee;
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgb(34 211 238 / 16%);
  animation: signal 2.2s ease-in-out infinite;
}

.hero h1 {
  margin: 14px 0 10px;
  font-size: clamp(30px, 5.2vw, 48px);
  line-height: 1.05;
  color: #f4fbff;
  letter-spacing: 0.01em;
}

.hero-lead {
  max-width: 800px;
  margin: 0;
  font-size: 16px;
  color: rgb(203 231 255 / 88%);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.hero-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #d4efff;
  text-decoration: none;
  background: rgb(3 17 31 / 66%);
  border: 1px solid rgb(125 211 252 / 30%);
  border-radius: 12px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.hero-actions a:hover {
  background: rgb(8 28 49 / 85%);
  border-color: rgb(125 211 252 / 58%);
  transform: translateY(-1px);
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.resource-card {
  display: block;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  background: linear-gradient(180deg, rgb(7 30 54 / 82%), rgb(4 17 31 / 86%));
  border: 1px solid rgb(147 197 253 / 26%);
  border-radius: 14px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.resource-card:hover {
  border-color: rgb(125 211 252 / 56%);
  box-shadow: 0 12px 24px rgb(2 12 27 / 40%);
  transform: translateY(-2px);
}

.resource-badge {
  margin: 0;
  font-size: 11px;
  color: #7dd3fc;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.resource-card h2 {
  margin: 6px 0;
  font-size: 20px;
  color: #eff8ff;
}

.resource-card p {
  margin: 0;
  font-size: 13px;
  color: rgb(196 226 255 / 84%);
}

.workflow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.workflow article {
  padding: 14px;
  background: rgb(5 20 35 / 78%);
  border: 1px solid rgb(125 211 252 / 24%);
  border-radius: 14px;
}

.workflow span {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  color: #67e8f9;
  letter-spacing: 0.08em;
}

.workflow h3 {
  margin: 6px 0;
  font-size: 18px;
  color: #eef8ff;
}

.workflow p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: rgb(194 224 250 / 86%);
}

.workflow code {
  padding: 1px 6px;
  color: #ccf4ff;
  background: rgb(15 41 66 / 88%);
  border: 1px solid rgb(125 211 252 / 24%);
  border-radius: 6px;
}

.install-section h2 {
  margin: 0 0 12px;
  font-size: 24px;
  color: #f3fbff;
}

.install-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.install-card {
  padding: 14px;
  background: linear-gradient(180deg, rgb(4 16 29 / 92%), rgb(4 14 24 / 94%));
  border: 1px solid rgb(165 243 252 / 22%);
  border-radius: 14px;
}

.install-card h3 {
  margin: 0;
  font-size: 14px;
  color: #b7e8ff;
}

.install-card-header {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.install-card button {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1;
  color: #cff4ff;
  cursor: pointer;
  background: rgb(8 34 53 / 88%);
  border: 1px solid rgb(125 211 252 / 36%);
  border-radius: 8px;
  transition:
    border-color 180ms ease,
    background-color 180ms ease;
}

.install-card button:hover {
  background: rgb(10 41 64 / 92%);
  border-color: rgb(125 211 252 / 58%);
}

.install-card pre {
  padding: 12px;
  margin: 0;
  overflow-x: auto;
  background: rgb(2 10 18 / 94%);
  border: 1px solid rgb(125 211 252 / 18%);
  border-radius: 10px;
}

.install-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e8f7ff;
}

@keyframes signal {
  0%,
  100% {
    opacity: 0.9;
  }

  50% {
    opacity: 0.35;
  }
}

@media (width <= 1024px) {
  .resource-grid,
  .workflow,
  .install-grid {
    grid-template-columns: 1fr;
  }

  .ai-content {
    padding: 22px 16px 18px;
  }

  .hero h1 {
    font-size: clamp(26px, 9vw, 38px);
  }
}
</style>
