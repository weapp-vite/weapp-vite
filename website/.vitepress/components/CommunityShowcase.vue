<script setup lang="ts">
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

const entries = showcaseEntries as ShowcaseEntry[]
const expandedMap = ref<Record<string, boolean>>({})
const activePreview = ref<PreviewState | null>(null)
const LEADING_SLASH_RE = /^\/+/

const qrRecognitionSteps = [
  '手机微信内打开本页时，长按图片即可识别小程序码。',
  '电脑端浏览时，用手机微信“扫一扫”直接扫页面上的码。',
  '如果页面缩放后不易识别，先点击图片放大，再识别或保存到相册后从微信扫一扫导入。',
]

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
    <header class="community-showcase__hero">
      <div class="community-showcase__hero-copy">
        <p class="community-showcase__eyebrow">
          community showcase
        </p>
        <h1 class="community-showcase__title">
          优秀小程序案例
        </h1>
        <p class="community-showcase__lead">
          默认优先展示小程序二维码，方便直接打开体验。应用截图收进展开区，避免页面一上来被长图完全铺满。
        </p>
      </div>

      <aside class="community-showcase__guide" aria-label="小程序码识别方法">
        <p class="community-showcase__guide-title">
          小程序码识别方法
        </p>
        <ol class="community-showcase__guide-list">
          <li v-for="step in qrRecognitionSteps" :key="step">
            {{ step }}
          </li>
        </ol>
      </aside>
    </header>

    <div class="community-showcase__grid">
      <article
        v-for="entry in showcaseCards"
        :key="entry.slug"
        class="showcase-card"
      >
        <div class="showcase-card__panel">
          <div class="showcase-card__copy">
            <div class="showcase-card__meta">
              <span class="showcase-card__badge">{{ entry.hasQrcode ? '可直接识别' : '暂缺小程序码' }}</span>
              <span class="showcase-card__author">@{{ entry.author }}</span>
            </div>

            <h2 class="showcase-card__title">
              {{ entry.title }}
            </h2>
            <p class="showcase-card__desc">
              {{ entry.description }}
            </p>

            <div class="showcase-card__links">
              <a v-if="entry.link" :href="entry.link" target="_blank" rel="noreferrer">项目地址</a>
              <a v-if="entry.github" :href="entry.github" target="_blank" rel="noreferrer">GitHub</a>
              <a :href="entry.sourceCommentUrl" target="_blank" rel="noreferrer">来源评论</a>
            </div>

            <div class="showcase-card__actions">
              <button
                v-if="entry.galleryScreenshots.length > 0"
                type="button"
                class="showcase-card__toggle"
                :aria-expanded="isExpanded(entry.slug)"
                @click="toggleScreenshots(entry.slug)"
              >
                {{ isExpanded(entry.slug) ? '收起应用截图' : `展开应用截图（${entry.galleryScreenshots.length}）` }}
              </button>
              <span v-else class="showcase-card__hint">
                当前评论未附加更多应用截图
              </span>
            </div>
          </div>

          <div class="showcase-card__visual">
            <button
              v-if="entry.primaryAsset"
              type="button"
              class="showcase-card__preview"
              @click="openPreview(resolveAssetUrl(entry.primaryAsset.relativePath), entry.title, entry.hasQrcode ? '小程序二维码，点击后可放大识别。' : '当前案例未提供小程序二维码，暂以应用截图代替。')"
            >
              <img
                :src="resolveAssetUrl(entry.primaryAsset.relativePath)"
                :alt="entry.hasQrcode ? `${entry.title} 小程序二维码` : `${entry.title} 应用预览图`"
              >
              <span class="showcase-card__preview-tip">
                点击放大
              </span>
            </button>

            <p class="showcase-card__caption">
              {{ entry.hasQrcode ? '默认展示小程序二维码，方便直接扫码或长按识别。' : '该案例暂无小程序二维码，暂以应用截图作为默认展示。' }}
            </p>
          </div>
        </div>

        <transition name="showcase-expand">
          <div v-if="isExpanded(entry.slug)" class="showcase-card__shots">
            <button
              v-for="(asset, index) in entry.galleryScreenshots"
              :key="`${entry.slug}-${asset.relativePath}`"
              type="button"
              class="showcase-shot"
              @click="openPreview(resolveAssetUrl(asset.relativePath), entry.title, `应用截图 ${index + 1}`)"
            >
              <img :src="resolveAssetUrl(asset.relativePath)" :alt="`${entry.title} 应用截图 ${index + 1}`">
              <span>截图 {{ index + 1 }}</span>
            </button>
          </div>
        </transition>
      </article>
    </div>

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
  --showcase-surface: linear-gradient(180deg, rgb(253 254 251 / 96%), rgb(247 250 246 / 98%));
  --showcase-card: linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(245 248 243 / 96%));
  --showcase-border: rgb(22 101 52 / 14%);
  --showcase-shadow: 0 24px 70px rgb(22 101 52 / 10%);
  --showcase-text: #17301c;
  --showcase-muted: #4d6856;
  --showcase-accent: #1f7a45;
  --showcase-accent-soft: rgb(31 122 69 / 10%);

  display: grid;
  gap: 2rem;
  color: var(--showcase-text);
}

:global(.dark) .community-showcase {
  --showcase-surface: linear-gradient(180deg, rgb(12 24 18 / 96%), rgb(10 18 15 / 98%));
  --showcase-card: linear-gradient(180deg, rgb(18 33 25 / 96%), rgb(12 23 18 / 98%));
  --showcase-border: rgb(134 239 172 / 16%);
  --showcase-shadow: 0 26px 80px rgb(0 0 0 / 38%);
  --showcase-text: #eaf7ee;
  --showcase-muted: #a4c3af;
  --showcase-accent: #7fe59d;
  --showcase-accent-soft: rgb(127 229 157 / 12%);
}

.community-showcase__hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.9fr);
  gap: 1.25rem;
  padding: 1.4rem;
  overflow: hidden;
  background: var(--showcase-surface);
  border: 1px solid var(--showcase-border);
  border-radius: 28px;
  box-shadow: var(--showcase-shadow);
}

.community-showcase__hero::before {
  position: absolute;
  inset: auto -4rem -6rem auto;
  width: 16rem;
  height: 16rem;
  pointer-events: none;
  content: '';
  background: radial-gradient(circle, rgb(109 211 138 / 28%) 0%, rgb(109 211 138 / 0%) 68%);
  border-radius: 999px;
}

.community-showcase__eyebrow {
  margin: 0 0 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--showcase-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.community-showcase__title {
  margin: 0;
  font-size: clamp(2rem, 3.8vw, 3.2rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.community-showcase__lead {
  max-width: 42rem;
  margin: 0.9rem 0 0;
  font-size: 1.02rem;
  line-height: 1.8;
  color: var(--showcase-muted);
}

.community-showcase__guide {
  position: relative;
  align-self: end;
  padding: 1rem 1.1rem;
  background: var(--showcase-card);
  border: 1px solid var(--showcase-border);
  border-radius: 22px;
}

.community-showcase__guide-title {
  margin: 0 0 0.7rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.community-showcase__guide-list {
  padding-left: 1rem;
  margin: 0;
  line-height: 1.75;
  color: var(--showcase-muted);
}

.community-showcase__grid {
  display: grid;
  gap: 1.25rem;
}

.showcase-card {
  overflow: hidden;
  background: var(--showcase-card);
  border: 1px solid var(--showcase-border);
  border-radius: 26px;
  box-shadow: var(--showcase-shadow);
}

.showcase-card__panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.72fr);
  gap: 1.35rem;
  padding: 1.4rem;
}

.showcase-card__copy {
  min-width: 0;
}

.showcase-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  margin-bottom: 0.8rem;
}

.showcase-card__badge,
.showcase-card__author {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding: 0.2rem 0.7rem;
  font-size: 0.8rem;
  border-radius: 999px;
}

.showcase-card__badge {
  color: white;
  background: var(--showcase-accent);
}

.showcase-card__author {
  color: var(--showcase-accent);
  background: var(--showcase-accent-soft);
}

.showcase-card__title {
  margin: 0;
  font-size: clamp(1.4rem, 2.2vw, 2rem);
  line-height: 1.15;
}

.showcase-card__desc {
  margin: 0.9rem 0 0;
  line-height: 1.8;
  color: var(--showcase-muted);
}

.showcase-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1rem;
}

.showcase-card__links a,
.showcase-card__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0.6rem 0.95rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--showcase-text);
  text-decoration: none;
  background: rgb(255 255 255 / 64%);
  border: 1px solid var(--showcase-border);
  border-radius: 999px;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}

:global(.dark) .showcase-card__links a,
:global(.dark) .showcase-card__toggle {
  background: rgb(255 255 255 / 4%);
}

.showcase-card__links a:hover,
.showcase-card__toggle:hover {
  background: var(--showcase-accent-soft);
  border-color: color-mix(in srgb, var(--showcase-accent) 42%, transparent);
  transform: translateY(-1px);
}

.showcase-card__actions {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  margin-top: 1rem;
}

.showcase-card__toggle {
  cursor: pointer;
}

.showcase-card__hint,
.showcase-card__caption {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--showcase-muted);
}

.showcase-card__visual {
  display: grid;
  gap: 0.85rem;
  align-content: start;
}

.showcase-card__preview {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 19rem;
  padding: 1rem;
  overflow: hidden;
  cursor: zoom-in;
  background: linear-gradient(145deg, rgb(255 255 255 / 70%), rgb(224 239 229 / 62%));
  border: 1px solid var(--showcase-border);
  border-radius: 24px;
}

:global(.dark) .showcase-card__preview {
  background: linear-gradient(145deg, rgb(30 48 39 / 72%), rgb(17 29 23 / 90%));
}

.showcase-card__preview img {
  width: min(100%, 18rem);
  max-height: 22rem;
  object-fit: contain;
  border-radius: 20px;
  box-shadow: 0 18px 45px rgb(15 23 42 / 18%);
}

.showcase-card__preview-tip {
  position: absolute;
  right: 0.9rem;
  bottom: 0.9rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: white;
  background: rgb(12 24 18 / 82%);
  border-radius: 999px;
}

.showcase-card__shots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.9rem;
  padding: 0 1.4rem 1.4rem;
}

.showcase-shot {
  display: grid;
  gap: 0.55rem;
  padding: 0.8rem;
  cursor: zoom-in;
  background: rgb(255 255 255 / 56%);
  border: 1px solid var(--showcase-border);
  border-radius: 20px;
}

:global(.dark) .showcase-shot {
  background: rgb(255 255 255 / 3%);
}

.showcase-shot img {
  width: 100%;
  aspect-ratio: 9 / 16;
  object-fit: cover;
  border-radius: 14px;
}

.showcase-shot span {
  font-size: 0.84rem;
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
  background: rgb(3 8 6 / 78%);
  backdrop-filter: blur(10px);
}

.showcase-lightbox__dialog {
  position: relative;
  display: grid;
  gap: 0.9rem;
  width: min(92vw, 38rem);
  max-height: 92vh;
  padding: 1rem;
  background: rgb(10 18 15 / 95%);
  border: 1px solid rgb(255 255 255 / 10%);
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
  color: rgb(229 243 233);
}

.showcase-lightbox__meta p {
  margin: 0.35rem 0 0;
  color: rgb(170 198 178);
}

.showcase-lightbox__close {
  justify-self: end;
  min-height: 2.2rem;
  padding: 0.35rem 0.8rem;
  color: white;
  cursor: pointer;
  background: rgb(255 255 255 / 6%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 999px;
}

@media (max-width: 960px) {
  .community-showcase__hero,
  .showcase-card__panel {
    grid-template-columns: 1fr;
  }

  .showcase-card__preview {
    min-height: 15rem;
  }
}

@media (max-width: 640px) {
  .community-showcase__hero,
  .showcase-card__panel {
    padding: 1rem;
  }

  .showcase-card__shots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0 1rem 1rem;
  }

  .community-showcase__guide-list {
    font-size: 0.92rem;
  }
}
</style>
