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

const mcpActions = [
  {
    title: '/guide/mcp',
    desc: '作用、启动、客户端接入与测试建议。',
    href: '/guide/mcp',
  },
  {
    title: '/packages/mcp',
    desc: '@weapp-vite/mcp 包能力与扩展入口。',
    href: '/packages/mcp',
  },
  {
    title: '/guide/cli#mcp',
    desc: 'weapp-vite mcp 命令参数与模式说明。',
    href: '/guide/cli',
  },
]

const mcpCommands = [
  {
    title: 'stdio（推荐）',
    code: 'weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite',
    key: 'mcp-stdio',
  },
  {
    title: 'streamable-http（URL 连接）',
    code: 'weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp --workspace-root /absolute/path/to/weapp-vite',
    key: 'mcp-http',
  },
]

const directSkills = [
  'weapp-vite-best-practices',
  'weapp-vite-vue-sfc-best-practices',
  'wevu-best-practices',
  'native-to-weapp-vite-wevu-migration',
]

const skillInstallCommand = 'npx skills add sonofmagic/skills'
const skillDirectCommand = computed(() => directSkills.map(skill => `$${skill}`).join('\n'))

const llmsResources = computed(() => [
  {
    title: '/llms.txt',
    desc: '轻量索引，适合作为对话起点。',
    href: '/llms.txt',
  },
  {
    title: '/llms-full.txt',
    desc: '完整语料，适合检索与向量化。',
    href: '/llms-full.txt',
  },
  {
    title: '/llms-index.json',
    desc: '结构化索引，便于工具链消费。',
    href: '/llms-index.json',
  },
  {
    title: props.altPath,
    desc: `当前入口的备用地址 ${props.altPath}。`,
    href: props.altPath,
  },
])

const copiedKey = ref<string | null>(null)

function copyText(text: string, key: string) {
  const normalizedText = text.replace(/^\$/gm, '')

  const markCopied = () => {
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) {
        copiedKey.value = null
      }
    }, 1400)
  }

  const fallbackCopy = () => {
    const textarea = document.createElement('textarea')
    textarea.value = normalizedText
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (copied) {
      markCopied()
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(normalizedText).then(markCopied).catch(fallbackCopy)
    return
  }

  fallbackCopy()
}
</script>

<template>
  <section class="ai-shell" :class="{ 'theme-dark': isDark }">
    <TechBackground class="ai-bg" :speed="0.28" :density="0.65" />
    <div class="ai-overlay" />

    <div class="ai-content">
      <header class="hero">
        <p class="hero-chip">
          <span class="hero-chip-dot" />
          weapp-vite ai console
        </p>
        <h1>AI 学习入口 {{ props.entryPath }}</h1>
        <p class="hero-lead">
          以三条主线组织：MCP 连接能力、Skill 统一工程实践、LLMS 喂给上下文。
        </p>
        <nav class="hero-nav">
          <a href="#mcp-pillar">MCP</a>
          <a href="#skill-pillar">Skill</a>
          <a href="#llms-pillar">LLMS</a>
        </nav>
      </header>

      <div class="pillar-grid">
        <section id="mcp-pillar" class="pillar" aria-label="mcp pillar">
          <header class="pillar-head">
            <p class="pillar-kicker">
              MCP
            </p>
            <h2>让 AI 能读代码并执行验证</h2>
            <p>先接入服务，再让 AI 调 tools，避免纯口头建议。</p>
          </header>

          <div class="link-grid">
            <a
              v-for="item in mcpActions"
              :key="item.href"
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="link-card"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </a>
          </div>

          <div class="command-stack">
            <article v-for="cmd in mcpCommands" :key="cmd.key" class="command-card">
              <header>
                <h3>{{ cmd.title }}</h3>
                <button type="button" @click="copyText(cmd.code, cmd.key)">
                  {{ copiedKey === cmd.key ? '已复制' : '复制命令' }}
                </button>
              </header>
              <pre><code>{{ cmd.code }}</code></pre>
            </article>
          </div>

          <ol class="flow-list">
            <li>先配置客户端，确认 `tools/list` 能看到 MCP tools。</li>
            <li>再按需调用 `search_source_code` / `read_source_file`。</li>
            <li>最后执行脚本或 CLI，形成可验证闭环。</li>
          </ol>
        </section>

        <section id="skill-pillar" class="pillar pillar-spot" aria-label="skill pillar">
          <header class="pillar-head">
            <p class="pillar-kicker">
              Skill
            </p>
            <h2>给 AI 挂载工程化工作流</h2>
            <p>统一技能入口，让团队在同一套规则下协作与交付。</p>
          </header>

          <div class="command-stack">
            <article class="command-card">
              <header>
                <h3>安装 Skills（推荐）</h3>
                <button type="button" @click="copyText(skillInstallCommand, 'skill-install')">
                  {{ copiedKey === 'skill-install' ? '已复制' : '复制命令' }}
                </button>
              </header>
              <pre><code>{{ skillInstallCommand }}</code></pre>
            </article>

            <article class="command-card">
              <header>
                <h3>安装后可直接调用</h3>
                <button type="button" @click="copyText(skillDirectCommand, 'skill-direct')">
                  {{ copiedKey === 'skill-direct' ? '已复制' : '复制命令' }}
                </button>
              </header>
              <pre><code>{{ skillDirectCommand }}</code></pre>
            </article>
          </div>

          <ul class="chip-list">
            <li v-for="skill in directSkills" :key="skill">
              <code>${{ skill }}</code>
            </li>
          </ul>

          <ol class="flow-list">
            <li>先安装 `sonofmagic/skills`，再进入具体任务。</li>
            <li>让 AI 明确调用对应 Skill，减少自由发挥偏差。</li>
            <li>配合 MCP 让结果从“建议”变成“可执行 + 可验收”。</li>
          </ol>
        </section>

        <section id="llms-pillar" class="pillar" aria-label="llms pillar">
          <header class="pillar-head">
            <p class="pillar-kicker">
              LLMS
            </p>
            <h2>为模型提供稳定、完整上下文</h2>
            <p>按“索引 -> 全文 -> 结构化索引”逐层加载，降低噪声。</p>
          </header>

          <div class="link-grid link-grid-llms">
            <a
              v-for="resource in llmsResources"
              :key="resource.href"
              :href="resource.href"
              target="_blank"
              rel="noopener noreferrer"
              class="link-card"
            >
              <strong>{{ resource.title }}</strong>
              <span>{{ resource.desc }}</span>
            </a>
          </div>

          <article class="command-card">
            <header>
              <h3>推荐喂给顺序</h3>
            </header>
            <pre><code>1) /llms.txt
2) /llms-full.txt
3) /llms-index.json
4) 结合 MCP tools 继续定位与验证</code></pre>
          </article>

          <ol class="flow-list">
            <li>开场加载 `/llms.txt` 建立目录语义。</li>
            <li>命中主题后再读取 `/llms-full.txt` 深入细节。</li>
            <li>工具链或脚本联动时优先消费 `/llms-index.json`。</li>
          </ol>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ai-shell {
  --ai-shell-bg:
    radial-gradient(circle at 16% 12%, rgb(34 197 94 / 14%), transparent 36%),
    radial-gradient(circle at 82% 20%, rgb(14 165 233 / 16%), transparent 40%),
    linear-gradient(160deg, #f4faf8 0%, #edf6ff 50%, #e9f1ff 100%);
  --ai-shell-border: rgb(96 165 250 / 26%);
  --ai-shell-shadow: 0 20px 46px rgb(15 23 42 / 14%);
  --ai-text: #173454;
  --ai-text-strong: #0e2740;
  --ai-muted: rgb(35 72 107 / 84%);
  --ai-card-bg: linear-gradient(180deg, rgb(255 255 255 / 88%), rgb(245 250 255 / 92%));
  --ai-card-border: rgb(59 130 246 / 22%);
  --ai-card-hover: rgb(239 249 255 / 96%);
  --ai-chip-bg: rgb(255 255 255 / 78%);
  --ai-chip-border: rgb(125 211 252 / 46%);
  --ai-chip-text: #0c7ba0;
  --ai-code-bg: rgb(11 36 63 / 96%);
  --ai-code-border: rgb(14 116 144 / 38%);
  --ai-code-text: #e4f7ff;

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
    radial-gradient(circle at 18% 15%, rgb(16 185 129 / 14%), transparent 42%),
    radial-gradient(circle at 82% 18%, rgb(59 130 246 / 14%), transparent 40%),
    linear-gradient(158deg, #061321 0%, #0a1d34 52%, #0d2136 100%);
  --ai-shell-border: rgb(125 211 252 / 26%);
  --ai-shell-shadow: 0 28px 82px rgb(2 6 23 / 44%);
  --ai-text: #e9f3ff;
  --ai-text-strong: #f7fbff;
  --ai-muted: rgb(191 220 244 / 86%);
  --ai-card-bg: linear-gradient(180deg, rgb(7 29 50 / 80%), rgb(4 16 30 / 86%));
  --ai-card-border: rgb(147 197 253 / 24%);
  --ai-card-hover: rgb(10 34 58 / 90%);
  --ai-chip-bg: rgb(4 21 36 / 78%);
  --ai-chip-border: rgb(125 211 252 / 40%);
  --ai-chip-text: #9fe7ff;
  --ai-code-bg: rgb(3 11 20 / 95%);
  --ai-code-border: rgb(125 211 252 / 24%);
  --ai-code-text: #e9f8ff;
}

.ai-bg {
  position: absolute;
  inset: 0;
  opacity: 0.44;
}

.ai-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, rgb(14 165 233 / 8%), transparent 28%),
    linear-gradient(300deg, rgb(16 185 129 / 8%), transparent 34%);
}

.ai-content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  max-width: 1180px;
  padding: 14px;
  margin: 0 auto;
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.hero,
.pillar {
  padding: 14px;
  background: var(--ai-card-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 16px;
}

.hero-chip {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 5px 12px;
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
}

.hero h1 {
  margin: 10px 0 6px;
  font-size: clamp(24px, 3.5vw, 38px);
  line-height: 1.08;
  color: var(--ai-text-strong);
}

.hero-lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.46;
  color: var(--ai-muted);
}

.hero-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.hero-nav a,
.link-card {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 8px 11px;
  color: var(--ai-text-strong);
  text-decoration: none;
  background: var(--ai-chip-bg);
  border: 1px solid var(--ai-card-border);
  border-radius: 10px;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.hero-nav a:hover,
.link-card:hover {
  background: var(--ai-card-hover);
  border-color: var(--ai-chip-border);
  transform: translateY(-1px);
}

.pillar-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.pillar-spot {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 8%);
}

.pillar-head {
  margin-bottom: 10px;
}

.pillar-kicker {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--ai-chip-text);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.pillar-head h2 {
  margin: 4px 0;
  font-size: 20px;
  line-height: 1.2;
  color: var(--ai-text-strong);
}

.pillar-head p {
  margin: 0;
  font-size: 13px;
  line-height: 1.42;
  color: var(--ai-muted);
}

.link-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}

.link-card {
  display: grid;
  gap: 4px;
}

.link-card strong {
  font-size: 14px;
}

.link-card span {
  font-size: 12px;
  line-height: 1.34;
  color: var(--ai-muted);
}

.command-stack {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}

.command-card {
  padding: 10px;
  background: rgb(255 255 255 / 26%);
  border: 1px solid var(--ai-card-border);
  border-radius: 12px;
}

.command-card header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.command-card h3 {
  margin: 0;
  font-size: 14px;
  color: var(--ai-text-strong);
}

.command-card button {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1;
  color: var(--ai-code-text);
  cursor: pointer;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 8px;
}

.command-card pre {
  padding: 10px;
  margin: 0;
  overflow-x: auto;
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 8px;
}

.command-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ai-code-text);
}

.chip-list,
.flow-list {
  margin: 0;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0;
  list-style: none;
}

.chip-list code {
  display: inline-flex;
  padding: 5px 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  color: var(--ai-code-text);
  background: var(--ai-code-bg);
  border: 1px solid var(--ai-code-border);
  border-radius: 999px;
}

.flow-list {
  display: grid;
  gap: 6px;
  padding-left: 18px;
}

.flow-list li {
  font-size: 13px;
  line-height: 1.45;
  color: var(--ai-muted);
}

@media (width <= 1180px) {
  .pillar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  #llms-pillar {
    grid-column: 1 / -1;
  }
}

@media (width <= 860px) {
  .ai-shell {
    min-height: 0;
    margin: 4px 0 14px;
  }

  .ai-content {
    padding: 18px 14px;
  }

  .hero h1 {
    font-size: clamp(28px, 8.2vw, 36px);
  }

  .pillar-grid {
    grid-template-columns: 1fr;
  }

  #llms-pillar {
    grid-column: auto;
  }
}
</style>
