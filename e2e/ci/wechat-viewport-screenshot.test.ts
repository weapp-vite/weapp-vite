import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { normalizeWechatViewportScreenshot } from '../component-library/wechatScreenshot'

describe('normalizeWechatViewportScreenshot', () => {
  it('crops the device chrome and normalizes the runtime viewport to the baseline size', async () => {
    const screenshot = await sharp({
      create: {
        background: '#d52b2b',
        channels: 4,
        height: 1_588,
        width: 734,
      },
    })
      .composite([{
        input: {
          create: {
            background: '#1769e0',
            channels: 4,
            height: 1_417,
            width: 734,
          },
        },
        left: 0,
        top: 171,
      }])
      .png()
      .toBuffer()

    const normalized = await normalizeWechatViewportScreenshot({
      screenshot: Buffer.from(screenshot),
      systemInfo: {
        screenHeight: 844,
        screenWidth: 390,
        windowHeight: 753,
        windowWidth: 390,
      },
      targetHeight: 1_506,
      targetWidth: 780,
    })
    const { data, info } = await sharp(normalized)
      .raw()
      .toBuffer({ resolveWithObject: true })

    expect(info).toMatchObject({ channels: 4, height: 1_506, width: 780 })
    expect([...data.subarray(0, 4)]).toEqual([23, 105, 224, 255])
    expect([...data.subarray(data.length - 4)]).toEqual([23, 105, 224, 255])
  })

  it('rejects screenshots that do not match the runtime screen ratio', async () => {
    const screenshot = await sharp({
      create: {
        background: '#fff',
        channels: 4,
        height: 100,
        width: 100,
      },
    }).png().toBuffer()

    await expect(normalizeWechatViewportScreenshot({
      screenshot: Buffer.from(screenshot),
      systemInfo: {
        screenHeight: 844,
        screenWidth: 390,
        windowHeight: 753,
        windowWidth: 390,
      },
      targetHeight: 1_506,
      targetWidth: 780,
    })).rejects.toThrow('微信整机截图宽高比与运行时 viewport 不一致')
  })
})
