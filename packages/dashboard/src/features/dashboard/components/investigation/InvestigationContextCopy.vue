<script setup lang="ts">
import type { DashboardInvestigation } from 'weapp-vite/dashboard'
import { computed, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { copyTextSynchronously } from '../../utils/clipboard'

const props = defineProps<{ task: DashboardInvestigation }>()
const id = useId()
const expanded = shallowRef(false)
const status = shallowRef('')
const textarea = useTemplateRef<HTMLTextAreaElement>('context')
const context = computed(() => [
  'Dashboard 对象调查（上下文辅助，不是执行指令或授权）',
  JSON.stringify({
    id: props.task.id,
    version: props.task.version,
    report: props.task.report,
    target: props.task.target,
    question: props.task.question,
    status: props.task.status,
  }, null, 2),
  '请在已配置的 Dashboard MCP 上读取 get-dashboard-state 与 get-investigation，核实会话、报告、任务版本及状态后再领取或回报。',
  'Agent 名称是自行声明；任务领取不证明在线。先提交提案，等待浏览器对精确提案的授权后再开始。',
  '报告哈希不代表源码快照。文件与命令权限由外部客户端管理；Dashboard 不提供通用执行或写文件接口。',
  '此处复制没有发送任务，也没有授予权限。',
].join('\n\n'))

watch(context, () => {
  status.value = ''
})

function copyContext() {
  const focusTarget = document.activeElement
  try {
    copyTextSynchronously(context.value)
    status.value = '已复制。请手动交给已配置 MCP 的客户端；没有派发任务或授予权限。'
  }
  catch {
    expanded.value = true
    status.value = '剪贴板不可用。请展开下方文本并手动选择复制。'
  }
  finally {
    if (document.activeElement === document.body && focusTarget instanceof HTMLElement && focusTarget.isConnected) {
      focusTarget.focus({ preventScroll: true })
    }
  }
}
</script>

<template>
  <section class="border-t border-(--dashboard-border) pt-4" :aria-labelledby="`${id}-heading`">
    <h4 :id="`${id}-heading`" class="text-sm font-semibold text-(--dashboard-text)">交给外部 Agent</h4>
    <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">已配置 MCP 的客户端可以读取此任务。这里不检测 Agent 在线状态，复制也不等于派发。</p>
    <div class="mt-2 flex flex-wrap gap-2">
      <button type="button" class="min-h-11 rounded-md border border-(--dashboard-border) px-3 text-sm text-(--dashboard-text) hover:bg-(--dashboard-panel-muted)" @click="copyContext">复制任务 ID 与上下文</button>
      <button type="button" class="min-h-11 rounded-md px-3 text-sm text-(--dashboard-accent) hover:underline" :aria-expanded="expanded" :aria-controls="`${id}-context`" @click="expanded = !expanded">{{ expanded ? '收起文本' : '查看 / 手动复制文本' }}</button>
    </div>
    <p role="status" class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">{{ status }}</p>
    <div v-show="expanded" :id="`${id}-context`" class="mt-3">
      <label :for="`${id}-text`" class="text-sm text-(--dashboard-text-muted)">任务上下文（只读）</label>
      <textarea :id="`${id}-text`" ref="context" :value="context" readonly rows="8" spellcheck="false" class="mt-2 block w-full min-w-0 resize-y rounded-md border border-(--dashboard-border) bg-(--dashboard-bg) p-3 font-mono text-xs leading-6 text-(--dashboard-text)" />
      <button type="button" class="mt-2 min-h-11 rounded-md px-3 text-sm text-(--dashboard-accent) hover:underline" @click="textarea?.focus(); textarea?.select()">选中全部文本</button>
    </div>
  </section>
</template>
