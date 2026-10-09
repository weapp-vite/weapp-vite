import type { MaybeRefOrGetter } from 'vue'
import type {
  DashboardAuthorizeInvestigationRequest,
  DashboardInvestigation,
  DashboardInvestigationTarget,
  DashboardReportIdentity,
} from 'weapp-vite/dashboard'
import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import {
  authorizeDashboardInvestigation,
  cancelDashboardInvestigation,
  connectDashboardDevframe,
  createDashboardInvestigation,
  dashboardConnectionStatus,
  dashboardInvestigations,
  dashboardReportIdentity,
  verifyDashboardInvestigation,
} from '../utils/dashboardDevframe'

export interface InvestigationDraft {
  target: DashboardInvestigationTarget
  report: DashboardReportIdentity | null
}

interface InvestigationOptions {
  request: MaybeRefOrGetter<DashboardInvestigationTarget | null>
  requestId: MaybeRefOrGetter<number>
}

function sameReport(left: DashboardReportIdentity | null, right: DashboardReportIdentity | null) {
  return !!left && !!right && left.sessionId === right.sessionId
    && left.revision === right.revision && left.reportHash === right.reportHash
}
/** 草稿与浏览选择隔离；远端状态仅从共享传输读取，授权绑定明确的提案版本。 */
export function useObjectInvestigation(options: InvestigationOptions) {
  const draft = shallowRef<InvestigationDraft | null>(null)
  const pendingDraft = shallowRef<InvestigationDraft | null>(null)
  const question = shallowRef('')
  const selectedId = shallowRef<string | null>(null)
  const pendingAction = shallowRef('')
  const error = shallowRef('')
  const notice = shallowRef('')
  const authorization = shallowRef<DashboardAuthorizeInvestigationRequest | null>(null)
  const verificationSummary = shallowRef('')
  const verification = shallowRef<{ id: string, version: number, report: DashboardReportIdentity } | null>(null)
  let disposed = false
  let selectionVersion = 0
  let summaryTaskId: string | null = null
  function selectTask(id: string | null) {
    selectionVersion += 1
    selectedId.value = id
    authorization.value = null
    verification.value = null
    if (id && id !== summaryTaskId) {
      summaryTaskId = id
      verificationSummary.value = ''
    }
    error.value = ''
    notice.value = ''
  }

  const tasks = computed(() => dashboardInvestigations.value.items)
  const selectedTask = computed(() => tasks.value.find(task => task.id === selectedId.value) ?? null)
  const connected = computed(() => dashboardConnectionStatus.value === 'connected' && dashboardReportIdentity.value !== null)
  const busy = computed(() => pendingAction.value !== '')
  const draftIssue = computed(() => {
    if (!draft.value) {
      return '请从关联对象创建调查草稿。'
    }
    if (!draft.value.report) {
      return '创建草稿时报告尚未就绪。连接后请明确绑定当前报告。'
    }
    if (!connected.value) {
      return '宿主未连接或报告正在同步；草稿与问题已保留。'
    }
    if (!sameReport(draft.value.report, dashboardReportIdentity.value)) {
      return '草稿绑定的报告已过期。不会自动改绑；可明确用当前报告新建草稿并保留问题。'
    }
    return ''
  })
  const canSubmit = computed(() => !busy.value && !draftIssue.value && question.value.trim().length > 0 && question.value.trim().length <= 4096)
  const canCancel = computed(() => connected.value && !busy.value && !!selectedTask.value
    && ['submitted', 'claimed', 'proposed', 'authorized', 'executing'].includes(selectedTask.value.status))
  const canAuthorize = computed(() => connected.value && !busy.value && selectedTask.value?.status === 'proposed'
    && !!selectedTask.value.proposal && sameReport(selectedTask.value.report, dashboardReportIdentity.value))
  const verificationIssue = computed(() => {
    const task = selectedTask.value
    const current = dashboardReportIdentity.value
    if (!task || task.status !== 'completed') {
      return '只有外部 Agent 回报完成的任务才能进行人工复验。'
    }
    if (!connected.value || !current) {
      return '请等待当前报告同步完成；复验摘要已保留。'
    }
    if (current.sessionId !== task.report.sessionId || current.revision <= task.report.revision) {
      return '请先生成同一宿主会话中的更新报告，再检查实际结果。'
    }
    return ''
  })
  const canVerify = computed(() => !busy.value && !verificationIssue.value && !!verification.value
    && !!verificationSummary.value.trim() && verificationSummary.value.trim().length <= 4096)

  watch(() => toValue(options.requestId), () => {
    const target = toValue(options.request)
    if (!target) {
      return
    }
    const report = dashboardReportIdentity.value
    const next = { target: { ...target }, report: report ? { ...report } : null }
    selectTask(null)
    if (draft.value) {
      pendingDraft.value = next
      notice.value = '已有未提交草稿；新对象不会覆盖它，请选择保留或替换。'
    }
    else {
      draft.value = next
      question.value = ''
    }
  }, { immediate: true })

  watch([selectedTask, dashboardReportIdentity, dashboardConnectionStatus], () => {
    const task = selectedTask.value
    const grant = authorization.value
    if (!connected.value || !task || !grant || task.id !== grant.id || task.version !== grant.version || task.proposal?.id !== grant.proposalId || !sameReport(task.report, dashboardReportIdentity.value)) {
      authorization.value = null
    }
    const confirmation = verification.value
    if (!connected.value || !task || !confirmation || task.id !== confirmation.id || task.version !== confirmation.version || !sameReport(confirmation.report, dashboardReportIdentity.value)) {
      verification.value = null
    }
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
  })

  function replaceDraft() {
    if (!pendingDraft.value || busy.value) {
      return
    }
    draft.value = pendingDraft.value
    pendingDraft.value = null
    question.value = ''
    selectTask(null)
    notice.value = '已替换为明确选择的新对象；尚未提交。'
  }

  function keepDraft() {
    pendingDraft.value = null
    notice.value = '已保留原对象、报告和问题。'
  }

  function cancelDraft() {
    if (busy.value) {
      return
    }
    draft.value = null
    pendingDraft.value = null
    question.value = ''
    error.value = ''
    notice.value = '本地草稿已取消，没有发送调查。'
  }

  function renewDraft() {
    const current = dashboardReportIdentity.value
    if (!draft.value || !connected.value || !current || busy.value) {
      return
    }
    draft.value = { target: { ...draft.value.target }, report: { ...current } }
    notice.value = '已明确为原对象创建当前报告草稿，保留问题；提交时宿主会重新检查对象是否存在。'
    error.value = ''
  }

  async function runMutation(action: string, mutation: () => Promise<DashboardInvestigation>) {
    if (busy.value || disposed) {
      return
    }
    const sessionId = dashboardReportIdentity.value?.sessionId
    const view = selectionVersion
    pendingAction.value = action
    error.value = ''
    notice.value = ''
    try {
      const result = await mutation()
      if (!disposed && dashboardReportIdentity.value?.sessionId === sessionId) {
        return result
      }
    }
    catch (cause) {
      if (!disposed && selectionVersion === view && (!dashboardReportIdentity.value || dashboardReportIdentity.value.sessionId === sessionId)) {
        error.value = `${cause instanceof Error ? cause.message : String(cause)} 未确认操作成功，请检查任务列表后再决定是否重试。输入已保留。`
      }
    }
    finally {
      if (!disposed) {
        pendingAction.value = ''
      }
    }
  }

  async function submitDraft() {
    const currentDraft = draft.value
    if (!canSubmit.value || !currentDraft?.report) {
      return
    }
    const submittedQuestion = question.value
    const view = selectionVersion
    const result = await runMutation('submit', () => createDashboardInvestigation({
      report: currentDraft.report!,
      target: currentDraft.target,
      question: submittedQuestion.trim(),
    }))
    if (!result) {
      return
    }
    if (draft.value === currentDraft && question.value === submittedQuestion) {
      draft.value = null
      question.value = ''
    }
    if (selectionVersion === view) {
      selectTask(result.id)
      notice.value = '调查已由宿主接收；创建任务不授予文件修改或执行权限。'
    }
  }

  function confirmAuthorization(checked: boolean) {
    const task = selectedTask.value
    authorization.value = checked && canAuthorize.value && task?.proposal
      ? { id: task.id, version: task.version, proposalId: task.proposal.id }
      : null
  }

  async function authorizeProposal() {
    if (!canAuthorize.value || !authorization.value) {
      return
    }
    const input = authorization.value
    const view = selectionVersion
    const result = await runMutation('authorize', () => authorizeDashboardInvestigation(input))
    if (result && selectionVersion === view) {
      notice.value = '宿主已接受此提案的授权。执行仍由外部 Agent 与其工作区权限控制。'
    }
  }

  async function cancelTask() {
    const task = selectedTask.value
    if (!canCancel.value || !task) {
      return
    }
    const view = selectionVersion
    const result = await runMutation('cancel', () => cancelDashboardInvestigation({ id: task.id, version: task.version }))
    if (result && selectionVersion === view) {
      notice.value = '宿主已取消此调查，后续回报将被拒绝；外部进程不会因此停止，请在外部客户端处理。'
    }
  }

  function confirmVerification(checked: boolean) {
    const task = selectedTask.value
    const current = dashboardReportIdentity.value
    verification.value = checked && !verificationIssue.value && task && current
      ? { id: task.id, version: task.version, report: { ...current } }
      : null
  }

  async function verifyTask() {
    if (!canVerify.value || !verification.value) {
      return
    }
    const input = { ...verification.value, summary: verificationSummary.value.trim() }
    const view = selectionVersion
    const result = await runMutation('verify', () => verifyDashboardInvestigation(input))
    if (result && selectionVersion === view) {
      notice.value = '宿主已记录你的人工复验结论与新报告测量；这不是自动验证 Agent 回报。'
    }
  }

  async function reconnect() {
    error.value = ''
    try {
      await connectDashboardDevframe()
    }
    catch (cause) {
      if (!disposed) {
        error.value = cause instanceof Error ? cause.message : String(cause)
      }
    }
  }

  return {
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
  }
}
