<script setup lang="ts">
import type { InvestigationDraft } from '../../composables/useObjectInvestigation'
import { useId } from 'vue'
import { investigationTargetLabel } from './presentation'

const props = defineProps<{
  draft: InvestigationDraft
  question: string
  issue: string
  canSubmit: boolean
  canRenew: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  'update:question': [value: string]
  'submit': []
  'cancel': []
  'renew': []
}>()
const id = useId()
</script>

<template>
  <form class="grid gap-4" :aria-labelledby="`${id}-heading`" @submit.prevent="emit('submit')">
    <div>
      <p class="font-mono text-xs text-(--dashboard-accent)">01 / 本地草稿</p>
      <h3 :id="`${id}-heading`" class="mt-1 text-base font-semibold text-(--dashboard-text)">先定义问题，再提交调查</h3>
      <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">浏览其他对象不会改变此草稿。提交只创建任务，不会自动调用 Agent 或授予执行权限。</p>
    </div>
    <div class="border-l-2 border-(--dashboard-accent) bg-(--dashboard-panel) px-4 py-3">
      <p class="text-xs text-(--dashboard-text-soft)">已冻结对象</p>
      <p class="mt-1 break-all font-mono text-sm text-(--dashboard-text)">{{ investigationTargetLabel(draft.target) }}</p>
      <details v-if="draft.report" class="mt-2 text-xs leading-6 text-(--dashboard-text-muted)">
        <summary class="cursor-pointer">绑定报告 r{{ draft.report.revision }} · 查看会话与完整摘要</summary>
        <p class="break-all font-mono">会话 {{ draft.report.sessionId }}</p>
        <p class="break-all font-mono">报告 SHA-256 {{ draft.report.reportHash }}</p>
        <p>这是报告身份，不是磁盘源码内容的快照或哈希。</p>
      </details>
      <p v-else class="mt-2 text-sm text-(--dashboard-text-muted)">尚未绑定可用报告</p>
    </div>
    <div>
      <label :for="`${id}-question`" class="block text-sm font-medium text-(--dashboard-text)">调查问题与预期结果</label>
      <textarea
        :id="`${id}-question`"
        :value="question"
        :disabled="busy"
        :aria-describedby="`${id}-issue`"
        maxlength="4096"
        required
        rows="4"
        class="mt-2 block w-full min-w-0 resize-y rounded-md border border-(--dashboard-border) bg-(--dashboard-bg) p-3 text-sm leading-7 text-(--dashboard-text) disabled:opacity-60"
        placeholder="例如：解释此产物的主要体积来源，给出保持现有行为的修改方案与验证步骤。"
        @input="emit('update:question', ($event.target as HTMLTextAreaElement).value)"
      />
      <p :id="`${id}-issue`" role="status" class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">{{ issue || '问题可继续编辑；对象与报告身份不随浏览选择改变。' }}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="submit" :disabled="!canSubmit" class="min-h-11 rounded-md border border-(--dashboard-accent) bg-(--dashboard-accent-soft) px-4 text-sm font-semibold text-(--dashboard-accent) hover:bg-(--dashboard-panel-muted) disabled:opacity-50">{{ busy ? '正在提交…' : '提交调查' }}</button>
      <button v-if="issue" type="button" :disabled="!canRenew || busy" class="min-h-11 rounded-md border border-(--dashboard-border) px-3 text-sm text-(--dashboard-text) hover:bg-(--dashboard-panel-muted) disabled:opacity-50" @click="emit('renew')">{{ props.draft.report ? '用当前报告新建草稿，保留问题' : '明确绑定当前报告' }}</button>
      <button type="button" :disabled="busy" class="min-h-11 rounded-md px-3 text-sm text-(--dashboard-text-muted) underline-offset-4 hover:underline disabled:opacity-50" @click="emit('cancel')">取消草稿</button>
    </div>
  </form>
</template>
