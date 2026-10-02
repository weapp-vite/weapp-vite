---
"weapp-vite": major
"@weapp-vite/ast": major
"@weapp-vite/web": major
"@weapp-vite/tailwindcss": major
"@wevu/compiler": major
"wevu": major
"@wevu/test-utils": major
"@mpcore/simulator": major
"@mpcore/test": major
"@mpcore/vitest": major
"@mpcore/weapp-vite": major
"create-weapp-vite": patch
---

将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。
