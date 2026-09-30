// .vitepress/theme/index.ts
import type { EnhanceAppContext, Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { useRoute } from 'vitepress'
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent, h, onMounted, onUnmounted, watch } from 'vue'
import Layout from './Layout.vue'
import '@shikijs/vitepress-twoslash/style.css'
import './index.css'
import './index.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'virtual:group-icons.css'

const DirectoryStructureCatalog = defineAsyncComponent(
  () => import('../../components/DirectoryStructureCatalog.vue'),
)
const AiLearningPage = defineAsyncComponent(
  () => import('../components/AiLearningPage.vue'),
)
const CommunityShowcase = defineAsyncComponent(
  () => import('../components/CommunityShowcase.vue'),
)
const HomePage = defineAsyncComponent(
  () => import('../components/HomePage.vue'),
)
const TechBackground = defineAsyncComponent(
  () => import('../components/TechBackground.vue'),
)
const WeapiCatalog = defineAsyncComponent(
  () => import('../components/WeapiCatalog.vue'),
)
const WeapiCompatibilityCatalog = defineAsyncComponent(
  () => import('../components/WeapiCompatibilityCatalog.vue'),
)
const WeapiReference = defineAsyncComponent(
  () => import('../components/WeapiReference.vue'),
)
const WevuApiReference = defineAsyncComponent(
  () => import('../components/WevuApiReference.vue'),
)

export default {
  extends: DefaultTheme,
  Layout() {
    return h(Layout)
  },
  enhanceApp({ app }: EnhanceAppContext) {
    // @ts-ignore
    app.use(TwoslashFloatingVue)
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons)
    // Ensure custom homepage components are globally available in Markdown
    app.component('AiLearningPage', AiLearningPage)
    app.component('CommunityShowcase', CommunityShowcase)
    app.component('DirectoryStructureCatalog', DirectoryStructureCatalog)
    app.component('HomePage', HomePage)
    app.component('TechBackground', TechBackground)
    app.component('WeapiCatalog', WeapiCatalog)
    app.component('WeapiCompatibilityCatalog', WeapiCompatibilityCatalog)
    app.component('WeapiReference', WeapiReference)
    app.component('WevuApiReference', WevuApiReference)
  },
  setup() {
    const route = useRoute()
    onMounted(() => {
      const syncSidebarHashActive = (): void => {
        for (const item of document.querySelectorAll<HTMLElement>('[data-wevu-api-hash-active]')) {
          item.classList.remove('is-active')
          item.removeAttribute('data-wevu-api-hash-active')
          item.querySelector(':scope > .item > a')?.removeAttribute('aria-current')
        }

        if (!location.pathname.startsWith('/wevu/api/') || !location.hash) {
          return
        }

        const activeLink = [...document.querySelectorAll<HTMLAnchorElement>('.VPSidebar a[href*="#"]')]
          .find((link) => {
            const target = new URL(link.href, location.href)
            return target.pathname === location.pathname && target.hash === location.hash
          })
        const activeItem = activeLink?.closest<HTMLElement>('.VPSidebarItem')
        if (!activeLink || !activeItem) {
          return
        }

        activeItem.classList.add('is-active')
        activeItem.setAttribute('data-wevu-api-hash-active', '')
        activeLink.setAttribute('aria-current', 'location')
      }
      const handleSidebarHashClick = (event: Event): void => {
        const target = event.target as HTMLElement | null
        const hashLink = target?.closest<HTMLAnchorElement>('.VPSidebar a[href*="#"]')
        if (hashLink) {
          setTimeout(() => {
            syncSidebarHashActive()
            document.querySelector<HTMLElement>('.VPBackdrop')?.click()
          }, 250)
        }
      }
      // 路由是 hash 的唯一来源，等待侧栏完成更新后补充 API 高亮。
      const stop = watch(() => [route.path, route.hash], syncSidebarHashActive, {
        immediate: true,
        flush: 'post',
      })
      document.addEventListener('click', handleSidebarHashClick, true)
      onUnmounted(() => {
        stop()
        document.removeEventListener('click', handleSidebarHashClick, true)
      })
    })
  },
} satisfies Theme
