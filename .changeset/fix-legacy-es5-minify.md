---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 ES5 最终产物压缩及请求 runtime 初始化顺序

修复启用 `weapp.es5` 时最终 SWC 降级重新展开压缩代码的问题，并保留小程序配置合并中的降级及用户插件；保留每个输出的紧凑打印配置，覆盖 prelude、JS asset、源码映射及多轮构建。

修复独立分包将请求 runtime 与页面合并时 installer 提前执行的问题，复用源码安装时机同步局部绑定。
