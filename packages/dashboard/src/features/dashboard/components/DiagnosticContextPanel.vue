<script setup lang="ts">
import { computed, onMounted, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { copyTextSynchronously } from '../utils/clipboard'

const props = defineProps<{
  text: string
  invalidReason: string
}>()
const emit = defineEmits<{ close: [] }>()
const id = useId()
const heading = useTemplateRef<HTMLHeadingElement>('heading')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')
const status = shallowRef('')
const visibleText = computed(() => props.invalidReason ? `上下文已失效：${props.invalidReason}` : props.text)

watch([() => props.text, () => props.invalidReason], () => {
  status.value = ''
})
onMounted(() => {
  heading.value?.focus({ preventScroll: true })
  heading.value?.scrollIntoView({ block: 'nearest' })
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
    class="min-w-0 border-t border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4 sm:p-5"
    :aria-labelledby="`${id}-heading`"
    @keydown.esc.stop="emit('close')"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-mono text-xs tracking-wide text-(--dashboard-text-soft)">
          AI CONTEXT / READ ONLY
        </p>
        <h3 :id="`${id}-heading`" ref="heading" tabindex="-1" class="mt-1 text-lg font-semibold text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)">
          交给 AI 之前，先审阅证据与边界
        </h3>
      </div>
      <button type="button" class="min-h-11 rounded-md px-3 text-sm text-(--dashboard-text-muted) hover:bg-(--dashboard-panel) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)" @click="emit('close')">
        收起上下文
      </button>
    </div>
    <p class="mt-3 text-sm leading-6 text-(--dashboard-text-muted)">
      先让 AI 通过只读 MCP 复核当前项目与报告，再提出源码级最小修改和复验计划。编辑、终端执行需在外部客户端单独授权；这里不会启动修复，也不会自动判定问题已解决。
    </p>
    <p v-if="invalidReason" role="status" class="mt-3 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-(--dashboard-text)">
      {{ invalidReason }} 请使用上方“重新准备 AI 上下文”。
    </p>
    <label :for="`${id}-text`" class="mt-4 block text-sm font-medium text-(--dashboard-text)">问题、事实、数据缺口与复验条件</label>
    <textarea
      :id="`${id}-text`"
      ref="textarea"
      readonly
      :value="visibleText"
      :aria-describedby="`${id}-status`"
      class="mt-2 block min-h-72 w-full min-w-0 resize-y rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) p-3 font-mono text-sm leading-6 text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)"
      spellcheck="false"
    />
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="Boolean(invalidReason)"
        class="min-h-11 rounded-md border border-(--dashboard-border-strong) bg-(--dashboard-panel) px-4 text-sm font-medium text-(--dashboard-text) hover:bg-(--dashboard-accent-soft) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50"
        @click="copyContext"
      >
        复制 AI 上下文
      </button>
      <p :id="`${id}-status`" role="status" class="min-w-0 flex-1 text-sm leading-6 text-(--dashboard-text-muted)">
        {{ status || '复制不会调用 AI；MCP 连接与工作区权限由外部客户端管理。' }}
      </p>
    </div>
  </section>
</template>
