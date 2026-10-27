<script setup lang="ts">
import type { DocsThemeConfig } from '../deployment/index.ts'
import { useData } from 'vitepress'

const { theme } = useData<DocsThemeConfig>()
</script>

<template>
  <div v-if="theme.docsDeployment.preview" class="docs-preview-banner" role="note">
    <strong>预览文档</strong>
    <span>包含尚未发布的更新。</span>
    <a :href="theme.docsDeployment.stableOrigin">查看稳定版文档 →</a>
  </div>
</template>

<style scoped>
:global(:root:has(.docs-preview-banner)) {
  --vp-layout-top-height: 44px;
}

.docs-preview-banner {
  position: fixed;
  inset: 0 0 auto;
  z-index: var(--vp-z-index-layout-top);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: center;
  justify-content: center;
  height: var(--vp-layout-top-height);
  padding: 8px 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}

@media (max-width: 480px) {
  :global(:root:has(.docs-preview-banner)) {
    --vp-layout-top-height: 64px;
  }
}

.docs-preview-banner a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
