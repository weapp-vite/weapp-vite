# @weapp-vite/qr

`@weapp-vite/qr` 提供二维码矩阵编码、图片解码、reader 适配、微信小程序码结构识别与终端文本渲染能力。

```ts
import { decodeQrCodeFromBase64, renderTerminalQrCode } from '@weapp-vite/qr'

const content = await decodeQrCodeFromBase64(base64Png)
process.stdout.write(renderTerminalQrCode(content, { small: true }))
```

## API

### 编码

```ts
import { createQrCodeMatrix } from '@weapp-vite/qr'

const matrix = createQrCodeMatrix('https://vite.icebreaker.top/')
```

### 解码

```ts
import {
  decodeQrCodeFromBase64,
  decodeQrCodeFromBuffer,
  decodeQrCodeFromFile,
} from '@weapp-vite/qr'

const fromBase64 = await decodeQrCodeFromBase64(base64Png)
const fromBuffer = await decodeQrCodeFromBuffer(imageBuffer)
const fromFile = await decodeQrCodeFromFile('./fixtures/qr.png')
```

### Reader 输入

```ts
import { decodeWithQrReader } from '@weapp-vite/qr'
import sharp from 'sharp'

const { data, info } = await sharp(imageBuffer)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const result = await decodeWithQrReader({
  width: info.width,
  height: info.height,
  data,
})

console.log(result.result)
```

### 小程序码结构识别

```ts
import { detectMiniProgramCodeFromFile } from '@weapp-vite/qr'

const detected = await detectMiniProgramCodeFromFile('./fixtures/mini-program-code.jpg')

if (detected) {
  console.log(detected.kind)
  console.log(detected.locatorPoints)
  console.log(detected.badgeBounds)
  console.log(detected.logoBounds)
}
```

这里的结构识别目标是判断图片是否符合微信小程序码几何特征，并返回定位点、中心 logo 区和右下角徽标区域。
它不是把小程序码直接解码成链接或页面路径。

### 高层类型检测

```ts
import { detectCodeTypeFromFile } from '@weapp-vite/qr'

const codeType = await detectCodeTypeFromFile('./fixtures/code.png')

if (codeType === 'qr') {
  console.log('standard qr')
}
else if (codeType === 'mini-program-code') {
  console.log('wechat mini program code')
}
else {
  console.log('unknown')
}
```

### 终端渲染

```ts
import {
  createQrCodeMatrix,
  renderTerminalQrCode,
  renderTerminalQrCodeFromMatrix,
} from '@weapp-vite/qr'

const compact = renderTerminalQrCode('weapp-vite', { small: true })

const matrix = createQrCodeMatrix('weapp-vite')
const rendered = renderTerminalQrCodeFromMatrix(matrix)
```

## 导出类型

```ts
import type {
  MiniProgramCodeDetectionResult,
  QRCodeMatrix,
  QRCodeReaderInput,
  QRCodeReaderResult,
  QRCodeRenderOptions,
  QRCodeType,
} from '@weapp-vite/qr'
```
