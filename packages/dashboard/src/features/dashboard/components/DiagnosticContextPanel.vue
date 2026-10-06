<script setup lang="ts">
import type { DiagnosticEvidence } from '../utils/diagnosticEvidence'
import { computed, onMounted, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { copyTextSynchronously } from '../utils/clipboard'

const props = defineProps<{
  evidence: DiagnosticEvidence
  title: string
  text: string
  invalidReason: string
}>()
const emit = defineEmits<{ close: [], verification: [] }>()
const id = useId()
const plan = useTemplateRef<HTMLElement>('plan')
const heading = useTemplateRef<HTMLHeadingElement>('heading')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
const status = shallowRef('')
const visibleText = computed(() => props.invalidReason ? `上下文已失效：${props.invalidReason}` : props.text)

watch([() => props.text, () => props.invalidReason], () => {
  status.value = ''
  if (props.invalidReason && plan.value?.contains(document.activeElement)) {
    heading.value?.focus({ preventScroll: true })
  }
})
onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  plan.value?.scrollIntoView({ block: 'start' })
})

function copyContext() {
  if (props.invalidReason) {
    return
  }
  const text = props.text
  const focusTarget = document.activeElement
  try {
    copyTextSynchronously(text)
    status.value = props.invalidReason || props.text !== text
      ? '复制期间证据已变化，旧文本不可作为当前诊断；请重新准备上下文。'
      : '已复制。请交给已配置 Dashboard MCP 的 AI 客户端；未发送任务，也未授予编辑或执行权限。'
  }
  catch {
    if (!props.invalidReason && props.text === text) {
      status.value = '剪贴板不可用，请手动复制下方上下文。'
      textarea.value?.focus()
      textarea.value?.select()
    }
  }
  finally {
    // 旧式复制会移除临时 textarea；恢复因此丢失的焦点，让 Escape 仍能收起。
    if (document.activeElement === document.body && focusTarget instanceof HTMLElement && focusTarget.isConnected) {
      const target = props.invalidReason ? heading.value : focusTarget
      target?.focus({ preventScroll: true })
    }
  }
}
</script>

<template>
  <section
    ref="plan"
    class="diagnostic-plan mt-8 min-w-0 scroll-mt-6 border border-t-2 border-(--dashboard-border) border-t-(--dashboard-accent) bg-(--dashboard-panel) p-4 [overflow-wrap:anywhere] sm:p-6"
    :aria-labelledby="`${id}-heading`"
    @keydown.esc.stop="emit('close')"
  >
    <div class="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1 basis-64">
        <p class="font-mono text-xs tracking-wide text-(--dashboard-text-soft)">
          PROPOSED PLAN / READ ONLY
        </p>
        <h3 :id="`${id}-heading`" ref="heading" tabindex="-1" class="mt-2 text-xl font-semibold leading-8 text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)">
          {{ title }}
        </h3>
        <p class="mt-2 text-sm leading-6 text-(--dashboard-text-muted)">
          拟议处理计划 · 由外部 AI / IDE agent 在用户授权后执行
        </p>
      </div>
      <button type="button" class="min-h-11 rounded-sm border border-(--dashboard-border) px-3 text-sm text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)" @click="emit('close')">
        收起计划
      </button>
    </div>
    <div v-if="!invalidReason" class="plan-body mt-6 grid min-w-0 gap-7">
      <section class="min-w-0" :aria-labelledby="`${id}-steps`">
        <h4 :id="`${id}-steps`" class="text-base font-semibold text-(--dashboard-text)">
          源码级调查步骤
        </h4>
        <ol v-if="evidence.steps.length" class="mt-3 grid list-decimal gap-4 pl-5 text-sm leading-7 text-(--dashboard-text-muted)">
          <li v-for="step in evidence.steps" :key="step" class="pl-1">{{ step }}</li>
        </ol>
        <p v-else class="mt-3 text-sm leading-7 text-(--dashboard-text-muted)">
          当前证据尚未提供调查步骤；先核实报告与源码，再决定是否修改。
        </p>
      </section>
      <section class="plan-boundaries min-w-0 border-t border-(--dashboard-border) pt-5" :aria-labelledby="`${id}-boundaries`">
        <h4 :id="`${id}-boundaries`" class="text-base font-semibold text-(--dashboard-text)">
          授权与验证边界
        </h4>
        <p class="mt-3 text-sm leading-7 text-(--dashboard-text-muted)">
          Dashboard MCP 当前只读。复制不会发送任务给 AI，也不会授予编辑或运行权限。
        </p>
        <p class="mt-3 text-sm leading-7 text-(--dashboard-text-muted)">
          先核实源码、加载边界与影响范围，再讨论最小修改；不手写 dist，不把构建通过当作问题已解决。
        </p>
        <button
          type="button"
          class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-(--dashboard-accent) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)"
          @click="!invalidReason && emit('verification')"
        >
          查看复验条件
          <span class="icon-[mdi--arrow-right] size-4 shrink-0" aria-hidden="true" />
        </button>
      </section>
    </div>
    <p v-if="invalidReason" role="status" class="mt-5 border-l-2 border-(--dashboard-border-strong) pl-3 text-sm leading-7 text-(--dashboard-text)">
      原处理计划已失效：{{ invalidReason }} 请使用上方“重新准备处理计划”。
    </p>
    <label :for="`${id}-text`" class="mt-6 block border-t border-(--dashboard-border) pt-5 text-sm font-medium text-(--dashboard-text)">
      任务文本
      <span class="font-normal text-(--dashboard-text-soft)"> · 证据、数据缺口与复验条件</span>
    </label>
    <textarea
      :id="`${id}-text`"
      ref="textarea"
      readonly
      :value="visibleText"
      :aria-describedby="`${id}-status`"
      class="mt-3 block min-h-48 w-full min-w-0 resize-y rounded-sm border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3 font-mono text-sm leading-6 text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)"
      spellcheck="false"
    />
    <div class="mt-4 flex min-w-0 flex-wrap items-center gap-4">
      <button
        type="button"
        :disabled="Boolean(invalidReason)"
        class="min-h-11 rounded-sm border border-(--dashboard-border-strong) bg-(--dashboard-panel) px-4 text-sm font-medium text-(--dashboard-text) hover:bg-(--dashboard-accent-soft) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50"
        @click="copyContext"
      >
        复制 AI 上下文
      </button>
      <p :id="`${id}-status`" role="status" class="min-w-0 flex-1 basis-64 text-sm leading-6 text-(--dashboard-text-muted)">
        {{ status || '复制不会调用 AI；MCP 连接与工作区权限由外部客户端管理。' }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.diagnostic-plan {
  container: diagnostic-plan / inline-size;
}

@container diagnostic-plan (min-width: 44rem) {
  .plan-body {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 2rem;
  }

  .plan-boundaries {
    padding-top: 0;
    padding-left: 1.5rem;
    border-top: 0;
    border-left: 1px solid var(--dashboard-border);
  }
}
</style>
