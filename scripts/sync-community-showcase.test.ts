import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { it } from 'vitest'
import { extractImageUrls, getImageDimensions, parseShowcaseComment, refineImageRoles } from './sync-community-showcase'

it('extractImageUrls supports html img and markdown image syntax', () => {
  const urls = extractImageUrls(`
<img src="https://example.com/a.png" width="32%" />
![Image](https://example.com/b.jpg)
`)

  assert.deepEqual(urls, [
    'https://example.com/a.png',
    'https://example.com/b.jpg',
  ])
})

it('parseShowcaseComment extracts title, description, links and image roles from rich comments', () => {
  const entry = parseShowcaseComment({
    id: 4109843504,
    html_url: 'https://github.com/weapp-vite/weapp-vite/issues/43#issuecomment-4109843504',
    created_at: '2026-03-23T11:15:24Z',
    user: {
      login: 'Visualizeit',
    },
    body: `《草莓拼豆》：一款将照片快速转换为拼豆图案的微信小程序创作工具，面向拼豆和像素手作爱好者。支持导入图片后自动生成像素化方案，可按不同尺寸、调色板和预览样式进行调整，并导出包含颜色清单与制作指引的成品长图，方便从灵感到实际制作快速落地。

<p align="left">
  <img src="https://github.com/user-attachments/assets/095ea26a-8519-4d87-9267-5019eeb2c031" width="32%" />
  <img src="https://github.com/user-attachments/assets/ac890b1e-c4ba-4291-ad37-c3a71bde83fb" width="32%" />
  <img src="https://github.com/user-attachments/assets/b037d256-fd19-474e-8111-4528408a7ca7" width="32%" />
</p>

![Image](https://github.com/user-attachments/assets/dbb57d5c-41d7-4d37-ac4a-55e4e4113110)`,
  })

  assert.ok(entry)
  assert.equal(entry?.title, '草莓拼豆')
  assert.match(entry?.description ?? '', /拼豆图案/)
  assert.equal(entry?.slug, 'visualizeit')
  assert.ok(entry?.images.some(image => image.kind === 'qrcode' && image.url.includes('dbb57d5c-41d7-4d37-ac4a-55e4e4113110')))
  assert.equal(entry?.images.length, 4)
})

it('parseShowcaseComment ignores maintainer follow-up comments', () => {
  const entry = parseShowcaseComment({
    id: 2453315623,
    html_url: 'https://github.com/weapp-vite/weapp-vite/issues/43#issuecomment-2453315623',
    created_at: '2024-11-03T06:33:17Z',
    user: {
      login: 'sonofmagic',
    },
    body: `> 个人：@F-loat github: https://github.com/F-loat/xiaoplayer
> <img src="https://camo.githubusercontent.com/example.jpg">

已添加到 https://vite.icebreaker.top/community/showcase.html`,
  })

  assert.equal(entry, null)
})

it('getImageDimensions reads png dimensions from buffer', () => {
  const buffer = Buffer.from([
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
    0x00,
    0x00,
    0x00,
    0x0D,
    0x49,
    0x48,
    0x44,
    0x52,
    0x00,
    0x00,
    0x01,
    0xAE,
    0x00,
    0x00,
    0x01,
    0xAE,
  ])

  assert.deepEqual(getImageDimensions(buffer), {
    width: 430,
    height: 430,
  })
})

it('refineImageRoles upgrades a single square image to qrcode when the rest are portrait screenshots', () => {
  const images = refineImageRoles([
    {
      kind: 'cover',
      url: 'https://example.com/a',
      filePath: '/tmp/a.jpeg',
      originalUrl: 'https://example.com/a',
      relativePath: 'cases/example/cover.jpeg',
      width: 430,
      height: 430,
    },
    {
      kind: 'screenshot',
      url: 'https://example.com/b',
      filePath: '/tmp/b.jpeg',
      originalUrl: 'https://example.com/b',
      relativePath: 'cases/example/screenshot-1.jpeg',
      width: 430,
      height: 932,
    },
  ])

  assert.equal(images[0]?.kind, 'qrcode')
  assert.equal(images[1]?.kind, 'screenshot')
})
