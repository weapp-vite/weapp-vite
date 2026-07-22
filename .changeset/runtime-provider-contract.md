---
'@weapp-core/constants': patch
'@weapp-core/shared': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

引入声明式 runtime provider 契约，让原生小程序、wevu Vue SFC 与 Web 构建通过稳定虚拟入口选择各自运行时，并在入口缺失或契约版本不匹配时给出明确诊断。
