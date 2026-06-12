---
'@weapp-vite/dashboard': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
'wevu': patch
---

升级 workspace catalog 中的 rolldown、Vue、esbuild、sass 与 weapp-tailwindcss 版本，并同步 create-weapp-vite 模板 catalog。安装阶段现在会禁用 pnpm 11 的 optimistic repeat install 早退，确保重新执行 `pnpm i` 时仍会刷新受管 catalog 与 package.json 引用。
