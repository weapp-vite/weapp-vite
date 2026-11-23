---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复独立分包引用依赖包资源时的输出路径。

使用 `[subpackage]` 命名时，独立分包构建会将资源输出到包内，主包同时使用同一资源时仍有自己的可访问产物。

同一张图片被 JS 导入与 WXML 静态引用时，若不再输出原始路径，WXML 会指向构建后的图片文件。

识别 bundler 以相对路径记录的资源来源，避免 WXSS 图片同时输出命名文件和额外的源码路径副本。

主包和普通分包仅在 WXML 静态引用的本地图片也遵循 `build.assetsDir` 与 `build.rolldownOptions.output.assetFileNames`，不再额外复制到源码相对路径。

正式构建中，仅由主包或普通分包 WXML 静态引用的本地图片按消费包命名；跨包共享时提升至主包，只发射一次。

独立分包的 WXML 静态图片也遵循包内资源命名；主构建不会再为子构建已发射的包内图片保留原路径副本。
