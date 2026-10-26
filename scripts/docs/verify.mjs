import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { load } from 'cheerio'
import { docsPreviewRobots } from 'repoctl/docs-context'

/** 验证实际生成的页面和爬虫策略，避免错误渠道产物进入部署。 */
export async function verifyDocsArtifacts(directory, channel) {
  assert(['preview', 'stable'].includes(channel), 'Unknown documentation channel')
  const preview = channel === 'preview'
  const required = ['index.html', 'guide/index.html', '404.html', 'llms.txt', 'llms-index.json', 'seo-quality-report.json', '_headers', 'robots.txt']
  if (!preview) {
    required.push('sitemap.xml')
  }
  for (const file of required) {
    assert((await stat(path.join(directory, file))).size > 0, `Missing or empty website artifact: ${file}`)
  }
  const files = await readdir(directory, { recursive: true })
  assert(files.some(file => file.endsWith('.js')), 'Missing JavaScript assets')
  assert(files.some(file => file.endsWith('.css')), 'Missing CSS assets')
  const robots = await readFile(path.join(directory, 'robots.txt'), 'utf8')
  const headers = await readFile(path.join(directory, '_headers'), 'utf8')
  if (preview) {
    assert.equal(robots, 'User-agent: *\nDisallow: /\n')
    assert(headers.includes(`X-Robots-Tag: ${docsPreviewRobots}`), 'Preview response headers must block indexing')
    assert(!files.includes('sitemap.xml'), 'Preview must not advertise a sitemap')
  }
  else {
    assert(robots.includes('Sitemap: https://vite.weapp.dev/sitemap.xml'), 'Stable robots must advertise the canonical sitemap')
    assert(!headers.includes('# repoctl docs preview'), 'Stable must not inherit preview crawler policy')
  }
  for (const file of files.filter(file => file.endsWith('.html'))) {
    const $ = load(await readFile(path.join(directory, file), 'utf8'))
    assert($('head link[rel="canonical"]').attr('href')?.startsWith('https://vite.weapp.dev/'), `Unexpected canonical: ${file}`)
    if (preview) {
      assert.equal($('head meta[name="robots"]').attr('content'), docsPreviewRobots, `Preview page allows indexing: ${file}`)
      // VitePress 的内建 404 留空 app 容器，横幅在客户端挂载时出现。
      if (file !== '404.html') {
        assert.equal($('.docs-preview-banner').length, 1, `Missing preview notice: ${file}`)
      }
    }
    else {
      assert.equal($('.docs-preview-banner').length, 0, `Stable page displays preview notice: ${file}`)
    }
  }
}
