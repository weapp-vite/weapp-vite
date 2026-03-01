<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref } from 'vue'
import TechBackground from './TechBackground.vue'

const props = withDefaults(defineProps<{
  entryPath?: string
  altPath?: string
}>(), {
  entryPath: '/ai',
  altPath: '/llms',
})
const { isDark } = useData()

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
  {
    title: '/guide/mcp',
    desc: 'MCP 专章：作用、启动方式、客户端接入与测试建议。',
    href: '/guide/mcp',
    badge: 'MCP Guide',
  },
  {
    title: '/packages/mcp',
    desc: '@weapp-vite/mcp 包能力说明与扩展入口。',
    href: '/packages/mcp',
    badge: 'Package Doc',
  },
])

const directSkills = [
  'weapp-vite-best-practices',
  'weapp-vite-vue-sfc-best-practices',
  'wevu-best-practices',
  'native-to-weapp-vite-wevu-migration',
]

const installPresets = [
  {
    title: '推荐（最短）',
    code: 'npx skills add sonofmagic/skills',
  },
  {
    title: '安装后可直接使用',
    code: directSkills.map(skill => `$${skill}`).join('\n'),
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
  <section class="ai-shell" :class="{ 'theme-dark': isDark }">
    <TechBackground class="ai-bg" :speed="0.28" :density="0.7" />

    <div class="ai-overlay" />

    <div class="ai-content">
      <header class="hero">
        <p class="hero-chip">
          <span class="hero-chip-dot" />
          weapp-vite AI Console
        </p>
        <h1>AI 学习入口 {{ props.entryPath }}</h1>
        <p class="hero-lead">
          先安装 Skills，再按索引和全文喂给 AI，能够最快进入可执行回答。
        </p>
        <div class="hero-actions">
          <a href="/llms.txt" target="_blank" rel="noopener noreferrer">打开 /llms.txt</a>
          <a href="/llms-full.txt" target="_blank" rel="noopener noreferrer">打开 /llms-full.txt</a>
          <a href="/llms-index.json" target="_blank" rel="noopener noreferrer">打开 /llms-index.json</a>
          <a href="/guide/mcp" target="_blank" rel="noopener noreferrer">打开 MCP 指南</a>
          <a :href="props.altPath" target="_blank" rel="noopener noreferrer">访问备用入口 {{ props.altPath }}</a>
        </div>
      </header>

      <section class="install-section spotlight" aria-label="skills install">
        <header class="section-head">
          <h2>Skills 安装命令与用法</h2>
          <p>优先执行安装命令，再用下方 4 个 Skill 名称直接调用。</p>
        </header>

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

        <div class="skill-usage">
          <p class="skill-usage-label">
            安装后可直接调用
          </p>
          <ul class="skill-usage-list">
            <li v-for="skill in directSkills" :key="skill">
              <code>${{ skill }}</code>
            </li>
          </ul>
        </div>
      </section>

      <div class="info-grid">
        <section class="resource-section" aria-label="AI resources">
          <header class="section-head">
            <h2>资源入口</h2>
            <p>所有链接均新开页面，便于对照阅读与持续提问。</p>
          </header>
          <div class="resource-grid">
            <a
              v-for="item in resources"
              :key="item.href"
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="resource-card"
            >
              <p class="resource-badge">{{ item.badge }}</p>
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
            </a>
          </div>
        </section>

        <section class="workflow-section" aria-label="workflow">
          <header class="section-head">
            <h2>推荐流程</h2>
            <p>按“索引 -> 全文 -> 技能”的顺序，能让上下文更干净。</p>
          </header>
          <div class="workflow">
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
              <h3>接入 MCP 服务</h3>
              <p>使用 <code>weapp-vite mcp</code> 连接仓库工具能力，让 AI 可以直接读取代码与执行验证命令。</p>
            </article>
            <article>
              <span>04</span>
              <h3>挂载专用 Skills</h3>
              <p>通过 <code>npx skills add sonofmagic/skills</code> 安装技能，让 AI 走统一工程流程回答。</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ai-shell {
  --ai-shell-bg:
    radial-gradient(circle at 14% 14%, rgb(56 189 248 / 18%), transparent 38%),
    radial-gradient(circle at 84% 20%, rgb(14 165 233 / 12%), transparent 36%),
    linear-gradient(165deg, #f7fbff 0%, #edf5ff 52%, #e6f0ff 100%);
  --ai-shell-border: rgb(96 165 250 / 30%);
  --ai-shell-shadow: 0 20px 48px rgb(15 23 42 / 18%);
  --ai-text: #18344f;
  --ai-text-strong: #0f2740;
  --ai-muted: rgb(41 76 109 / 86%);
  --ai-chip-bg: rgb(255 255 255 / 74%);
  --ai-chip-border: rgb(56 189 248 / 44%);
  --ai-chip-text: #0e7490;
  --ai-card-bg: linear-gradient(180deg, rgb(255 255 255 / 88%), rgb(244 250 255 / 92%));
  --ai-card-border: rgb(59 130 246 / 24%);
  --ai-card-title: #12345a;
  --ai-link-bg: rgb(255 255 255 / 86%);
  --ai-link-bg-hover: rgb(239 249 255 / 96%);
  --ai-link-border: rgb(56 189 248 / 34%);
  --ai-link-border-hover: rgb(14 165 233 / 56%);
  --ai-spot-bg: linear-gradient(135deg, rgb(220 242 255 / 88%), rgb(235 246 255 / 94%));
  --ai-spot-border: rgb(14 165 233 / 40%);
  --ai-code-bg: rgb(12 36 61 / 96%);
  --ai-code-border: rgb(14 116 144 / 40%);
  --ai-code-text: #e2f5ff;

  position: relative;
  min-height: calc(100vh - 186px);
  margin: 4px 0;
  overflow: hidden;
  color: var(--ai-text);
  background: var(--ai-shell-bg);
  border: 1px solid var(--ai-shell-border);
  border-radius: 24px;
  box-shadow: var(--ai-shell-shadow);
}

.ai-shell.theme-dark {
  --ai-shell-bg:
    radial-gradient(circle at 20% 20%, rgb(14 165 233 / 14%), transparent 45%),
    radial-gradient(circle at 85% 15%, rgb(59 130 246 / 12%), transparent 40%),
    linear-gradient(160deg, #03101f 0%, #071c33 48%, #0a2036 100%);
  --ai-shell-border: rgb(14 165 233 / 30%);
  --ai-shell-shadow: 0 24px 80px rgb(2 6 23 / 42%);
  --ai-text: #e6f2ff;
  --ai-text-strong: #f4fbff;
  --ai-muted: rgb(197 226 250 / 84%);
  --ai-chip-bg: rgb(3 20 36 / 72%);
  --ai-chip-border: rgb(125 211 252 / 38%);
  --ai-chip-text: #9fe7ff;
  --ai-card-bg: linear-gradient(180deg, rgb(7 30 54 / 78%), rgb(4 17 31 / 86%));
  --ai-card-border: rgb(147 197 253 / 24%);
  --ai-card-title: #eff8ff;
  --ai-link-bg: rgb(3 17 31 / 76%);
  --ai-link-bg-hover: rgb(10 34 58 / 88%);
  --ai-link-border: rgb(125 211 252 / 34%);
  --ai-link-border-hover: rgb(125 211 252 / 62%);
  --ai-spot-bg: linear-gradient(135deg, rgb(5 31 49 / 88%), rgb(3 16 30 / 92%));
  --ai-spot-border: rgb(34 211 238 / 42%);
  --ai-code-bg: rgb(2 10 18 / 94%);
  --ai-code-border: rgb(125 211 252 / 22%);
  --ai-code-text: #e8f7ff;
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
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 10px;
  max-width: 1120px;
  padding: 12px 14px;
  margin: 0 auto;
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.hero {
  padding: 12px;
  background: var(--ai-card-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 16px;
}

.hero-chip {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 5px 11px;
  margin: 0;
  font-size: 11px;
  color: var(--ai-chip-text);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--ai-chip-bg);
  border: 1px solid var(--ai-chip-border);
  border-radius: 999px;
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
  margin: 8px 0 4px;
  font-size: clamp(22px, 3.4vw, 36px);
  line-height: 1.1;
  color: var(--ai-text-strong);
  letter-spacing: 0.01em;
}

.hero-lead {
  max-width: 960px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ai-muted);
}

.hero-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.hero-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-strong);
  text-decoration: none;
  background: var(--ai-link-bg);
  border: 1px solid var(--ai-link-border);
  border-radius: 10px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

.hero-actions a:hover {
  background: var(--ai-link-bg-hover);
  border-color: var(--ai-link-border-hover);
  transform: translateY(-1px);
}

.spotlight {
  background: var(--ai-spot-bg);
  border-color: var(--ai-spot-border);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
}

.resource-section,
.workflow-section,
.install-section {
  padding: 10px;
  background: var(--ai-card-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 14px;
}

.section-head {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-head h2 {
  margin: 0;
  font-size: 21px;
  color: var(--ai-text-strong);
}

.section-head p {
  max-width: 500px;
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--ai-muted);
  text-align: right;
}

.info-grid {
  display: flex;
  gap: 10px;
  min-height: 0;
}

.resource-section {
  flex: 1.1;
}

.workflow-section {
  flex: 1;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.resource-card {
  display: block;
  min-height: 92px;
  padding: 10px;
  color: inherit;
  text-decoration: none;
  background: var(--ai-link-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 10px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.resource-card:hover {
  border-color: var(--ai-link-border-hover);
  transform: translateY(-2px);
}

.resource-badge {
  margin: 0;
  font-size: 11px;
  color: var(--ai-chip-text);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.resource-card h3 {
  margin: 4px 0 6px;
  font-size: 16px;
  color: var(--ai-card-title);
}

.resource-card p {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--ai-muted);
}

.workflow {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.workflow article {
  position: relative;
  padding: 10px 10px 10px 40px;
  background: var(--ai-link-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 10px;
}

.workflow span {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 10px;
  color: var(--ai-code-text);
  letter-spacing: 0.06em;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 999px;
}

.workflow h3 {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--ai-card-title);
}

.workflow p {
  margin: 0;
  font-size: 12px;
  line-height: 1.36;
  color: var(--ai-muted);
}

.workflow code {
  padding: 1px 6px;
  color: var(--ai-code-text);
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 6px;
}

.install-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 8px;
}

.install-card {
  padding: 10px;
  background: rgb(255 255 255 / 28%);
  border: 1px solid var(--ai-card-border);
  border-radius: 10px;
}

.install-card h3 {
  margin: 0;
  font-size: 14px;
  color: var(--ai-card-title);
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
  font-size: 11px;
  line-height: 1;
  color: var(--ai-code-text);
  cursor: pointer;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 8px;
  transition:
    border-color 180ms ease,
    background-color 180ms ease;
}

.install-card button:hover {
  border-color: var(--ai-link-border-hover);
}

.install-card pre {
  padding: 10px;
  margin: 0;
  overflow-x: auto;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 8px;
}

.install-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ai-code-text);
}

.skill-usage {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 8px;
}

.skill-usage-label {
  flex-shrink: 0;
  padding: 5px 10px;
  margin: 0;
  font-size: 11px;
  color: var(--ai-chip-text);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--ai-chip-bg);
  border: 1px solid var(--ai-chip-border);
  border-radius: 999px;
}

.skill-usage-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.skill-usage-list code {
  display: inline-flex;
  padding: 5px 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  color: var(--ai-code-text);
  overflow-wrap: anywhere;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 999px;
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
  .hero-actions,
  .install-grid,
  .resource-grid,
  .info-grid {
    grid-template-columns: 1fr;
  }

  .ai-shell {
    min-height: 0;
    margin: 4px 0 14px;
  }

  .ai-content {
    display: block;
    height: auto;
    padding: 14px;
  }

  .install-grid,
  .info-grid {
    display: grid;
  }

  .skill-usage {
    flex-direction: column;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-head p {
    text-align: left;
  }

  .ai-content {
    padding: 22px 16px 18px;
  }

  .hero h1 {
    font-size: clamp(24px, 8.6vw, 34px);
  }
}
</style>
