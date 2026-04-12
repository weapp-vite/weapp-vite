---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复本地依赖安装与小程序 npm 构建的两个稳定性问题：一是 `postinstall` 现在会自动修正根目录损坏的 `weapp-vite` workspace 链接，避免 `pnpm build` 在 fixture 与 e2e 应用里找不到 CLI 入口；二是小程序 npm 目录改为使用受控递归复制，避免像 `tdesign-miniprogram` 这类包在分包依赖缓存构建时触发 `ENOENT`，从而让 `pnpm test` 与相关分包构建流程更稳定。
