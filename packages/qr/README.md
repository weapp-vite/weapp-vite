# @weapp-vite/qr

`@weapp-vite/qr` 提供二维码矩阵编码、图片解码、reader 适配与终端文本渲染能力。

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
  QRCodeMatrix,
  QRCodeReaderInput,
  QRCodeReaderResult,
  QRCodeRenderOptions,
} from '@weapp-vite/qr'
```
