<script setup lang="ts">
import type { InspectionNode } from '../../utils/objectInspection'
import { computed } from 'vue'
import { formatBytes } from '../../utils/format'

const props = defineProps<{ node: InspectionNode, artifact: InspectionNode | null }>()
const emit = defineEmits<{ select: [node: InspectionNode], content: [] }>()
const facts = computed(() => props.node.target.kind === 'module'
  ? [
      { label: '当前产物中的归因体积', value: props.node.measurements.attributedBytes },
      { label: '原始源码体积', value: props.node.measurements.sourceBytes },
    ]
  : [
      { label: '原始体积', value: props.node.measurements.rawBytes },
      { label: 'Gzip 实测', value: props.node.measurements.gzipBytes },
      { label: 'Brotli 实测', value: props.node.measurements.brotliBytes },
    ])
</script>

<template>
  <section class="object-evidence">
    <div>
      <h3>{{ node.target.kind === 'module' ? '模块证据' : node.target.kind === 'package' ? '包证据' : '产物证据' }}</h3>
      <dl class="evidence-facts">
        <div v-for="fact in facts" :key="fact.label">
          <dt>{{ fact.label }}</dt><dd>{{ fact.value === null ? '未测量' : formatBytes(fact.value) }}</dd>
        </div>
        <div v-if="node.target.kind !== 'module'"><dt>模块落点</dt><dd>{{ node.moduleCount }}</dd></div>
      </dl>
      <p v-if="node.target.kind === 'module'" class="evidence-note">归因是模块在此产物中的构成贡献，不是独立文件大小；原始源码体积与压缩体积不能混用，也不能据此推算节省。</p>
      <p v-else-if="node.target.kind === 'package'" class="evidence-note">包体积只汇总报告中的产物；任一成员缺少测量时，对应汇总为未测量。不同压缩算法分别展示。</p>
      <p v-else class="evidence-note">仅展示报告记录的真实测量。未记录压缩结果时，不使用估算值替代。</p>
    </div>
    <div class="evidence-context">
      <dl>
        <div><dt>所属包</dt><dd>{{ node.packageLabel }} <code>{{ node.target.packageId }}</code></dd></div>
        <div v-if="node.target.kind !== 'package'"><dt>产物路径</dt><dd><code>{{ node.target.file }}</code></dd></div>
        <div v-if="node.target.kind === 'module'"><dt>模块身份</dt><dd><code>{{ node.target.moduleId }}</code></dd></div>
      </dl>
      <p v-if="node.placementOnly">此落点仅由报告反向关联记录，未提供当前产物中的归因与源码读取授权。</p>
      <p v-else-if="node.target.kind === 'module' && !node.sourcePath">当前模块来源不可读取；仍可检查所属产物。</p>
      <button v-if="node.target.kind !== 'package'" type="button" @click="emit('content')">{{ node.sourcePath ? '读取源码与产物' : '检查产物内容' }}</button>
      <button v-if="node.target.kind === 'module' && artifact" type="button" @click="emit('select', artifact)">选择所属产物</button>
    </div>
  </section>
</template>

<style scoped>
.object-evidence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 28px;
}

.object-evidence h3 {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 550;
}

.evidence-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 28px;
  margin: 0;
}

.evidence-facts dt,
.evidence-context dt {
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--dashboard-text-soft);
}

.evidence-facts dd {
  margin: 0;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.evidence-note,
.evidence-context p {
  margin: 16px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--dashboard-text-muted);
}

.evidence-context {
  padding-left: 24px;
  border-left: 1px solid var(--dashboard-border);
}

.evidence-context dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

.evidence-context dd {
  margin: 0;
  font-size: 13px;
}

.evidence-context code {
  font-family: var(--dashboard-code);
  overflow-wrap: anywhere;
}

.evidence-context button {
  display: block;
  min-height: 40px;
  padding: 5px 0;
  margin-top: 12px;
  font-size: 13px;
  color: var(--dashboard-accent);
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 4px;
  background: transparent;
  border: 0;
}

@media (max-width: 760px) {
  .object-evidence {
    grid-template-columns: minmax(0, 1fr);
  }

  .evidence-context {
    padding-top: 18px;
    padding-left: 0;
    border-top: 1px solid var(--dashboard-border);
    border-left: 0;
  }
}
</style>
