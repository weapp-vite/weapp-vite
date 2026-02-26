import type { HeadConfig, PageData } from 'vitepress'

const siteBaseUrl = 'https://vite.icebreaker.top'
const siteName = 'weapp-vite'
const defaultImage = '/logo.png'

function toAbsoluteUrl(input: string) {
  if (/^https?:\/\//.test(input)) {
    return input
  }
  const normalized = input.startsWith('/') ? input : `/${input}`
  return `${siteBaseUrl}${normalized}`
}

function toRoutePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/\.mdx?$/i, '')
  if (!normalized || normalized === 'index') {
    return '/'
  }
  if (normalized.endsWith('/index')) {
    const base = normalized.slice(0, -('/index'.length))
    return `/${base}/`
  }
  return `/${normalized}`
}

function normalizeKeywords(raw: unknown) {
  const items = Array.isArray(raw)
    ? raw.map(item => String(item))
    : typeof raw === 'string'
      ? raw.split(/[，,、;；/|]/g)
      : []

  const seen = new Set<string>()
  const output: string[] = []

  for (const item of items) {
    const keyword = item.trim().replace(/\s+/g, ' ')
    if (!keyword) {
      continue
    }

    const key = keyword.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(keyword)
  }

  return output
}

function normalizeTitle(text: string) {
  return text
    .replace(/\s*\{#[^}]+\}\s*/g, ' ')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackDescription(frontmatterDescription: unknown, excerpt: string, title: string, routePath: string) {
  if (typeof frontmatterDescription === 'string' && frontmatterDescription.trim()) {
    return frontmatterDescription.trim()
  }

  const cleanExcerpt = excerpt.trim().replace(/\s+/g, ' ')
  if (cleanExcerpt.length >= 24) {
    return cleanExcerpt.slice(0, 160)
  }

  const hint = routePath.replace(/^\//, '').replace(/\/$/, '').split('/').slice(0, 2).join(' / ')
  return `${title}，聚焦 ${hint || 'weapp-vite'} 相关场景，覆盖 weapp-vite 与 Wevu 的能力、配置和实践建议。`
}

function inferTitle(pageData: PageData) {
  const fmTitle = pageData.frontmatter.title
  if (typeof fmTitle === 'string' && fmTitle.trim()) {
    return normalizeTitle(fmTitle)
  }

  if (pageData.title?.trim()) {
    return normalizeTitle(pageData.title)
  }

  if (pageData.route === '/') {
    return siteName
  }

  return normalizeTitle(pageData.relativePath
    .replace(/\.mdx?$/i, '')
    .split('/')
    .at(-1)
    ?.replace(/[-_]/g, ' ') || siteName)
}

function prettifySegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toBreadcrumbSchema(routePath: string, title: string) {
  const segments = routePath === '/'
    ? []
    : routePath.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean)

  const itemListElement = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': '首页',
      'item': `${siteBaseUrl}/`,
    },
  ]

  let currentPath = ''
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === segments.length - 1
    itemListElement.push({
      '@type': 'ListItem',
      'position': index + 2,
      'name': isLast ? title : prettifySegment(segment),
      'item': toAbsoluteUrl(`${currentPath}${isLast ? '' : '/'}`),
    })
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  }
}

function toArticleSchema(pageData: PageData, routePath: string, canonical: string, title: string, description: string, keywords: string[]) {
  const isBlog = routePath.startsWith('/blog/')
  const frontmatterDate = typeof pageData.frontmatter.date === 'string'
    ? pageData.frontmatter.date.trim()
    : ''
  const updatedAt = pageData.lastUpdated
    ? new Date(pageData.lastUpdated).toISOString().slice(0, 10)
    : frontmatterDate || undefined

  return {
    '@context': 'https://schema.org',
    '@type': isBlog ? 'BlogPosting' : 'TechArticle',
    'headline': title,
    description,
    'url': canonical,
    'mainEntityOfPage': canonical,
    'inLanguage': 'zh-CN',
    'datePublished': frontmatterDate || updatedAt,
    'dateModified': updatedAt,
    keywords,
    'author': {
      '@type': 'Organization',
      'name': siteName,
    },
    'publisher': {
      '@type': 'Organization',
      'name': siteName,
      'logo': {
        '@type': 'ImageObject',
        'url': toAbsoluteUrl(defaultImage),
      },
    },
  }
}

export function transformPageDataForSeo(pageData: PageData) {
  const routePath = toRoutePath(pageData.relativePath)
  const title = inferTitle(pageData)
  const excerpt = typeof pageData.description === 'string' ? pageData.description : ''
  const description = fallbackDescription(pageData.frontmatter.description, excerpt, title, routePath)
  const existingKeywords = normalizeKeywords(pageData.frontmatter.keywords)

  if (!pageData.frontmatter.title) {
    pageData.frontmatter.title = title
  }

  if (!pageData.frontmatter.description) {
    pageData.frontmatter.description = description
  }

  if (existingKeywords.length === 0) {
    pageData.frontmatter.keywords = ['weapp-vite', 'Wevu', '微信小程序']
  }
}

export function createSeoHead(pageData: PageData): HeadConfig[] {
  const routePath = toRoutePath(pageData.relativePath)
  const title = inferTitle(pageData)
  const excerpt = typeof pageData.description === 'string' ? pageData.description : ''
  const description = fallbackDescription(pageData.frontmatter.description, excerpt, title, routePath)
  const canonical = toAbsoluteUrl(typeof pageData.frontmatter.canonical === 'string'
    ? pageData.frontmatter.canonical
    : routePath)

  const keywords = normalizeKeywords(pageData.frontmatter.keywords)
  const effectiveKeywords = keywords.length > 0
    ? keywords
    : ['weapp-vite', 'Wevu', '微信小程序']

  const frontmatterImage = typeof pageData.frontmatter.image === 'string'
    ? pageData.frontmatter.image
    : defaultImage

  const image = toAbsoluteUrl(frontmatterImage)

  const robots = pageData.frontmatter.noindex === true || routePath === '/404.html'
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large'

  const articleSchema = toArticleSchema(pageData, routePath, canonical, title, description, effectiveKeywords)
  const breadcrumbSchema = toBreadcrumbSchema(routePath, title)

  return [
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { name: 'description', content: description }],
    ['meta', { name: 'keywords', content: effectiveKeywords.join(', ') }],
    ['meta', { name: 'robots', content: robots }],
    ['meta', { property: 'og:type', content: routePath.startsWith('/blog/') ? 'article' : 'website' }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:image', content: image }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: image }],
    ['link', { rel: 'alternate', hreflang: 'zh-CN', href: canonical }],
    ['link', { rel: 'alternate', hreflang: 'x-default', href: canonical }],
    ['script', { type: 'application/ld+json' }, JSON.stringify(articleSchema)],
    ['script', { type: 'application/ld+json' }, JSON.stringify(breadcrumbSchema)],
  ]
}
