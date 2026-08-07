import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { parseWechatConfigHtml } from '../scripts/crawl-wechat-config'

describe('crawl wechat config', () => {
  it('parses field metadata from an official-style table', async () => {
    const fixture = await fs.readFile(path.resolve(__dirname, './fixtures/wechat-config.html'), 'utf8')
    const result = parseWechatConfigHtml(fixture, 'https://example.com/app.html')

    expect(result.fields).toEqual({
      pages: {
        type: 'string[]',
        required: true,
        description: '页面路径列表不含后缀',
      },
      debug: {
        'type': 'boolean',
        'default': false,
        'description': '调试模式',
        'x-wechat-min-version': '2.1.0',
      },
      entryPagePath: {
        type: 'string',
        description: '默认首页',
      },
    })
  })

  it('fails when no configuration table can be parsed', () => {
    expect(() => parseWechatConfigHtml('<html><body>empty</body></html>', 'https://example.com/app.html')).toThrow('未能从微信配置文档解析出配置主表')
  })
})
