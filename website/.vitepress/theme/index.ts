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
      let cleanupOutline: (() => void) | null = null
      // keep a single click handler per aside element without mutating DOM nodes
      const tocHandlers = new WeakMap<Element, EventListener>()
      const setupSmoothTOCScroll = (): void => {
        const aside = document.querySelector<HTMLElement>('.VPDocAsideOutline .content, .VPDocAside .content')
        if (!aside) {
          return
        }
        const prev = tocHandlers.get(aside)
        if (prev) {
          aside.removeEventListener('click', prev)
        }
        const handler: EventListener = (evt: Event) => {
          const target = evt.target as HTMLElement | null
          const anchor = target?.closest('a') as HTMLAnchorElement | null
          if (!anchor) {
            return
          }
          const href = anchor.getAttribute('href') || ''
          if (!href.startsWith('#')) {
            return
          }
          const id = decodeURIComponent(href.slice(1))
          const section = document.getElementById(id)
          if (!section) {
            return
          }
          evt.preventDefault()
          // optimistic active state for better visual feedback
          for (const link of Array.from(aside.querySelectorAll<HTMLAnchorElement>('a.outline-link'))) {
            link.classList.remove('is-active')
            link.removeAttribute('aria-current')
          }
          anchor.classList.add('is-active')
          anchor.setAttribute('aria-current', 'true')
          // scroll with sticky header offset
          const nav = document.querySelector<HTMLElement>('.VPNav')
          const offset = (nav?.offsetHeight || 0) + 12
          const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - offset)
          window.scrollTo({ top, behavior: 'smooth' })
          // reflect hash in URL without native jump
          history.pushState(null, '', `#${id}`)
        }
        aside.addEventListener('click', handler, { passive: false })
        tocHandlers.set(aside, handler)
      }
      const setupOutlineMarkerTuning = (): void => {
        // clean previous bindings
        if (cleanupOutline) {
          cleanupOutline()
          cleanupOutline = null
        }
        const outline = document.querySelector<HTMLElement>('.VPDocAsideOutline')
        const content = outline?.querySelector<HTMLElement>('.content') || null
        const marker = outline?.querySelector<HTMLElement>('.outline-marker') || null
        if (!outline || !content || !marker) {
          return
        }
        let locked = false
        const adjust = (): void => {
          if (locked) {
            return
          }
          const links = Array.from(outline.querySelectorAll<HTMLAnchorElement>('a.outline-link'))
          if (!links.length) {
            return
          }
          let target: HTMLAnchorElement | null = null
          // prefer current hash
          if (location.hash) {
            const id = decodeURIComponent(location.hash.slice(1))
            // CSS.escape may not exist on very old browsers
            const safe = (window as any).CSS?.escape ? (window as any).CSS.escape(id) : id.replace(/['"\\]/g, '')
            target = outline.querySelector<HTMLAnchorElement>(`a[href="#${safe}"]`)
          }
          // fallback: find nearest to marker center
          const markerRect = marker.getBoundingClientRect()
          const contentRect = content.getBoundingClientRect()
          if (!target) {
            const centerY = markerRect.top + markerRect.height / 2
            let min = Number.POSITIVE_INFINITY
            for (const a of links) {
              const r = a.getBoundingClientRect()
              const cy = r.top + r.height / 2
              const d = Math.abs(cy - centerY)
              if (d < min) {
                min = d
                target = a
              }
            }
          }
          if (!target) {
            return
          }
          const r = target.getBoundingClientRect()
          const desiredH = Math.max(18, Math.round(r.height - 8)) // leave small breathing
          const desiredTop = Math.round((r.top - contentRect.top) + Math.max(0, (r.height - desiredH) / 2))
          locked = true
          marker.style.height = `${desiredH}px`
          marker.style.top = `${desiredTop}px`
          requestAnimationFrame(() => {
            locked = false
          })
        }
        // initial
        adjust()
        const markerObserver = new MutationObserver(() => {
          // whenever VP updates marker position, re-center/height it
          adjust()
        })
        markerObserver.observe(marker, { attributes: true, attributeFilter: ['style'] })
        const onHash = (): void => setTimeout(adjust, 0)
        const onResize = (): void => setTimeout(adjust, 0)
        window.addEventListener('hashchange', onHash, { passive: true })
        window.addEventListener('resize', onResize, { passive: true })
        cleanupOutline = () => {
          markerObserver.disconnect()
          window.removeEventListener('hashchange', onHash)
          window.removeEventListener('resize', onResize)
        }
      }
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
        setTimeout(() => {
          renderMermaid()
          setupSmoothTOCScroll()
          setupOutlineMarkerTuning()
        }, 0)
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
      // bind initial
      requestAnimationFrame(() => {
        setupSmoothTOCScroll()
        setupOutlineMarkerTuning()
      })

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
