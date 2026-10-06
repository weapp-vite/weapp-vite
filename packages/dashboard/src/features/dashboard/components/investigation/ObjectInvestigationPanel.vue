<script setup lang="ts">
import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import { useId } from 'vue'
import { useObjectInvestigation } from '../../composables/useObjectInvestigation'
import { dashboardConnectionStatus, dashboardReportIdentity } from '../../utils/dashboardDevframe'
import InvestigationDraftForm from './InvestigationDraftForm.vue'
import InvestigationTaskDetails from './InvestigationTaskDetails.vue'
import { investigationStatusLabels, investigationTargetLabel } from './presentation'

const props = defineProps<{ request: DashboardInvestigationTarget | null, requestId: number }>()
const id = useId()
const {
  draft,
  pendingDraft,
  question,
  selectedId,
  tasks,
  selectedTask,
  connected,
  busy,
  pendingAction,
  error,
  notice,
  draftIssue,
  canSubmit,
  canCancel,
  canAuthorize,
  authorization,
  verificationSummary,
  verification,
  verificationIssue,
  canVerify,
  selectTask,
  replaceDraft,
  keepDraft,
  cancelDraft,
  renewDraft,
  submitDraft,
  confirmAuthorization,
  authorizeProposal,
  cancelTask,
  confirmVerification,
  verifyTask,
  reconnect,
} = useObjectInvestigation({ request: () => props.request, requestId: () => props.requestId })
</script>

<template>
  <section class="investigation-panel min-w-0 bg-(--dashboard-shell) text-(--dashboard-text)" :aria-labelledby="`${id}-heading`">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 :id="`${id}-heading`" class="text-base font-semibold">对象调查</h2>
        <p class="mt-1 text-xs leading-6 text-(--dashboard-text-soft)">草稿 → 外部领取 → 精确提案授权 → Agent 回报 → 人工复验</p>
      </div>
      <p role="status" class="text-xs leading-6 text-(--dashboard-text-muted)">{{ connected ? '宿主已同步 · 不代表 Agent 在线' : '宿主未就绪 · 本地输入保留' }}</p>
    </header>
    <div v-if="!connected" class="mt-4 flex flex-wrap items-center gap-3 border-l-2 border-(--dashboard-border-strong) bg-(--dashboard-panel) px-4 py-3">
      <p class="flex-1 text-sm leading-6 text-(--dashboard-text-muted)">{{ dashboardConnectionStatus === 'connected' ? '正在同步报告，暂不可提交或授权。' : '当前无法确认宿主状态。草稿不会丢失，也不会自动重发调查。' }}</p>
      <button v-if="dashboardConnectionStatus !== 'connected'" type="button" :disabled="dashboardConnectionStatus === 'connecting'" class="min-h-11 rounded-md border border-(--dashboard-border) px-3 text-sm disabled:opacity-50" @click="reconnect">{{ dashboardConnectionStatus === 'connecting' ? '连接中…' : '重新连接宿主' }}</button>
    </div>
    <p v-if="error" role="alert" class="mt-4 border-l-2 border-(--dashboard-border-strong) bg-(--dashboard-panel) p-3 text-sm leading-7">{{ error }}</p>
    <p role="status" class="mt-3 text-sm leading-6 text-(--dashboard-text-muted)">{{ notice }}</p>
    <div v-if="pendingDraft" class="mt-3 border border-(--dashboard-border-strong) bg-(--dashboard-panel) p-4">
      <p class="text-sm leading-6">新的调查请求尚未覆盖原草稿：</p>
      <p class="mt-1 break-all font-mono text-xs leading-6 text-(--dashboard-text-muted)">{{ investigationTargetLabel(pendingDraft.target) }} · {{ pendingDraft.report ? `r${pendingDraft.report.revision}` : '报告未就绪' }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" :disabled="busy" class="min-h-11 rounded-md border border-(--dashboard-border) px-3 text-sm hover:bg-(--dashboard-panel-muted) disabled:opacity-50" @click="keepDraft">保留原草稿</button>
        <button type="button" :disabled="busy" class="min-h-11 rounded-md border border-(--dashboard-accent) px-3 text-sm text-(--dashboard-accent) hover:bg-(--dashboard-accent-soft) disabled:opacity-50" @click="replaceDraft">{{ draft ? '放弃原草稿，使用新请求' : '使用新请求创建草稿' }}</button>
      </div>
    </div>
    <div class="investigation-layout mt-4 grid gap-5 border-t border-(--dashboard-border) pt-4">
      <div class="min-w-0">
        <InvestigationDraftForm
          v-if="selectedId === null && draft"
          v-model:question="question"
          :draft="draft"
          :issue="draftIssue"
          :can-submit="canSubmit"
          :can-renew="connected"
          :busy="busy"
          @submit="submitDraft"
          @cancel="cancelDraft"
          @renew="renewDraft"
        />
        <InvestigationTaskDetails
          v-else-if="selectedTask"
          :task="selectedTask"
          :current-report="dashboardReportIdentity"
          :busy="busy"
          :can-authorize="canAuthorize"
          :authorization-checked="!!authorization"
          :can-cancel="canCancel"
          :verification-issue="verificationIssue"
          :verification-summary="verificationSummary"
          :verification-checked="!!verification"
          :can-verify="canVerify"
          @confirm-authorization="confirmAuthorization"
          @authorize="authorizeProposal"
          @cancel="cancelTask"
          @update:verification-summary="verificationSummary = $event"
          @confirm-verification="confirmVerification"
          @verify="verifyTask"
        />
        <p v-else class="py-5 text-sm leading-7 text-(--dashboard-text-muted)">{{ selectedId ? '此任务不在当前宿主列表中。会话可能已更换，或终态记录已被回收；不会将旧任务绑定到新报告。' : '从任务列表选择宿主任务，或在关联对象上点击“创建调查”。创建草稿不会提交或派发。' }}</p>
        <p v-if="pendingAction" role="status" class="mt-4 text-sm text-(--dashboard-text-muted)">正在等待宿主确认操作，请勿重复提交…</p>
      </div>
      <nav class="min-w-0" aria-label="选择调查任务或本地草稿">
        <h3 class="text-xs font-medium text-(--dashboard-text-soft)">本地草稿与宿主任务 · {{ tasks.length }}/32</h3>
        <button v-if="draft" type="button" :aria-pressed="selectedId === null" class="task-option mt-3 w-full rounded-md border px-3 py-3 text-left" @click="selectTask(null)">
          <span class="block text-sm font-medium">未提交草稿</span>
          <span class="mt-1 block break-all text-xs leading-6 text-(--dashboard-text-muted)">{{ investigationTargetLabel(draft.target) }}</span>
        </button>
        <ul v-if="tasks.length" class="mt-2 grid max-h-80 gap-2 overflow-y-auto p-1">
          <li v-for="task in tasks" :key="task.id">
            <button type="button" :aria-pressed="selectedId === task.id" class="task-option w-full rounded-md border px-3 py-3 text-left" @click="selectTask(task.id)">
              <span class="block text-xs text-(--dashboard-accent)">{{ investigationStatusLabels[task.status] }}</span>
              <span class="mt-1 block text-sm leading-6">{{ task.question }}</span>
              <span class="mt-1 block break-all font-mono text-xs leading-6 text-(--dashboard-text-soft)">{{ investigationTargetLabel(task.target) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm leading-7 text-(--dashboard-text-muted)">宿主尚无调查记录。请先选择真实对象并创建草稿。</p>
        <p class="mt-3 text-xs leading-6 text-(--dashboard-text-soft)">记录属于当前宿主会话，不是永久历史；最多保留 32 项。</p>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.investigation-panel {
  container: investigation-panel / inline-size;
}

.task-option {
  background: var(--dashboard-panel);
  border-color: var(--dashboard-border);
}

.task-option:hover {
  background: var(--dashboard-panel-muted);
}

.task-option[aria-pressed='true'] {
  background: var(--dashboard-accent-soft);
  border-color: var(--dashboard-accent);
  box-shadow: inset 2px 0 var(--dashboard-accent);
}

@container investigation-panel (min-width: 44rem) {
  .investigation-layout {
    grid-template-columns: minmax(0, 1.4fr) minmax(12rem, 0.6fr);
  }
}
</style>
