import type { HeadConfig, PageData } from 'vitepress'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSeoHead } from './seo'
import { siteBaseUrl } from './site'

function findHead(head: HeadConfig[], tag: string, key: string, value: string) {
  return head.find((item) => {
    return item[0] === tag && item[1]?.[key] === value
  })
}

describe('website SEO domain', () => {
  it('uses the canonical site domain in page metadata', () => {
    const pageData: PageData = {
      relativePath: 'guide/index.md',
      filePath: 'guide/index.md',
      title: '使用指南',
      description: 'weapp-vite 使用指南与配置说明。',
      headers: [],
      frontmatter: {},
    }

    const head = createSeoHead(pageData)
    const canonical = `${siteBaseUrl}/guide/`

    expect(findHead(head, 'link', 'rel', 'canonical')).toEqual([
      'link',
      { rel: 'canonical', href: canonical },
    ])
    expect(findHead(head, 'meta', 'property', 'og:url')).toEqual([
      'meta',
      { property: 'og:url', content: canonical },
    ])

    const structuredData = head
      .filter(item => item[0] === 'script' && item[1]?.type === 'application/ld+json')
      .map(item => JSON.parse(String(item[2])))

    expect(structuredData).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: canonical, mainEntityOfPage: canonical }),
    ]))
  })

  it('publishes the canonical sitemap in robots.txt', () => {
    const robotsPath = fileURLToPath(new URL('../public/robots.txt', import.meta.url))
    const robots = readFileSync(robotsPath, 'utf8')

    expect(robots).toContain(`Sitemap: ${siteBaseUrl}/sitemap.xml`)
  })
})
