import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { it } from 'vitest'
import { cleanInlineText, extractImageUrls, getImageDimensions, parseShowcaseComment, refineImageRoles } from './sync-community-showcase'

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

it('cleanInlineText strips markdown heading markers', () => {
  assert.equal(cleanInlineText('### 早睡搭子小程序：按时睡教'), '早睡搭子小程序：按时睡教')
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

it('parseShowcaseComment uses markdown heading as title and keeps hashes out of generated text', () => {
  const entry = parseShowcaseComment({
    id: 4293349314,
    html_url: 'https://github.com/weapp-vite/weapp-vite/issues/43#issuecomment-4293349314',
    created_at: '2026-04-22T03:38:38Z',
    user: {
      login: 'wooly99',
    },
    body: `### 早睡搭子小程序：按时睡教

一款帮助用户建立稳定作息习惯的小程序，通过提醒、打卡和反馈机制减少熬夜。

链接: https://example.com/sleep-buddy

![cover](https://github.com/user-attachments/assets/cae18a8e-fc3f-415d-9308-3ad9db0e56e1)`,
  })

  assert.ok(entry)
  assert.equal(entry?.title, '早睡搭子小程序：按时睡教')
  assert.equal(entry?.description, '一款帮助用户建立稳定作息习惯的小程序，通过提醒、打卡和反馈机制减少熬夜。')
})

it('parseShowcaseComment ignores section headings like screenshot when inferring title', () => {
  const entry = parseShowcaseComment({
    id: 2451697149,
    html_url: 'https://github.com/weapp-vite/weapp-vite/issues/43#issuecomment-2451697149',
    created_at: '2024-11-01T11:02:22Z',
    user: {
      login: 'F-loat',
    },
    body: `《xiaomusic》小程序客户端，开源小程序音乐播放器，可控制小爱音箱播放本地/NAS音乐

### 截图

![cover](https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/screenshot/5.png)
![qrcode](https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/weappcode.jpg)`,
  })

  assert.ok(entry)
  assert.equal(entry?.title, 'xiaomusic')
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
