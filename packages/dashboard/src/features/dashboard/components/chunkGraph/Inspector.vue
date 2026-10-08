<script setup lang="ts">
import type { AnalyzeChunkGraphEdgeKind, AnalyzeChunkGraphView } from '../../utils/analyzeChunkGraph'
import { computed, nextTick, useTemplateRef } from 'vue'
import { createChunkGraphDetails } from '../../utils/chunkGraphDetails'
import { formatBytes } from '../../utils/format'
import AppSelect from '../AppSelect.vue'

const props = defineProps<{
  view: AnalyzeChunkGraphView
  selectedId: string | null
  unresolvedImportCount: number
}>()

const emit = defineEmits<{
  selectNode: [id: string | null]
}>()

const selectionHeading = useTemplateRef<HTMLHeadingElement>('selectionHeading')
const details = computed(() => createChunkGraphDetails(props.view, props.selectedId))
const nodeOptions = computed(() => [
  { label: props.view.nodes.length ? '选择当前视图中的节点' : '当前视图没有节点', value: '' },
  ...props.view.nodes.map(node => ({
    label: node.kind === 'package' ? `包 · ${node.label}` : `${node.label} · ${node.packageLabel}`,
    value: node.id,
  })),
])
const relationKindLabels: Record<AnalyzeChunkGraphEdgeKind, string> = {
  'contains': '包内归属',
  'dynamic-import': '动态导入',
  'static-import': '静态导入',
}
const relationSections = computed(() => details.value.selected?.kind === 'package'
  ? [{
      id: 'children',
      title: '包内代码产物',
      relations: details.value.children,
      empty: '当前视图中未显示此包与代码产物的归属关系。',
    }]
  : [{
      id: 'outgoing',
      title: '导入的产物',
      relations: details.value.outgoing,
      empty: '当前视图中未显示此产物的静态或动态导入。',
    }, {
      id: 'incoming',
      title: '引用此产物',
      relations: details.value.incoming,
      empty: '当前视图中未显示引用此产物的静态或动态导入。',
    }])

async function selectRelatedNode(id: string) {
  emit('selectNode', id)
  await nextTick()
  selectionHeading.value?.focus({ preventScroll: true })
  selectionHeading.value?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
}
</script>

<template>
  <aside aria-label="依赖图节点详情" class="min-h-0 min-w-0 border-t border-(--dashboard-border) bg-(--dashboard-panel) text-sm leading-6 text-(--dashboard-text) xl:overflow-y-auto xl:border-t-0 xl:border-l">
    <header class="border-b border-(--dashboard-border) px-4 py-4">
      <h3 class="text-base font-semibold">
        节点详情
      </h3>
      <AppSelect
        class="mt-3"
        label="选择依赖图节点"
        :model-value="details.selected?.id ?? ''"
        :options="nodeOptions"
        :disabled="view.nodes.length === 0"
        @update:model-value="emit('selectNode', $event || null)"
      />
    </header>

    <template v-if="details.selected">
      <section class="min-w-0 px-4 py-4" aria-label="当前节点信息">
        <h4
          ref="selectionHeading"
          tabindex="-1"
          class="min-w-0 rounded-sm text-base leading-6 font-semibold [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
          :class="details.selected.kind === 'chunk' ? 'font-mono' : undefined"
        >
          {{ details.selected.label }}
        </h4>
        <dl class="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          <dt class="text-(--dashboard-text-soft)">
            类型
          </dt>
          <dd>
            {{ details.selected.kind === 'package' ? '包' : '代码产物' }}
          </dd>
          <template v-if="details.selected.kind === 'chunk'">
            <dt class="text-(--dashboard-text-soft)">
              入口状态
            </dt>
            <dd>
              {{ details.selected.isEntry === undefined ? '未标注' : details.selected.isEntry ? '入口产物' : '非入口产物' }}
            </dd>
            <dt class="text-(--dashboard-text-soft)">
              所属包
            </dt>
            <dd class="min-w-0 [overflow-wrap:anywhere]">
              {{ details.selected.packageLabel }}
            </dd>
          </template>
          <dt class="text-(--dashboard-text-soft)">
            包标识
          </dt>
          <dd class="min-w-0 font-mono [overflow-wrap:anywhere]">
            {{ details.selected.packageId }}
          </dd>
          <dt class="text-(--dashboard-text-soft)">
            {{ details.selected.kind === 'package' ? '全包体积' : '产物体积' }}
          </dt>
          <dd class="font-mono tabular-nums">
            {{ formatBytes(details.selected.size) }}
          </dd>
          <template v-if="details.selected.kind === 'chunk' && details.selected.moduleCount !== undefined">
            <dt class="text-(--dashboard-text-soft)">
              模块数
            </dt>
            <dd class="font-mono tabular-nums">
              {{ details.selected.moduleCount }}
            </dd>
          </template>
          <template v-if="details.selected.kind === 'package' && details.selected.fileCount !== undefined">
            <dt class="text-(--dashboard-text-soft)">
              全包文件数
            </dt>
            <dd class="font-mono tabular-nums">
              {{ details.selected.fileCount }}
            </dd>
          </template>
        </dl>
        <p v-if="details.selected.kind === 'package'" class="mt-3 text-(--dashboard-text-soft)">
          全包体积与文件数来自完整报告，包含非代码文件，不随当前视图筛选变化。
        </p>
      </section>

      <div class="border-t border-(--dashboard-border) px-4 pt-4 text-(--dashboard-text-soft)">
        <p>以下仅列出当前视图中的关系。点击条目切换节点，不改变筛选。</p>
        <p v-if="details.selected.kind === 'package'" class="mt-2">
          包内归属不是导入关系；选择代码产物可查看它的导入与引用。
        </p>
      </div>
      <section v-for="section in relationSections" :key="section.id" class="min-w-0 px-4 py-4" :aria-label="section.title">
        <h4 class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-semibold">
          <span>{{ section.title }}</span>
          <span class="font-normal text-(--dashboard-text-soft)"><span class="font-mono tabular-nums">{{ section.relations.length }}</span> 条关系</span>
        </h4>
        <p v-if="!section.relations.length" class="mt-2 text-(--dashboard-text-soft)">
          {{ section.empty }}
        </p>
        <ul v-else class="mt-2 divide-y divide-(--dashboard-border)">
          <li v-for="relation in section.relations" :key="relation.id" class="min-w-0">
            <button
              type="button"
              class="group -mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-start gap-2 rounded-sm px-1 py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
              :aria-label="`${section.title}：查看 ${relation.node.label}，${relationKindLabels[relation.kind]}，所属包 ${relation.node.packageLabel}（${relation.node.packageId}）`"
              @click="selectRelatedNode(relation.node.id)"
            >
              <span class="min-w-0 flex-1">
                <span class="block font-mono [overflow-wrap:anywhere] group-hover:text-(--dashboard-accent)">{{ relation.node.label }}</span>
                <span class="mt-1 block text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
                  {{ relationKindLabels[relation.kind] }} · {{ relation.node.packageLabel }}
                </span>
              </span>
              <span aria-hidden="true" class="icon-[mdi--arrow-top-right] mt-1 size-4 shrink-0 text-(--dashboard-text-soft) group-hover:text-(--dashboard-accent)" />
            </button>
          </li>
        </ul>
      </section>
    </template>
    <section v-else class="px-4 py-6" aria-label="节点选择提示">
      <h4 class="font-semibold">
        {{ view.nodes.length ? '选择一个节点开始查看' : '当前视图没有节点' }}
      </h4>
      <p class="mt-2 text-(--dashboard-text-soft)">
        {{ view.nodes.length ? '点击图中节点，或使用上方选择器，查看完整路径、体积与可见关系。' : '当前筛选下没有可显示的代码产物。可调整搜索或包筛选后继续查看。' }}
      </p>
    </section>

    <section class="border-t border-(--dashboard-border) px-4 py-4" aria-label="当前视图概览">
      <h4 class="font-semibold">
        当前视图
      </h4>
      <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <dt class="text-(--dashboard-text-soft)">可见节点</dt>
          <dd class="font-mono tabular-nums">{{ view.nodes.length }}</dd>
        </div>
        <div>
          <dt class="text-(--dashboard-text-soft)">可见关系</dt>
          <dd class="font-mono tabular-nums">{{ view.edges.length }}</dd>
        </div>
        <div>
          <dt class="text-(--dashboard-text-soft)">静态导入</dt>
          <dd class="font-mono tabular-nums">{{ details.staticImportCount }}</dd>
        </div>
        <div>
          <dt class="text-(--dashboard-text-soft)">动态导入</dt>
          <dd class="font-mono tabular-nums">{{ details.dynamicImportCount }}</dd>
        </div>
      </dl>
      <p class="mt-3 text-(--dashboard-text-soft)">
        仅统计画布中的可见节点与关系；可见关系包含包内归属，不等同于导入数量。
      </p>
      <p v-if="view.truncatedNodeCount || view.truncatedEdgeCount" class="mt-3 border-l-2 border-(--dashboard-border-strong) pl-3 text-(--dashboard-text-muted)">
        为保持交互流畅，当前范围另有 {{ view.truncatedNodeCount }} 个节点与 {{ view.truncatedEdgeCount }} 条关系未显示。以上统计和关系列表仅覆盖可见部分。
      </p>
      <p v-if="unresolvedImportCount" class="mt-3 border-l-2 border-(--dashboard-border-strong) pl-3 text-(--dashboard-text-muted)">
        完整报告有 {{ unresolvedImportCount }} 条导入未解析为图中产物，可能指向外部或未输出的产物，不计入当前视图的导入数量。
      </p>
      <details class="mt-3">
        <summary class="min-h-11 cursor-pointer content-center rounded-sm text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
          图例与阅读方式
        </summary>
        <ul class="mt-1 space-y-2 text-(--dashboard-text-soft)">
          <li>蓝色实线：静态导入。</li>
          <li>橙色虚线：动态导入。</li>
          <li>淡色连线：包内归属，不代表导入。</li>
          <li>箭头从导入方指向被导入的产物；节点颜色区分所属包。</li>
        </ul>
      </details>
    </section>
  </aside>
</template>
