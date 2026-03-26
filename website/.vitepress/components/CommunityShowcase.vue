<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import showcaseEntries from '../../community/showcase.data.json'

interface ShowcaseAsset {
  kind: 'cover' | 'screenshot' | 'qrcode'
  originalUrl: string
  relativePath: string
}

interface ShowcaseEntry {
  id: number
  slug: string
  title: string
  description: string
  sourceCommentUrl: string
  createdAt: string
  author: string
  link?: string
  github?: string
  assets: ShowcaseAsset[]
}

interface PreviewState {
  src: string
  title: string
  caption: string
}

const props = defineProps<{
  entrySlug?: string
}>()

const entries = showcaseEntries as ShowcaseEntry[]
const expandedMap = ref<Record<string, boolean>>({})
const activePreview = ref<PreviewState | null>(null)
const LEADING_SLASH_RE = /^\/+/

const showcaseCards = computed(() => entries.map((entry) => {
  const qrcodes = entry.assets.filter(asset => asset.kind === 'qrcode')
  const screenshots = entry.assets.filter(asset => asset.kind === 'cover' || asset.kind === 'screenshot')
  const primaryAsset = qrcodes[0] ?? screenshots[0] ?? null
  const galleryScreenshots = primaryAsset && !qrcodes.length
    ? screenshots.filter(asset => asset.relativePath !== primaryAsset.relativePath)
    : screenshots

  return {
    ...entry,
    qrcodes,
    screenshots,
    galleryScreenshots,
    primaryAsset,
    hasQrcode: qrcodes.length > 0,
  }
}))

const currentEntry = computed(() => {
  if (!props.entrySlug) {
    return null
  }

  return showcaseCards.value.find(entry => entry.slug === props.entrySlug) ?? null
})

function toggleScreenshots(slug: string) {
  expandedMap.value = {
    ...expandedMap.value,
    [slug]: !expandedMap.value[slug],
  }
}

function isExpanded(slug: string) {
  return Boolean(expandedMap.value[slug])
}

function resolveAssetUrl(relativePath: string) {
  return `/${relativePath.replace(LEADING_SLASH_RE, '')}`
}

function resolveAuthorUrl(author: string) {
  return `https://github.com/${author}`
}

function openPreview(src: string, title: string, caption: string) {
  activePreview.value = { src, title, caption }
}

function closePreview() {
  activePreview.value = null
}

function onPreviewBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    closePreview()
  }
}
</script>

<template>
  <section class="community-showcase">
    <article v-if="currentEntry" class="showcase-card">
      <div class="showcase-card__panel">
        <div class="showcase-card__copy">
          <div class="showcase-card__meta">
            <a
              class="showcase-card__author"
              :href="resolveAuthorUrl(currentEntry.author)"
              target="_blank"
              rel="noreferrer"
            >
              <Icon icon="mdi:github" aria-hidden="true" />
              @{{ currentEntry.author }}
            </a>
          </div>

          <p class="showcase-card__desc">
            {{ currentEntry.description }}
          </p>

          <div class="showcase-card__links">
            <a v-if="currentEntry.link" :href="currentEntry.link" target="_blank" rel="noreferrer">
              <Icon icon="mdi:link-variant" aria-hidden="true" />
              项目地址
            </a>
            <a v-if="currentEntry.github" :href="currentEntry.github" target="_blank" rel="noreferrer">
              <Icon icon="mdi:github" aria-hidden="true" />
              GitHub
            </a>
            <a :href="currentEntry.sourceCommentUrl" target="_blank" rel="noreferrer">
              <Icon icon="mdi:comment-text-outline" aria-hidden="true" />
              来源评论
            </a>
          </div>

          <div v-if="currentEntry.galleryScreenshots.length > 0" class="showcase-card__actions">
            <button
              type="button"
              class="showcase-card__toggle"
              :aria-expanded="isExpanded(currentEntry.slug)"
              @click="toggleScreenshots(currentEntry.slug)"
            >
              <Icon
                :icon="isExpanded(currentEntry.slug) ? 'mdi:chevron-up' : 'mdi:image-multiple-outline'"
                aria-hidden="true"
              />
              {{ isExpanded(currentEntry.slug) ? '收起应用截图' : `展开应用截图（${currentEntry.galleryScreenshots.length}）` }}
            </button>
          </div>
        </div>

        <div class="showcase-card__visual">
          <button
            v-if="currentEntry.primaryAsset"
            type="button"
            class="showcase-card__preview"
            @click="openPreview(resolveAssetUrl(currentEntry.primaryAsset.relativePath), currentEntry.title, currentEntry.hasQrcode ? '小程序二维码，点击后可放大识别。' : '应用截图预览，点击后可放大查看。')"
          >
            <img
              :src="resolveAssetUrl(currentEntry.primaryAsset.relativePath)"
              :alt="currentEntry.hasQrcode ? `${currentEntry.title} 小程序二维码` : `${currentEntry.title} 应用预览图`"
            >
          </button>
          <span class="showcase-card__preview-tip">
            <Icon icon="mdi:magnify-plus-outline" aria-hidden="true" />
            点击图片放大
          </span>
        </div>
      </div>

      <transition name="showcase-expand">
        <div v-if="isExpanded(currentEntry.slug)" class="showcase-card__shots">
          <button
            v-for="(asset, index) in currentEntry.galleryScreenshots"
            :key="`${currentEntry.slug}-${asset.relativePath}`"
            type="button"
            class="showcase-shot"
            @click="openPreview(resolveAssetUrl(asset.relativePath), currentEntry.title, `应用截图 ${index + 1}`)"
          >
            <img :src="resolveAssetUrl(asset.relativePath)" :alt="`${currentEntry.title} 应用截图 ${index + 1}`">
            <span>
              <Icon icon="mdi:image-outline" aria-hidden="true" />
              截图 {{ index + 1 }}
            </span>
          </button>
        </div>
      </transition>
    </article>

    <p v-else class="showcase-card__missing">
      当前案例不存在。
    </p>

    <teleport to="body">
      <div
        v-if="activePreview"
        class="showcase-lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="activePreview.title"
        @click="onPreviewBackdropClick"
      >
        <div class="showcase-lightbox__dialog">
          <button type="button" class="showcase-lightbox__close" aria-label="关闭预览" @click="closePreview">
            <Icon icon="mdi:close" aria-hidden="true" />
            关闭
          </button>
          <img :src="activePreview.src" :alt="activePreview.title">
          <div class="showcase-lightbox__meta">
            <strong>{{ activePreview.title }}</strong>
            <p>{{ activePreview.caption }}</p>
          </div>
        </div>
      </div>
    </teleport>
  </section>
</template>

<style scoped>
.community-showcase {
  --showcase-surface: linear-gradient(
    180deg,
    color-mix(in srgb, var(--vp-c-bg-soft) 88%, var(--vp-c-bg)),
    color-mix(in srgb, var(--vp-c-bg-alt) 86%, var(--vp-c-bg))
  );
  --showcase-card: linear-gradient(
    135deg,
    color-mix(in srgb, var(--vp-c-bg) 92%, var(--vp-c-text-1) 8%),
    color-mix(in srgb, var(--vp-c-bg-soft) 95%, var(--vp-c-text-1) 5%)
  );
  --showcase-border: color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent);
  --showcase-shadow: 0 14px 34px color-mix(in srgb, var(--vp-c-bg) 72%, transparent);
  --showcase-text: var(--vp-c-text-1);
  --showcase-muted: var(--vp-c-text-2);
  --showcase-accent: var(--vp-c-brand-1);
  --showcase-accent-soft: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
  --showcase-panel-gloss:
    radial-gradient(circle at right top, color-mix(in srgb, var(--showcase-accent) 12%, transparent), transparent 30%),
    linear-gradient(180deg, color-mix(in srgb, var(--vp-c-text-1) 10%, transparent), transparent 42%);
  --showcase-hover-shadow: 0 24px 56px color-mix(in srgb, var(--vp-c-bg) 52%, transparent);
  --showcase-control-bg: color-mix(in srgb, var(--vp-c-bg) 76%, var(--vp-c-text-1) 24%);
  --showcase-preview-bg: linear-gradient(
    145deg,
    color-mix(in srgb, var(--vp-c-bg) 84%, var(--vp-c-text-1) 16%),
    color-mix(in srgb, var(--vp-c-bg-soft) 90%, var(--vp-c-brand-1) 10%)
  );
  --showcase-preview-tip-bg: color-mix(in srgb, var(--vp-c-bg) 70%, var(--vp-c-text-1) 30%);
  --showcase-shot-bg: color-mix(in srgb, var(--vp-c-bg) 78%, var(--vp-c-text-1) 22%);
  --showcase-lightbox-backdrop: color-mix(in srgb, var(--vp-c-bg) 72%, transparent);
  --showcase-lightbox-card: color-mix(in srgb, var(--vp-c-bg) 92%, var(--vp-c-text-1) 8%);
  --showcase-lightbox-border: color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent);
  --showcase-lightbox-meta: var(--vp-c-text-1);
  --showcase-lightbox-muted: var(--vp-c-text-2);
  --showcase-lightbox-close-bg: color-mix(in srgb, var(--vp-c-bg) 72%, var(--vp-c-text-1) 28%);
  --showcase-lightbox-close-border: color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent);

  display: grid;
  gap: 1rem;
  color: var(--showcase-text);
}

:global(.vp-doc h2) {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

:global(.vp-doc h2 a.header-anchor) {
  opacity: 0.45;
}

.showcase-card {
  position: relative;
  overflow: hidden;
  background: var(--showcase-card);
  border: 1px solid var(--showcase-border);
  border-radius: 20px;
  box-shadow: var(--showcase-shadow);
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.showcase-card:hover {
  border-color: color-mix(in srgb, var(--showcase-accent) 26%, var(--showcase-border));
  box-shadow: var(--showcase-hover-shadow);
  transform: translateY(-2px);
}

.showcase-card::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background: var(--showcase-panel-gloss);
}

.showcase-card__panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 9.8rem;
  gap: 0.8rem;
  padding: 0.85rem;
}

.showcase-card__copy {
  min-width: 0;
}

.showcase-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 0.45rem;
}

.showcase-card__author {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 999px;
}

.showcase-card__author {
  display: inline-flex;
  gap: 0.28rem;
  color: var(--showcase-accent);
  text-decoration: none;
  background: var(--showcase-accent-soft);
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease;
}

.showcase-card__author:hover {
  background: color-mix(in srgb, var(--showcase-accent-soft) 72%, white);
  transform: translateY(-1px);
}

.showcase-card__desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--showcase-muted);
  -webkit-box-orient: vertical;
}

.showcase-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.65rem;
}

.showcase-card__links a,
.showcase-card__toggle {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
  min-height: 1.85rem;
  padding: 0.36rem 0.62rem;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--showcase-text);
  text-decoration: none;
  background: var(--showcase-control-bg);
  border: 1px solid var(--showcase-border);
  border-radius: 999px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.showcase-card__links a:hover,
.showcase-card__toggle:hover {
  background: var(--showcase-accent-soft);
  border-color: color-mix(in srgb, var(--showcase-accent) 42%, transparent);
  box-shadow: 0 6px 16px rgb(31 122 69 / 10%);
  transform: translateY(-1px);
}

.showcase-card__actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.55rem;
}

.showcase-card__toggle {
  cursor: pointer;
}

.showcase-card__missing {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--showcase-muted);
}

.showcase-card__missing {
  margin: 0;
}

.showcase-card__visual {
  display: grid;
  align-content: start;
  justify-items: center;
}

.showcase-card__preview {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 9.6rem;
  padding: 0.45rem;
  overflow: hidden;
  cursor: zoom-in;
  background: var(--showcase-preview-bg);
  border: 1px solid var(--showcase-border);
  border-radius: 18px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.showcase-card__preview:hover {
  border-color: color-mix(in srgb, var(--showcase-accent) 34%, transparent);
  box-shadow: 0 12px 28px rgb(15 23 42 / 10%);
  transform: translateY(-1px);
}

.showcase-card__preview img {
  width: min(100%, 8.7rem);
  max-height: 8.7rem;
  object-fit: contain;
  border-radius: 14px;
  box-shadow: 0 10px 26px rgb(15 23 42 / 14%);
}

.showcase-card__preview-tip {
  display: inline-flex;
  gap: 0.22rem;
  align-items: center;
  padding: 0.14rem 0.45rem;
  margin-top: 0.35rem;
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--showcase-accent);
  background: var(--showcase-preview-tip-bg);
  border: 1px solid var(--showcase-border);
  border-radius: 999px;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.showcase-card__visual:hover .showcase-card__preview-tip,
.showcase-card__preview:focus-visible + .showcase-card__preview-tip {
  opacity: 1;
  transform: translateY(0);
}

.showcase-card__shots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.65rem;
  padding: 0 0.85rem 0.85rem;
}

.showcase-shot {
  display: grid;
  gap: 0.4rem;
  padding: 0.6rem;
  cursor: zoom-in;
  background: var(--showcase-shot-bg);
  border: 1px solid var(--showcase-border);
  border-radius: 16px;
}

.showcase-shot img {
  width: 100%;
  aspect-ratio: 9 / 16;
  object-fit: cover;
  border-radius: 14px;
}

.showcase-shot span {
  display: inline-flex;
  gap: 0.28rem;
  align-items: center;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--showcase-muted);
}

.showcase-expand-enter-active,
.showcase-expand-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.showcase-expand-enter-from,
.showcase-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.showcase-lightbox {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--showcase-lightbox-backdrop);
  backdrop-filter: blur(10px);
}

.showcase-lightbox__dialog {
  position: relative;
  display: grid;
  gap: 0.9rem;
  width: min(92vw, 38rem);
  max-height: 92vh;
  padding: 1rem;
  background: var(--showcase-lightbox-card);
  border: 1px solid var(--showcase-lightbox-border);
  border-radius: 24px;
  box-shadow: 0 40px 120px rgb(0 0 0 / 45%);
}

.showcase-lightbox__dialog img {
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 18px;
}

.showcase-lightbox__meta {
  color: var(--showcase-lightbox-meta);
}

.showcase-lightbox__meta p {
  margin: 0.35rem 0 0;
  color: var(--showcase-lightbox-muted);
}

.showcase-lightbox__close {
  display: inline-flex;
  gap: 0.32rem;
  align-items: center;
  justify-self: end;
  min-height: 2.2rem;
  padding: 0.35rem 0.8rem;
  color: var(--showcase-lightbox-meta);
  cursor: pointer;
  background: var(--showcase-lightbox-close-bg);
  border: 1px solid var(--showcase-lightbox-close-border);
  border-radius: 999px;
}

@media (max-width: 960px) {
  .showcase-card__panel {
    grid-template-columns: 1fr;
  }

  .showcase-card__preview {
    min-height: 12rem;
  }

  .showcase-card__preview img {
    width: min(100%, 11rem);
    max-height: 11rem;
  }
}

@media (max-width: 640px) {
  :global(.vp-doc h2) {
    margin-top: 0.9rem;
    margin-bottom: 0.45rem;
  }

  .showcase-card__panel {
    padding: 1rem;
  }

  .showcase-card__shots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .showcase-card__preview-tip {
    display: none;
  }
}
</style>
