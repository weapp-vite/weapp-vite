import { describe, expect, it } from 'vitest'
import { normalizeUploadResult } from './uploadResult'

describe('official upload result normalization', () => {
  it('selects WeChat package and plugin metadata without treating internal identifiers as a version', () => {
    expect(normalizeUploadResult('weapp', {
      subPackageInfo: [{ name: '__APP__', size: 120 }, { name: 'feature', size: 0 }],
      pluginInfo: [{ pluginProviderAppid: 'wx-plugin', version: '2.3.4', size: 42, privateKey: 'hidden' }],
      strUint64Version: '18446744073709551615',
      devPluginId: 'internal-plugin',
      version: 'not-an-official-upload-field',
      privateKey: 'hidden',
    }, [])).toEqual({
      subPackages: [{ name: '__APP__', size: 120 }, { name: 'feature', size: 0 }],
      plugins: [{ appid: 'wx-plugin', version: '2.3.4', size: 42 }],
    })
  })

  it('returns only the Alipay SDK reported version and optional experience QR image', () => {
    expect(normalizeUploadResult('alipay', {
      version: ' 1.2.3 ',
      experienceQrCodeUrl: ' https://example.test/alipay.png ',
      taskId: 'internal-task',
    }, [])).toEqual({ sdkVersion: '1.2.3', qrCodeUrl: 'https://example.test/alipay.png' })
    expect(normalizeUploadResult('alipay', { version: '1.2.3' }, [])).toEqual({ sdkVersion: '1.2.3' })
  })

  it('maps Douyin QR outputs but does not invent a version from the requested metadata', () => {
    expect(normalizeUploadResult('tt', {
      shortUrl: 'https://example.test/douyin',
      qrcodeFilePath: 'artifacts/douyin.png',
      version: '1.2.3',
      originSchema: 'internal-only',
      expireTime: 123,
      passJson: { privateKey: 'hidden' },
    }, [])).toEqual({ previewUrl: 'https://example.test/douyin', qrCodeFile: 'artifacts/douyin.png' })
  })

  it('accepts XHS null success without borrowing preview-only fields', () => {
    expect(normalizeUploadResult('xhs', null, [])).toEqual({})
    expect(normalizeUploadResult('xhs', { qrcodeUrl: 'https://example.test/preview', version: '1.2.3' }, [])).toEqual({})
  })

  it('maps JD QR image URL and base64 data without exposing raw fields', () => {
    expect(normalizeUploadResult('jd', {
      imgUrl: 'https://example.test/jd.png',
      base64Data: 'data:image/png;base64,aGVsbG8=',
      privateKey: 'hidden',
    }, [])).toEqual({ qrCodeUrl: 'https://example.test/jd.png', qrCodeBase64: 'data:image/png;base64,aGVsbG8=' })
    expect(normalizeUploadResult('jd', { base64Data: 'aGVsbG8=' }, [])).toEqual({ qrCodeBase64: 'aGVsbG8=' })
  })

  it('selects the Swan default scheme and keeps real byte size and scan warnings', () => {
    expect(normalizeUploadResult('swan', {
      schemeUrl: 'baiduboxapp://swan/legacy',
      schemeUrlOpti: 'baiduboxapp://swan/default',
      fileSize: 4096,
      warningList: ['app.js:1:1 unused binding'],
      detail: { version_code: 'internal-only' },
    }, [])).toEqual({
      previewUrl: 'baiduboxapp://swan/default',
      fileSize: 4096,
      warnings: ['app.js:1:1 unused binding'],
    })
    expect(normalizeUploadResult('swan', {
      schemeUrl: 'swan://legacy',
      schemeUrlOpti: 'javascript:alert(1)',
      fileSize: 0,
    }, [])).toEqual({ previewUrl: 'swan://legacy', fileSize: 0 })
  })

  it('redacts every selected nested string and never copies extra object fields', () => {
    const secret = 'upload-secret'
    expect(normalizeUploadResult('weapp', {
      subPackageInfo: [{ name: `feature-${secret}`, size: 3, token: secret }],
      pluginInfo: [{ pluginProviderAppid: `wx-${secret}`, version: secret, size: 0, token: secret }],
    }, [secret])).toEqual({
      subPackages: [{ name: 'feature-[REDACTED]', size: 3 }],
      plugins: [{ appid: 'wx-[REDACTED]', version: '[REDACTED]', size: 0 }],
    })
    expect(normalizeUploadResult('swan', {
      schemeUrl: `baiduboxapp://swan/app?token=${secret}`,
      warningList: [`token=${secret}`, 'proxy: https://user:password@proxy.test', { token: secret }],
    }, [secret])).toEqual({
      previewUrl: 'baiduboxapp://swan/app?token=[REDACTED]',
      warnings: ['token=[REDACTED]', 'proxy: https://[REDACTED]@proxy.test'],
    })
    expect(normalizeUploadResult('tt', { qrcodeFilePath: `qr/${secret}.png` }, [secret]))
      .toEqual({ qrCodeFile: 'qr/[REDACTED].png' })
    expect(normalizeUploadResult('alipay', { version: secret, experienceQrCodeUrl: `https://example.test/${secret}` }, [secret]))
      .toEqual({ sdkVersion: '[REDACTED]', qrCodeUrl: 'https://example.test/[REDACTED]' })
    expect(normalizeUploadResult('jd', { base64Data: 'aGVsbG8=' }, ['aGVsbG8=']))
      .toEqual({ qrCodeBase64: '[REDACTED]' })
  })

  it('drops malformed nested rows and sizes rather than failing a completed upload', () => {
    expect(normalizeUploadResult('weapp', {
      subPackageInfo: [null, [], {}, { name: '', size: 1 }, { name: 'bad', size: '2' }, { name: 'fraction', size: 1.5 }, { name: 'ok', size: 1 }],
      pluginInfo: [{ pluginProviderAppid: 'wx-a', version: '', size: 1 }, { pluginProviderAppid: 'wx-b', version: '1', size: -1 }],
    }, [])).toEqual({ subPackages: [{ name: 'ok', size: 1 }], plugins: [] })
    for (const fileSize of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '100', null]) {
      expect(normalizeUploadResult('swan', { fileSize }, [])).toEqual({})
    }
  })

  it.each(['not a URL', 'javascript:alert(1)', 'data:image/png;base64,YQ==', 'file:///tmp/qr.png', 'https://user:pass@example.test/qr.png', 'https://example.test/qr\ncode'])('omits unsafe image and preview URLs: %s', (url) => {
    expect(normalizeUploadResult('jd', { imgUrl: url }, [])).toEqual({})
    expect(normalizeUploadResult('alipay', { experienceQrCodeUrl: url }, [])).toEqual({})
    expect(normalizeUploadResult('tt', { shortUrl: url }, [])).toEqual({})
    expect(normalizeUploadResult('swan', { schemeUrl: url }, [])).toEqual({})
  })

  it('omits invalid optional scalars and unsupported SDK shapes', () => {
    for (const value of [undefined, null, false, 1, 'raw SDK log', []]) {
      expect(normalizeUploadResult('weapp', value, [])).toEqual({})
    }
    expect(normalizeUploadResult('alipay', { version: 123, experienceQrCodeUrl: {} }, [])).toEqual({})
    expect(normalizeUploadResult('tt', { qrcodeFilePath: '\0bad', shortUrl: [] }, [])).toEqual({})
    expect(normalizeUploadResult('jd', { base64Data: 'data:text/html;base64,YQ==' }, [])).toEqual({})
    expect(normalizeUploadResult('jd', { base64Data: 'not base64!' }, [])).toEqual({})
    expect(normalizeUploadResult('unknown', { version: '1.2.3' }, [])).toEqual({})
  })
})
