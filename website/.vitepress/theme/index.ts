// .vitepress/theme/index.ts
import type { EnhanceAppContext, Theme } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomePage from '../components/HomePage.vue'
import TechBackground from '../components/TechBackground.vue'
import Layout from './Layout.vue'
import '@shikijs/vitepress-twoslash/style.css'
import './index.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'virtual:group-icons.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(Layout)
  },
  enhanceApp({ app, router }: EnhanceAppContext) {
    // @ts-ignore
    app.use(TwoslashFloatingVue)
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons)
    // Ensure custom homepage components are globally available in Markdown
    app.component('HomePage', HomePage)
    app.component('TechBackground', TechBackground)
    if (typeof window !== 'undefined') {
      const renderMermaid = async () => {
        // collect blocks from two structures:
        // 1) VitePress/Shiki: <div class="language-mermaid"><span class="lang">mermaid</span><pre><code>...</code></pre></div>
        // 2) fallback: <pre><code class="language-mermaid">...</code></pre>
        const wrappers = Array.from(document.querySelectorAll<HTMLElement>('div[class*=\"language-mermaid\"]'))
        const inlineBlocks = Array.from(document.querySelectorAll<HTMLElement>('pre code.language-mermaid'))

        let found = false
        // handle wrapper structure
        for (const wrap of wrappers) {
          if (wrap.querySelector('.mermaid')) {
            continue
          }
          const code = wrap.querySelector('code')
          const raw = (code?.textContent || wrap.textContent || '').replace(/^\\s*mermaid\\s*/i, '')
          const src = raw.trim()
          if (!src) {
            continue
          }
          const container = document.createElement('div')
          container.className = 'mermaid'
          container.setAttribute('data-mermaid', src)
          container.textContent = src
          wrap.replaceWith(container)
          found = true
        }
        // handle simple pre/code structure
        for (const code of inlineBlocks) {
          const pre = code.closest('pre')
          if (!pre) {
            continue
          }
          const raw = (code.textContent || '').trim()
          if (!raw) {
            continue
          }
          const container = document.createElement('div')
          container.className = 'mermaid'
          container.setAttribute('data-mermaid', raw)
          container.textContent = raw
          pre.replaceWith(container)
          found = true
        }
        if (!found) {
          return
        }
        const mermaid = await import('mermaid')
        const isDark = document.documentElement.classList.contains('dark')
        mermaid.default.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' })
        // v10/v11 API compatibility
        const nodes = document.querySelectorAll<HTMLElement>('.mermaid')
        if ('run' in mermaid.default) {
          // @ts-ignore
          await mermaid.default.run({ nodes })
        }
        else {
          // @ts-ignore
          mermaid.default.init(undefined, nodes)
        }
      }
      // initial render and after navigation
      requestAnimationFrame(renderMermaid)
      router.onAfterRouteChanged = () => {
        // wait DOM update
        setTimeout(renderMermaid, 0)
      }

      // observe content changes to catch late-inserted code blocks
      const contentRoot = document.getElementById('VPContent') || document.body
      const contentObserver = new MutationObserver(() => {
        // debounce via microtask
        Promise.resolve().then(() => {
          renderMermaid()
        })
      })
      contentObserver.observe(contentRoot, { childList: true, subtree: true })

      // re-render on theme change to switch mermaid theme
      const rerenderForTheme = async () => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.mermaid'))
        if (!nodes.length) {
          return
        }
        const mermaid = await import('mermaid')
        const isDark = document.documentElement.classList.contains('dark')
        mermaid.default.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' })
        // restore diagram source from data-mermaid
        for (const el of nodes) {
          const src = el.getAttribute('data-mermaid') || el.textContent || ''
          el.textContent = src
        }
        if ('run' in mermaid.default) {
          // @ts-ignore
          await mermaid.default.run({ nodes })
        }
        else {
          // @ts-ignore
          mermaid.default.init(undefined, nodes)
        }
      }
      // observe html.dark class changes
      const mo = new MutationObserver(() => {
        setTimeout(rerenderForTheme, 0)
      })
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    }
  },
} satisfies Theme
