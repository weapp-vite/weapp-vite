# @weapp-vite/qr

`@weapp-vite/qr` 提供二维码矩阵编码、Base64 PNG 解码与终端文本渲染能力。

```ts
import { decodeQrCodeFromBase64, renderTerminalQrCode } from '@weapp-vite/qr'

const content = await decodeQrCodeFromBase64(base64Png)
process.stdout.write(renderTerminalQrCode(content, { small: true }))
```
