---
outline: [2,4]
---

# 面向多平台构建 {#multi-platform}

`weapp-vite` 内置了多端适配能力，只需在开发或构建命令后追加 `--platform <id>`（或短写 `-p <id>`），即可输出目标平台所需的文件后缀与目录结构。以下示例假设你在 NPM 脚本中使用默认的 `weapp-vite dev` / `weapp-vite build`：

> ⚠️ 在执行命令前，请确保已安装对应平台的官方 IDE，并在 IDE 内开启服务端口（若需要命令行唤起）。

## 支付宝小程序 {#platform-alipay}

```sh
pnpm dev -- --platform alipay
pnpm build -- --platform alipay
# 也可以直接调用 CLI，省去额外的 --
pnpm exec weapp-vite dev --platform alipay
pnpm exec weapp-vite build --platform alipay
```

- 产物扩展名自动变更为 `axml` / `acss` / `sjs`。
- 在支付宝 IDE 中导入 `dist/` 目录即可预览。

## 字节系（抖音 / 今日头条）小程序 {#platform-tt}

```sh
pnpm dev -- --platform tt
pnpm build -- --platform tt
pnpm exec weapp-vite dev --platform tt
pnpm exec weapp-vite build --platform tt
```

- 支持字节全家桶（抖音 / 今日头条 / 番茄小说等）所需的 `ttml` / `ttss` 扩展名。
- 推荐使用字节小程序开发者工具导入构建产物。

## 百度智能小程序 {#platform-swan}

```sh
pnpm dev -- --platform swan
pnpm build -- --platform swan
pnpm exec weapp-vite dev --platform swan
pnpm exec weapp-vite build --platform swan
```

- 输出 `swan` / `css` / `sjs` 等百度专用格式。
- 在百度智能小程序开发者工具中选择 `dist/` 目录。

## 京东小程序 {#platform-jd}

```sh
pnpm dev -- --platform jd
pnpm build -- --platform jd
pnpm exec weapp-vite dev --platform jd
pnpm exec weapp-vite build --platform jd
```

- 自动转换为 `jxml` / `jxss` 等京东特有的扩展名。
- 构建完成后可直接导入京东小程序 IDE。

## 小红书小程序 {#platform-xhs}

```sh
pnpm dev -- --platform xhs
pnpm build -- --platform xhs
pnpm exec weapp-vite dev --platform xhs
pnpm exec weapp-vite build --platform xhs
```

- 生成 `xhsml` / `css` 等小红书小程序所需格式。
- 结合小红书开发者中心提供的工具进行预览 / 上传。

> 👀 如果需要在一个命令中同时输出 Web 版本，可在另一个终端运行 `pnpm dev -- --platform h5` 或 `pnpm exec weapp-vite dev --platform h5`。你也可以在 `package.json` 中写入专用脚本（例如 `"dev:alipay": "weapp-vite dev --platform alipay"`），这样每次只需运行 `pnpm dev:alipay` 即可避免临时输入多余的 `--`。
