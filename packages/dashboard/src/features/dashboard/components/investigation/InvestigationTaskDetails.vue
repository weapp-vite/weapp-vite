<script setup lang="ts">
import type { DashboardInvestigation, DashboardReportIdentity } from 'weapp-vite/dashboard'
import { useId } from 'vue'
import InvestigationContextCopy from './InvestigationContextCopy.vue'
import InvestigationMeasurements from './InvestigationMeasurements.vue'
import { investigationStatusLabels, investigationTargetLabel } from './presentation'

const props = defineProps<{
  task: DashboardInvestigation
  currentReport: DashboardReportIdentity | null
  busy: boolean
  canAuthorize: boolean
  authorizationChecked: boolean
  canCancel: boolean
  verificationIssue: string
  verificationSummary: string
  verificationChecked: boolean
  canVerify: boolean
}>()
const emit = defineEmits<{
  'confirmAuthorization': [value: boolean]
  'authorize': []
  'cancel': []
  'update:verificationSummary': [value: string]
  'confirmVerification': [value: boolean]
  'verify': []
}>()
const id = useId()
const checkOutcomeLabels = { 'passed': 'Agent 称通过', 'failed': 'Agent 称失败', 'not-run': '未运行' } as const
</script>

<template>
  <article class="grid gap-5" :aria-labelledby="`${id}-heading`" :aria-busy="busy">
    <header>
      <p role="status" class="text-sm font-medium text-(--dashboard-accent)">{{ investigationStatusLabels[task.status] }}</p>
      <h3 :id="`${id}-heading`" class="mt-2 whitespace-pre-wrap text-base font-semibold leading-7 text-(--dashboard-text)">{{ task.question }}</h3>
      <p class="mt-2 break-all font-mono text-xs leading-6 text-(--dashboard-text-muted)">{{ investigationTargetLabel(task.target) }}</p>
      <details class="mt-2 text-xs leading-6 text-(--dashboard-text-soft)">
        <summary class="cursor-pointer">任务身份 · r{{ task.report.revision }} · 任务版本 {{ task.version }}</summary>
        <p class="break-all font-mono">任务 {{ task.id }}</p>
        <p class="break-all font-mono">会话 {{ task.report.sessionId }}</p>
        <p class="break-all font-mono">报告 SHA-256 {{ task.report.reportHash }}</p>
        <p>创建 {{ task.createdAt }} · 更新 {{ task.updatedAt }}</p>
        <p>报告哈希不是源码快照；工作区权限仍由外部客户端控制。</p>
      </details>
    </header>

    <section class="border-l-2 border-(--dashboard-accent) bg-(--dashboard-panel) p-4" :aria-labelledby="`${id}-evidence`">
      <h4 :id="`${id}-evidence`" class="mb-3 text-sm font-semibold text-(--dashboard-text)">提交时的报告测量</h4>
      <InvestigationMeasurements :measurements="task.evidence" />
      <p class="mt-3 text-xs leading-6 text-(--dashboard-text-soft)">压缩、模块归因和源码字节是不同口径；未测量不等于零，归因不代表实际产物压缩收益。</p>
    </section>

    <section :aria-labelledby="`${id}-claim`">
      <h4 :id="`${id}-claim`" class="text-sm font-semibold text-(--dashboard-text)">外部 Agent 记录</h4>
      <p v-if="task.agent" class="mt-2 text-sm leading-6 text-(--dashboard-text)">{{ task.agent.name }} 已领取 · {{ task.agent.claimedAt }}</p>
      <p v-else class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">{{ task.status === 'submitted' ? '等待外部 Agent 领取。' : '没有 Agent 领取记录。' }}</p>
      <p class="mt-1 text-xs leading-6 text-(--dashboard-text-soft)">领取名称由客户端自行声明，不是认证身份、在线连接或心跳证明。</p>
    </section>

    <section v-if="task.proposal" class="border-t border-(--dashboard-border) pt-4" :aria-labelledby="`${id}-proposal`">
      <p class="font-mono text-xs text-(--dashboard-accent)">02 / 外部提案</p>
      <h4 :id="`${id}-proposal`" class="mt-1 text-sm font-semibold text-(--dashboard-text)">查看精确变更，再决定是否授权</h4>
      <p class="mt-2 break-all font-mono text-xs leading-6 text-(--dashboard-text-soft)">提案 {{ task.proposal.id }}</p>
      <p class="mt-2 whitespace-pre-wrap text-sm leading-7 text-(--dashboard-text)">{{ task.proposal.summary }}</p>
      <ul class="mt-3 grid gap-3 text-sm">
        <li v-for="(change, index) in task.proposal.changes" :key="index" class="border-l border-(--dashboard-border-strong) pl-3">
          <p class="break-all font-mono leading-6 text-(--dashboard-text)">{{ change.path }}</p>
          <p class="mt-1 whitespace-pre-wrap leading-6 text-(--dashboard-text-muted)">{{ change.description }}</p>
        </li>
      </ul>
      <h5 class="mt-4 text-sm font-medium text-(--dashboard-text)">提议的检查（尚不是执行结果）</h5>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-(--dashboard-text-muted)">
        <li v-for="(check, index) in task.proposal.checks" :key="index" class="whitespace-pre-wrap">{{ check }}</li>
      </ul>
      <h5 class="mt-4 text-sm font-medium text-(--dashboard-text)">Agent 声明的风险</h5>
      <ul v-if="task.proposal.risks.length" class="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-(--dashboard-text-muted)">
        <li v-for="(risk, index) in task.proposal.risks" :key="index" class="whitespace-pre-wrap">{{ risk }}</li>
      </ul>
      <p v-else class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">Agent 未列出风险，不代表已经证明没有风险。</p>
      <div v-if="task.status === 'proposed'" class="mt-4 grid gap-3">
        <label class="flex items-start gap-3 text-sm leading-6 text-(--dashboard-text)">
          <input type="checkbox" :checked="authorizationChecked" :disabled="!canAuthorize" class="mt-1 size-4 shrink-0 accent-(--dashboard-accent)" @change="emit('confirmAuthorization', ($event.target as HTMLInputElement).checked)">
          <span>我已查看此提案的路径、检查与风险，同意仅授权上述提案。报告或提案改变后需要重新确认。</span>
        </label>
        <p v-if="!canAuthorize && !busy" role="status" class="text-sm leading-6 text-(--dashboard-text-muted)">连接或原报告已变化；旧提案不可授权。请保留此记录并针对当前报告重新调查。</p>
        <button type="button" :disabled="!canAuthorize || !authorizationChecked" class="min-h-11 justify-self-start rounded-md border border-(--dashboard-accent) bg-(--dashboard-accent-soft) px-4 text-sm font-semibold text-(--dashboard-accent) disabled:opacity-50" @click="emit('authorize')">明确授权此提案</button>
      </div>
      <p v-if="task.authorization" class="mt-4 break-all text-sm leading-6 text-(--dashboard-text-muted)">授权记录：{{ task.authorization.proposalId }} · {{ task.authorization.authorizedAt }}。这只记录执行意图，不代替外部文件或命令权限。</p>
    </section>

    <section v-if="task.receipt" class="border-t border-(--dashboard-border) pt-4" :aria-labelledby="`${id}-receipt`">
      <p class="font-mono text-xs text-(--dashboard-accent)">03 / Agent 回报</p>
      <h4 :id="`${id}-receipt`" class="mt-1 text-sm font-semibold text-(--dashboard-text)">{{ task.receipt.outcome === 'completed' ? 'Agent 回报完成，不等于验证通过' : 'Agent 回报失败' }}</h4>
      <p class="mt-2 whitespace-pre-wrap text-sm leading-7 text-(--dashboard-text)">{{ task.receipt.summary }}</p>
      <p class="mt-2 text-xs leading-6 text-(--dashboard-text-soft)">回报时间 {{ task.receipt.reportedAt }} · 下列内容未经 Dashboard 独立执行验证。</p>
      <h5 class="mt-3 text-sm font-medium text-(--dashboard-text)">声明修改的文件</h5>
      <ul v-if="task.receipt.changedFiles.length" class="mt-2 grid gap-1 font-mono text-xs leading-6 text-(--dashboard-text-muted)">
        <li v-for="(path, index) in task.receipt.changedFiles" :key="index" class="break-all">{{ path }}</li>
      </ul>
      <p v-else class="mt-2 text-sm text-(--dashboard-text-muted)">没有声明修改的文件。</p>
      <h5 class="mt-3 text-sm font-medium text-(--dashboard-text)">声明的检查结果</h5>
      <ul v-if="task.receipt.checks.length" class="mt-2 grid gap-3 text-sm leading-6 text-(--dashboard-text-muted)">
        <li v-for="(check, index) in task.receipt.checks" :key="index">
          <p class="break-all font-mono">{{ check.command }}</p>
          <p>{{ checkOutcomeLabels[check.outcome] }} · {{ check.summary }}</p>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-(--dashboard-text-muted)">没有检查回报。</p>
    </section>

    <form v-if="task.status === 'completed'" class="grid gap-3 border-t border-(--dashboard-border) pt-4" :aria-labelledby="`${id}-verify`" @submit.prevent="emit('verify')">
      <div>
        <p class="font-mono text-xs text-(--dashboard-accent)">04 / 人工复验</p>
        <h4 :id="`${id}-verify`" class="mt-1 text-sm font-semibold text-(--dashboard-text)">检查更新报告与实际行为后，记录你的结论</h4>
      </div>
      <p role="status" class="text-sm leading-6 text-(--dashboard-text-muted)">{{ verificationIssue || `当前报告 r${currentReport?.revision}，晚于原报告 r${task.report.revision}。报告更新本身不证明问题已解决。` }}</p>
      <label :for="`${id}-summary`" class="text-sm text-(--dashboard-text)">人工复验摘要：实际检查了什么、结果与剩余限制</label>
      <textarea :id="`${id}-summary`" :value="verificationSummary" :disabled="busy" rows="3" maxlength="4096" required class="block w-full resize-y rounded-md border border-(--dashboard-border) bg-(--dashboard-bg) p-3 text-sm leading-7 text-(--dashboard-text) disabled:opacity-60" @input="emit('update:verificationSummary', ($event.target as HTMLTextAreaElement).value)" />
      <label class="flex items-start gap-3 text-sm leading-6 text-(--dashboard-text)">
        <input type="checkbox" :checked="verificationChecked" :disabled="!!verificationIssue || busy" class="mt-1 size-4 shrink-0 accent-(--dashboard-accent)" @change="emit('confirmVerification', ($event.target as HTMLInputElement).checked)">
        <span>我已检查当前报告 r{{ props.currentReport?.revision ?? '—' }} 及相关行为，并将以上摘要作为我的复验结论，而不是把 Agent 回报当作证明。</span>
      </label>
      <button type="submit" :disabled="!canVerify" class="min-h-11 justify-self-start rounded-md border border-(--dashboard-accent) bg-(--dashboard-accent-soft) px-4 text-sm font-semibold text-(--dashboard-accent) disabled:opacity-50">提交人工复验记录</button>
    </form>

    <section v-if="task.verification" class="border-t border-(--dashboard-border) pt-4" :aria-labelledby="`${id}-verified`">
      <h4 :id="`${id}-verified`" class="text-sm font-semibold text-(--dashboard-text)">人工复验记录 · r{{ task.verification.report.revision }}</h4>
      <p class="mt-2 whitespace-pre-wrap text-sm leading-7 text-(--dashboard-text)">{{ task.verification.summary }}</p>
      <p class="my-3 text-xs leading-6 text-(--dashboard-text-soft)">{{ task.verification.verifiedAt }} · 由用户明确提交，不是自动判定成功。</p>
      <InvestigationMeasurements v-if="task.verification.after" :measurements="task.verification.after" />
      <p v-else class="text-sm leading-6 text-(--dashboard-text-muted)">更新报告中已找不到原对象；不把缺失对象计为零体积。</p>
    </section>

    <section v-if="['submitted', 'claimed', 'proposed', 'authorized', 'executing', 'cancelled'].includes(task.status)" class="border-t border-(--dashboard-border) pt-4">
      <p class="text-sm leading-6 text-(--dashboard-text-muted)">取消只停止本任务接受后续回报，不能终止外部进程或撤销已有文件修改。需要停止执行时，请到外部客户端操作。</p>
      <button v-if="task.status !== 'cancelled'" type="button" :disabled="!canCancel" class="mt-3 min-h-11 rounded-md border border-(--dashboard-border-strong) px-3 text-sm text-(--dashboard-text) hover:bg-(--dashboard-panel-muted) disabled:opacity-50" @click="emit('cancel')">取消此调查（不终止外部进程）</button>
    </section>
    <p v-if="task.status === 'stale'" role="status" class="border-l-2 border-(--dashboard-border-strong) pl-3 text-sm leading-7 text-(--dashboard-text-muted)">报告已更新，此任务不会自动改绑，原提案及授权不可继续使用。请从当前对象创建新的调查。</p>
    <InvestigationContextCopy :task="task" />
  </article>
</template>
