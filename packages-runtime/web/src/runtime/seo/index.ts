export type WebResourceHintRelation = 'preconnect' | 'dns-prefetch' | 'prefetch' | 'preload'

export interface WebResourceHint {
  href: string
  rel: WebResourceHintRelation
  as?: string
  type?: string
  crossOrigin?: 'anonymous' | 'use-credentials'
}

export interface WebResourceHintsConfig {
  links?: WebResourceHint[]
}

export interface WebSeoConfig {
  enabled?: boolean
  defaultTitle?: string
  titleTemplate?: string
  description?: string
  canonical?: boolean
}

export interface WebPageHead {
  route?: string
  title?: string
}

const HEAD_MARKER = 'data-weapp-web-head'
const HEAD_OWNER = 'weapp-web-runtime'
let seoConfig: WebSeoConfig = { enabled: false }

function getDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document
}

function findOrCreateMeta(documentRef: Document, name: string) {
  const selector = `meta[${HEAD_MARKER}="${HEAD_OWNER}"][name="${name}"]`
  const existing = documentRef.head?.querySelector(selector) as HTMLMetaElement | null
  if (existing) {
    return existing
  }
  const meta = documentRef.createElement('meta')
  meta.setAttribute('name', name)
  meta.setAttribute(HEAD_MARKER, HEAD_OWNER)
  documentRef.head?.append(meta)
  return meta
}

function resolveTitle(title: string | undefined, route: string | undefined) {
  const raw = title || seoConfig.defaultTitle || route || ''
  if (!seoConfig.titleTemplate || !raw) {
    return raw
  }
  return seoConfig.titleTemplate.includes('%s')
    ? seoConfig.titleTemplate.replaceAll('%s', raw)
    : `${raw}${seoConfig.titleTemplate}`
}

function resolveCanonicalUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return undefined
  }
  try {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    return url.href
  }
  catch {
    return undefined
  }
}

export function configureWebSeo(next?: WebSeoConfig) {
  seoConfig = next
    ? { enabled: next.enabled !== false, ...next }
    : { enabled: false }
  const documentRef = getDocument()
  if (!documentRef || seoConfig.enabled === false) {
    return
  }
  if (seoConfig.description !== undefined) {
    findOrCreateMeta(documentRef, 'description').content = seoConfig.description
  }
}

export function syncWebDocumentHead(head: WebPageHead) {
  const documentRef = getDocument()
  if (!documentRef || seoConfig.enabled === false) {
    return
  }
  const title = resolveTitle(head.title, head.route)
  if (title) {
    documentRef.title = title
  }
  if (seoConfig.description !== undefined) {
    findOrCreateMeta(documentRef, 'description').content = seoConfig.description
  }
  if (seoConfig.canonical !== false) {
    const canonical = resolveCanonicalUrl()
    if (canonical && documentRef.head) {
      let link = documentRef.head.querySelector(`link[${HEAD_MARKER}="${HEAD_OWNER}"][rel="canonical"]`) as HTMLLinkElement | null
      if (!link) {
        link = documentRef.createElement('link')
        link.rel = 'canonical'
        link.setAttribute(HEAD_MARKER, HEAD_OWNER)
        documentRef.head.append(link)
      }
      link.href = canonical
    }
  }
}

export function updateWebDocumentTitle(title: string) {
  syncWebDocumentHead({ title })
}

export function setupWebResourceHints(config?: WebResourceHintsConfig) {
  const documentRef = getDocument()
  if (!documentRef?.head || !config?.links?.length) {
    return
  }
  for (const hint of config.links) {
    if (!hint || typeof hint.href !== 'string' || !hint.href || typeof hint.rel !== 'string') {
      continue
    }
    const selector = `link[${HEAD_MARKER}="${HEAD_OWNER}"][rel="${hint.rel}"][href="${hint.href}"]`
    let link = documentRef.head.querySelector(selector) as HTMLLinkElement | null
    if (!link) {
      link = documentRef.createElement('link')
      link.rel = hint.rel
      link.href = hint.href
      link.setAttribute(HEAD_MARKER, HEAD_OWNER)
      documentRef.head.append(link)
    }
    if (hint.as) {
      link.as = hint.as
    }
    if (hint.type) {
      link.type = hint.type
    }
    if (hint.crossOrigin) {
      link.crossOrigin = hint.crossOrigin
    }
  }
}

export function resetWebDocumentHead() {
  const documentRef = getDocument()
  if (!documentRef?.head) {
    return
  }
  documentRef.head.querySelectorAll(`[${HEAD_MARKER}="${HEAD_OWNER}"]`).forEach(node => node.remove())
  seoConfig = { enabled: false }
}

export type { WebSeoConfig as WebRuntimeSeoConfig }
