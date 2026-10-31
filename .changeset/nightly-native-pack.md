---
'@weapp-vite/ast-native': patch
---

fix(ast-native): 打包前按 Cargo.lock 构建当前宿主的原生模块，避免隔离源码发布时漏掉二进制文件。
