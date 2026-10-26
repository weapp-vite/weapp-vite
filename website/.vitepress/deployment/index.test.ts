import { docsRobots, mergeDocsHeaders } from 'repoctl/docs-context'
import { describe, expect, it } from 'vitest'
import { siteBaseUrl } from '../site.ts'
import { getDocsDeployment, previewOrigin } from './index.ts'

describe('documentation channels', () => {
  it('defaults local builds to preview and rejects channel/domain mismatches', () => {
    expect(getDocsDeployment()).toMatchObject({ preview: true, origin: previewOrigin })
    expect(getDocsDeployment('stable', siteBaseUrl)).toMatchObject({ preview: false, origin: siteBaseUrl })
    expect(() => getDocsDeployment('stable', previewOrigin)).toThrow('does not match')
    expect(() => getDocsDeployment('production')).toThrow('Unsupported')
  })

  it('disables preview crawlers while stable advertises the canonical sitemap', () => {
    expect(docsRobots(getDocsDeployment())).toBe('User-agent: *\nDisallow: /\n')
    expect(docsRobots(getDocsDeployment('stable'))).toContain(`Sitemap: ${siteBaseUrl}/sitemap.xml`)
    const headers = '/*\n  X-Content-Type-Options: nosniff\n/assets/*\n  Cache-Control: immutable\n'
    const preview = mergeDocsHeaders(headers, getDocsDeployment())
    expect(preview).toContain('X-Robots-Tag: noindex, nofollow, noarchive')
    expect(mergeDocsHeaders(preview, getDocsDeployment('stable'))).toBe(headers)
  })
})
