<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

const { isDark } = useData()
const surfaceClass = computed(() => (isDark.value ? 'is-dark' : 'is-light'))

interface Capability {
  icon: string
  title: string
  description: string
  detail: string
  href: string
}

interface AdoptionPath {
  icon: string
  label: string
  title: string
  description: string
  action: string
  href: string
}

const capabilities: Capability[] = [
  {
    icon: 'i-mdi-shield-check-outline',
    title: '保留原生能力',
    description: '继续使用 Page、Component、WXML、WXSS 与平台 API，按目录渐进接入。',
    detail: '原生增强',
    href: '/guide/manual-integration',
  },
  {
    icon: 'i-mdi-lightning-bolt-outline',
    title: '现代工程默认开启',
    description: 'TypeScript、Vite/Rolldown、HMR、自动导入与 npm 构建组成稳定的日常工作流。',
    detail: '工程化',
    href: '/guide/',
  },
  {
    icon: 'i-mdi-layers-triple-outline',
    title: '一次维护，多端构建',
    description: '以单目标构建覆盖微信、支付宝、抖音与 Web，保留各平台的真实边界。',
    detail: '多端构建',
    href: '/guide/multi-platform',
  },
  {
    icon: 'i-mdi-robot-outline',
    title: 'AI 可以执行和验证',
    description: 'MCP、AGENTS、本地文档、日志与截图对比，让 AI 进入真实研发闭环。',
    detail: 'AI 可执行验证',
    href: '/guide/ai-workflows',
  },
]

const adoptionPaths: AdoptionPath[] = [
  {
    icon: 'i-mdi-rocket-launch-outline',
    label: '01 / 新项目',
    title: '从模板开始，第一天就有完整基线',
    description: '选择原生、Vue SFC、Wevu 或多平台模板，直接获得可维护的项目结构。',
    action: '创建项目',
    href: '/guide/',
  },
  {
    icon: 'i-mdi-source-branch-sync',
    label: '02 / 存量项目',
    title: '不推翻已有代码，逐步接入现代工具链',
    description: '保留页面、组件和平台配置，把重复的构建、依赖和调试工作交给框架。',
    action: '查看迁移路径',
    href: '/migration/',
  },
  {
    icon: 'i-mdi-message-processing-outline',
    label: '03 / AI 协作团队',
    title: '让 AI 从解释代码走到完成验收',
    description: '给 AI 项目上下文、可调用工具和运行时证据，减少猜测式修改。',
    action: '进入 AI 工作流',
    href: '/ai',
  },
]

const workflowSteps = [
  { name: 'build', caption: '构建', icon: 'i-mdi-hammer-wrench' },
  { name: 'inspect', caption: '检查', icon: 'i-mdi-magnify' },
  { name: 'verify', caption: '验收', icon: 'i-mdi-check-decagram-outline' },
]
</script>

<template>
  <main class="home-page" :class="surfaceClass">
    <section class="home-hero">
      <div class="home-hero-inner">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-mark" /> AI 时代的小程序研发基线</p>
          <h1>让 AI 真正参与<br><span>小程序开发</span></h1>
          <p class="hero-description">
            weapp-vite 把原生能力、现代工程化、多端构建和可验证的 AI 工作流，合成一套可以长期维护的开发基线。
          </p>
          <div class="hero-actions">
            <a class="button button-primary" href="/guide/"><span class="i-mdi-rocket-launch-outline" /> 从模板开始</a>
            <a class="button button-secondary" href="/ai"><span class="i-mdi-robot-outline" /> 看 AI 工作流</a>
            <a class="button button-quiet" href="https://github.com/weapp-vite/weapp-vite" target="_blank" rel="noreferrer"><span class="i-mdi-github" /> GitHub</a>
          </div>
          <div class="hero-proof" aria-label="weapp-vite 核心能力">
            <span>原生渐进接入</span><span>Vue SFC / Wevu</span><span>微信 · 支付宝 · 抖音 · Web</span>
          </div>
        </div>

        <div class="workbench" aria-label="AI 小程序研发工作台">
          <div class="workbench-bar">
            <div class="window-dots"><i /><i /><i /></div>
            <span class="workbench-title">weapp-vite / workspace</span>
            <span class="workbench-state"><span class="state-dot" /> ready</span>
          </div>
          <div class="workbench-grid">
            <div class="code-pane">
              <div class="pane-label"><span class="i-mdi-file-code-outline" /> pages/index/index.ts</div>
              <pre><code><span class="code-muted">01</span> <span class="code-keyword">import</span> { ref } <span class="code-keyword">from</span> <span class="code-string">'vue'</span>
<span class="code-muted">02</span>
<span class="code-muted">03</span> <span class="code-keyword">export default</span> {
<span class="code-muted">04</span>   <span class="code-key">setup</span>() {
<span class="code-muted">05</span>     <span class="code-keyword">const</span> ready = ref(<span class="code-number">false</span>)
<span class="code-muted">06</span>     <span class="code-key">onReady</span>(() =&gt; ready.value = <span class="code-number">true</span>)
<span class="code-muted">07</span>     <span class="code-keyword">return</span> { ready }
<span class="code-muted">08</span>   },
<span class="code-muted">09</span> }</code></pre>
            </div>

            <div class="flow-pane">
              <div class="pane-label"><span class="i-mdi-transit-connection-variant" /> pipeline</div>
              <div class="workflow-list">
                <template v-for="(step, index) in workflowSteps" :key="step.name">
                  <div class="workflow-step">
                    <span class="workflow-icon" :class="step.icon" />
                    <div><strong>{{ step.name }}</strong><small>{{ step.caption }}</small></div>
                    <span class="workflow-check i-mdi-check" />
                  </div>
                  <span v-if="index < workflowSteps.length - 1" class="workflow-line" />
                </template>
              </div>
            </div>

            <div class="evidence-pane">
              <div class="pane-label"><span class="i-mdi-robot-outline" /> ai / evidence</div>
              <div class="evidence-log">
                <p><span class="log-time">09:41:08</span> MCP <b>inspect_page</b></p>
                <p><span class="log-time">09:41:09</span> DevTools <b>console clean</b></p>
                <p><span class="log-time">09:41:11</span> screenshot <b class="log-pass">diff 0.2%</b></p>
              </div>
              <div class="evidence-result"><span class="i-mdi-check-circle" /> verified <strong>3/3</strong></div>
            </div>
          </div>
          <div class="workbench-footer"><span>native + web</span><span>mcp connected</span><span>last run 12s ago</span></div>
        </div>
      </div>
    </section>

    <section id="capabilities" class="home-section capability-section">
      <div class="section-heading"><p class="section-kicker">THE BASELINE</p><h2>一套基线，四个确定性</h2><p>把容易失控的工程细节变成团队可以依赖的默认行为。</p></div>
      <div class="capability-grid">
        <a v-for="item in capabilities" :key="item.title" class="capability-item" :href="item.href">
          <div class="capability-icon"><span :class="item.icon" /></div>
          <div><p class="capability-detail">{{ item.detail }}</p><h3>{{ item.title }}</h3><p class="capability-description">{{ item.description }}</p></div>
          <span class="capability-arrow i-mdi-arrow-top-right" />
        </a>
      </div>
    </section>

    <section id="adoption" class="home-section adoption-section">
      <div class="section-heading section-heading-inline"><div><p class="section-kicker">ADOPT WITHOUT REWRITE</p><h2>从你的现实出发</h2></div><p>新项目、存量项目和 AI 协作，都从同一条工程基线开始。</p></div>
      <div class="adoption-list">
        <a v-for="path in adoptionPaths" :key="path.label" class="adoption-item" :href="path.href">
          <span class="adoption-icon" :class="path.icon" />
          <span class="adoption-label">{{ path.label }}</span>
          <span class="adoption-content"><strong>{{ path.title }}</strong><small>{{ path.description }}</small></span>
          <span class="adoption-action">{{ path.action }} <span class="i-mdi-arrow-right" /></span>
        </a>
      </div>
    </section>

    <section id="start" class="home-section start-section">
      <div class="start-panel">
        <div><p class="section-kicker">START WITH ONE COMMAND</p><h2>把下一次小程序迭代，交给一套更可靠的基线。</h2><p>从脚手架开始，沿着文档、AI 工作流和运行时验收一路走到上线。</p></div>
        <div class="start-command"><span class="command-prompt">$</span><code>pnpm create weapp-vite@latest</code><a href="/guide/" aria-label="打开快速开始" class="i-mdi-arrow-top-right" /></div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  --home-ink: #101418;
  --home-muted: #59635e;
  --home-line: #d8e0da;
  --home-paper: #f5f7f3;
  --home-panel: #fff;
  --home-green: #2ba245;
  --home-lime: #b6f36a;

  color: var(--home-ink);
  background: var(--home-paper);
}

.home-page.is-dark {
  --home-ink: #f1f5f1;
  --home-muted: #a7b3aa;
  --home-line: #2d3932;
  --home-paper: #101418;
  --home-panel: #151c18;
}

.home-hero {
  border-bottom: 1px solid var(--home-line);
}

.home-hero-inner {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(500px, 1.2fr);
  gap: clamp(32px, 6vw, 88px);
  align-items: center;
  max-width: 1240px;
  padding: 92px 32px 84px;
  margin: 0 auto;
}

.hero-copy {
  max-width: 540px;
}

.eyebrow,
.section-kicker,
.pane-label,
.workbench-footer,
.hero-proof,
.workbench-state,
.adoption-label {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.eyebrow {
  display: flex;
  gap: 9px;
  align-items: center;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--home-green);
}

.eyebrow-mark {
  width: 8px;
  height: 8px;
  background: var(--home-lime);
  border: 2px solid var(--home-green);
  border-radius: 50%;
}

h1 {
  margin: 24px 0 20px;
  font-size: clamp(42px, 5.2vw, 72px);
  font-weight: 800;
  line-height: 1.03;
  letter-spacing: -0.04em;
}

h1 span {
  color: var(--home-green);
}

.hero-description {
  max-width: 490px;
  margin: 0;
  font-size: 18px;
  line-height: 1.7;
  color: var(--home-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}

.button {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 42px;
  padding: 0 15px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  border: 1px solid var(--home-line);
  border-radius: 6px;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.button:hover {
  border-color: var(--home-green);
  transform: translateY(-2px);
}

.button-primary {
  color: #102015;
  background: var(--home-lime);
  border-color: var(--home-lime);
}

.button-secondary {
  color: var(--home-green);
  background: transparent;
  border-color: color-mix(in srgb, var(--home-green) 50%, var(--home-line));
}

.button-quiet {
  color: var(--home-muted);
  background: transparent;
}

.hero-proof {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 20px;
  margin-top: 26px;
  font-size: 10px;
  color: var(--home-muted);
}

.hero-proof span::before {
  margin-right: 6px;
  font-size: 8px;
  color: var(--home-green);
  content: '●';
}

.workbench {
  overflow: hidden;
  color: #dbe7dd;
  background: #17221b;
  border: 1px solid #34463a;
  border-radius: 7px;
  box-shadow: 0 20px 50px rgb(16 20 18 / 16%);
}

.workbench-bar,
.workbench-footer {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-bottom: 1px solid #34463a;
}

.window-dots {
  display: flex;
  gap: 5px;
  margin-right: 13px;
}

.window-dots i {
  width: 7px;
  height: 7px;
  background: #617367;
  border-radius: 50%;
}

.window-dots i:first-child {
  background: #ef8f55;
}

.window-dots i:nth-child(2) {
  background: #d4bb5f;
}

.window-dots i:last-child {
  background: #72be72;
}

.workbench-title {
  font:
    11px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  color: #a9b8ad;
}

.workbench-state {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
  font-size: 9px;
  color: #9bdc91;
}

.state-dot {
  width: 6px;
  height: 6px;
  background: #72d66d;
  border-radius: 50%;
}

.workbench-grid {
  display: grid;
  grid-template-columns: 1.25fr 0.8fr 0.9fr;
  min-height: 285px;
}

.code-pane,
.flow-pane,
.evidence-pane {
  padding: 18px;
}

.code-pane,
.flow-pane {
  border-right: 1px solid #34463a;
}

.pane-label {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 9px;
  color: #8ea894;
}

.code-pane pre {
  margin: 18px 0 0;
  overflow: auto;
  font:
    12px/1.9 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}

.code-muted {
  color: #607664;
}

.code-keyword {
  color: #b6f36a;
}

.code-string {
  color: #e7c77d;
}

.code-key,
.code-number {
  color: #7cd6c0;
}

.workflow-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 27px;
}

.workflow-step {
  display: flex;
  gap: 9px;
  align-items: center;
}

.workflow-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #b6f36a;
  background: #273a2b;
  border: 1px solid #52745a;
  border-radius: 5px;
}

.workflow-step strong {
  display: block;
  font:
    700 11px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}

.workflow-step small {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #8ea894;
}

.workflow-check {
  margin-left: auto;
  font-size: 14px;
  color: #80d889;
}

.workflow-line {
  width: 1px;
  height: 20px;
  margin: 3px 0 3px 13px;
  background: #52745a;
}

.evidence-log {
  padding: 11px;
  margin-top: 25px;
  font:
    10px/1.8 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  background: #111913;
  border: 1px solid #2f4435;
  border-radius: 4px;
}

.evidence-log p {
  margin: 0;
}

.log-time {
  color: #657c6b;
}

.evidence-log b {
  font-weight: 500;
  color: #dbe7dd;
}

.evidence-log .log-pass {
  color: #a4e28f;
}

.evidence-result {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 18px;
  font:
    10px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  color: #8ea894;
}

.evidence-result span {
  color: #80d889;
}

.evidence-result strong {
  margin-left: auto;
  font-size: 16px;
  color: #b6f36a;
}

.workbench-footer {
  justify-content: space-between;
  min-height: 32px;
  font-size: 8px;
  color: #76927d;
  border-top: 1px solid #34463a;
  border-bottom: 0;
}

.home-section {
  max-width: 1240px;
  padding: 100px 32px;
  margin: 0 auto;
}

.section-heading {
  max-width: 570px;
  margin-bottom: 38px;
}

.section-kicker {
  margin: 0 0 12px;
  font-size: 10px;
  font-weight: 700;
  color: var(--home-green);
}

.section-heading h2 {
  margin: 0;
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.section-heading > p:last-child {
  margin: 16px 0 0;
  line-height: 1.7;
  color: var(--home-muted);
}

.capability-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--home-line);
  border-left: 1px solid var(--home-line);
}

.capability-item {
  position: relative;
  display: block;
  min-height: 270px;
  padding: 24px;
  color: inherit;
  text-decoration: none;
  border-right: 1px solid var(--home-line);
  border-bottom: 1px solid var(--home-line);
  transition: background 0.2s ease;
}

.capability-item:hover {
  background: color-mix(in srgb, var(--home-green) 7%, transparent);
}

.capability-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--home-green);
  background: color-mix(in srgb, var(--home-green) 12%, transparent);
  border-radius: 5px;
}

.capability-detail {
  margin: 24px 0 7px;
  font:
    10px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  color: var(--home-green);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.capability-item h3 {
  margin: 0;
  font-size: 18px;
}

.capability-description {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--home-muted);
}

.capability-arrow {
  position: absolute;
  right: 22px;
  bottom: 22px;
  color: var(--home-muted);
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.capability-item:hover .capability-arrow {
  color: var(--home-green);
  transform: translate(3px, -3px);
}

.adoption-section {
  border-top: 1px solid var(--home-line);
}

.section-heading-inline {
  display: flex;
  align-items: end;
  justify-content: space-between;
  max-width: none;
}

.section-heading-inline > p {
  max-width: 330px;
  margin: 0 0 4px;
  line-height: 1.6;
  color: var(--home-muted);
}

.adoption-list {
  border-top: 1px solid var(--home-line);
}

.adoption-item {
  display: grid;
  grid-template-columns: 34px 120px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 23px 0;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--home-line);
}

.adoption-item:hover .adoption-action {
  color: var(--home-green);
}

.adoption-icon {
  font-size: 21px;
  color: var(--home-green);
}

.adoption-label {
  font-size: 10px;
  color: var(--home-muted);
}

.adoption-content strong,
.adoption-content small {
  display: block;
}

.adoption-content strong {
  font-size: 17px;
}

.adoption-content small {
  margin-top: 7px;
  font-size: 13px;
  color: var(--home-muted);
}

.adoption-action {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--home-muted);
  transition: color 0.2s ease;
}

.start-section {
  padding-top: 20px;
  padding-bottom: 110px;
}

.start-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  gap: 36px;
  align-items: end;
  padding: 38px;
  background: var(--home-panel);
  border: 1px solid var(--home-line);
  border-radius: 7px;
}

.start-panel h2 {
  max-width: 610px;
  margin: 0;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.start-panel p:last-child {
  margin: 14px 0 0;
  line-height: 1.6;
  color: var(--home-muted);
}

.start-command {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 54px;
  padding: 0 15px;
  font:
    12px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  color: #dbe7dd;
  background: #17221b;
  border: 1px solid #34463a;
  border-radius: 5px;
}

.command-prompt {
  color: var(--home-lime);
}

.start-command code {
  overflow: auto;
  white-space: nowrap;
}

.start-command a {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--home-lime);
}

@media (max-width: 1020px) {
  .home-hero-inner {
    grid-template-columns: 1fr;
  }

  .hero-copy {
    max-width: 680px;
  }

  .workbench-grid {
    grid-template-columns: 1.2fr 0.8fr;
  }

  .evidence-pane {
    grid-column: 1 / -1;
    border-top: 1px solid #34463a;
  }

  .capability-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 680px) {
  .home-hero-inner,
  .home-section {
    padding-right: 20px;
    padding-left: 20px;
  }

  .home-hero-inner {
    padding-top: 62px;
    padding-bottom: 58px;
  }

  .hero-description {
    font-size: 16px;
  }

  .hero-actions .button-quiet {
    display: none;
  }

  .workbench-grid {
    display: block;
  }

  .code-pane,
  .flow-pane {
    border-right: 0;
    border-bottom: 1px solid #34463a;
  }

  .code-pane {
    min-height: 240px;
  }

  .flow-pane {
    padding-bottom: 23px;
  }

  .evidence-pane {
    border-top: 0;
  }

  .workbench-footer {
    gap: 10px;
    overflow: auto;
    white-space: nowrap;
  }

  .home-section {
    padding-top: 70px;
    padding-bottom: 70px;
  }

  .section-heading-inline {
    display: block;
  }

  .section-heading-inline > p {
    margin-top: 16px;
  }

  .capability-grid {
    grid-template-columns: 1fr;
  }

  .capability-item {
    min-height: 220px;
  }

  .adoption-item {
    grid-template-columns: 28px 1fr auto;
    gap: 12px;
  }

  .adoption-label {
    grid-row: 1;
    grid-column: 2;
  }

  .adoption-content {
    grid-row: 2;
    grid-column: 2 / -1;
  }

  .adoption-action {
    grid-row: 1;
    grid-column: 3;
    font-size: 0;
  }

  .adoption-action span {
    font-size: 17px;
  }

  .start-panel {
    display: block;
    padding: 25px 20px;
  }

  .start-command {
    margin-top: 28px;
  }

  .start-command code {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .button,
  .capability-item,
  .capability-arrow,
  .adoption-action {
    transition: none;
  }
}
</style>
