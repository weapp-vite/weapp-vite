# weapp-vite

## 2.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020)]:
  - @weapp-core/init@1.1.15-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---

  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- Updated dependencies [[`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204)]:
  - @weapp-core/init@1.1.15-alpha.0

## 2.0.0

### Major Changes

- [`1335093`](https://github.com/weapp-vite/weapp-vite/commit/13350939181bf2b289b1954b00c608cd5013be66) Thanks [@sonofmagic](https://github.com/sonofmagic)! - # Breaking Changes

  - 现在添加了静态的 `wxml` 分析引擎，会自动分析所有引入的组件，页面, 以及 `<import/>`, `<include/>` 标签等等，所以现在不会默认复制所有的 `wxml` 文件到编译目录 `dist` 目录下

### Patch Changes

- Updated dependencies [[`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893)]:
  - @weapp-core/init@1.1.14

## 1.9.3

### Patch Changes

- [`7a40299`](https://github.com/weapp-vite/weapp-vite/commit/7a402997b471a3ce31584121c25fcd6f7a2f7b9d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 使用 JSON.TS 生成 JSON 时存在的问题

- Updated dependencies [[`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a)]:
  - @weapp-core/logger@1.0.2
  - @weapp-core/init@1.1.13
  - weapp-ide-cli@2.0.8

## 1.9.2

### Patch Changes

- [`4bfc306`](https://github.com/weapp-vite/weapp-vite/commit/4bfc306706a6e187c40487a2b4b0be6f47def031) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: auto import glob issue

## 1.9.1

### Patch Changes

- [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support multi-platform software

- [`258d915`](https://github.com/weapp-vite/weapp-vite/commit/258d915b2fb044df4884d69260d76bed5217de6a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自定义 wxss 指令来跳过 scss,less,postcss-import 的编译

- [`3e55905`](https://github.com/weapp-vite/weapp-vite/commit/3e559054258cd607746b319a5f271650020fe3b9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support wxml #ifdef and #endif

- [`0cd9365`](https://github.com/weapp-vite/weapp-vite/commit/0cd936514022d3ce5464f588a126f37f9a0372f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加条件编译样式的插件

- Updated dependencies [[`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c), [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af)]:
  - @weapp-core/init@1.1.12
  - weapp-ide-cli@2.0.7

## 1.9.0

### Minor Changes

- [`c05dc77`](https://github.com/weapp-vite/weapp-vite/commit/c05dc7720cc8cd7c921a5ba7a97221941c91cadb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: release auto import components

## 1.8.4

### Patch Changes

- [`27fe9bb`](https://github.com/weapp-vite/weapp-vite/commit/27fe9bb31dffdb43387326f7a2d5db004e825622) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动导入 vant 和 tdesign 组件

## 1.8.3

### Patch Changes

- [`d62c59b`](https://github.com/weapp-vite/weapp-vite/commit/d62c59b415b73a31a6c99369d460bfd80b11b596) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add TDesignResolver for auto-import

## 1.8.2

### Patch Changes

- [`a7f1f21`](https://github.com/weapp-vite/weapp-vite/commit/a7f1f21c2952b4b2f5c1fa822cba32671fe8af80) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 开放 auto import 组件功能

- [`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add entry type

- Updated dependencies [[`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4)]:
  - @weapp-core/schematics@1.0.7

## 1.8.1

### Patch Changes

- [`239b5f0`](https://github.com/weapp-vite/weapp-vite/commit/239b5f0e3f2b8905fba86ca8c754174c82f5c1c4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build npm env default 'production'

## 1.8.0

### Minor Changes

- [`9bb7be0`](https://github.com/weapp-vite/weapp-vite/commit/9bb7be0acd28381404cfd06b3f44472d8dd17b90) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 更改 wxml,wxs 以及静态资源文件的构建时序

### Patch Changes

- [`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 生成脚手架支持 dirs 和 filenames 配置

- [`53739f1`](https://github.com/weapp-vite/weapp-vite/commit/53739f1f5c298572f2d7bcde49140041b87f9c54) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#64](https://github.com/weapp-vite/weapp-vite/issues/64)

- Updated dependencies [[`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc), [`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc)]:
  - @weapp-core/schematics@1.0.6
  - @weapp-core/init@1.1.11

## 1.7.8

### Patch Changes

- [`7afc501`](https://github.com/weapp-vite/weapp-vite/commit/7afc501752c3f1a6ab839502233801bb7cd26c60) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 尝试修复热更新文件无限递归调用导致栈溢出的问题

## 1.7.7

### Patch Changes

- [`b794a55`](https://github.com/weapp-vite/weapp-vite/commit/b794a5562095c4f058e35c62928eec4f6c0fe55e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#59](https://github.com/weapp-vite/weapp-vite/issues/59)
  feat: 优化清空目录的方式

## 1.7.6

### Patch Changes

- [`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持内联 wxs 引入其他的 wxs 文件

- Updated dependencies [[`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0)]:
  - @weapp-core/init@1.1.10

## 1.7.5

### Patch Changes

- [`795cdef`](https://github.com/weapp-vite/weapp-vite/commit/795cdef24c3edf08441b38832cd1305ed2a69e63) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持文件夹index文件自动寻址

## 1.7.4

### Patch Changes

- [`1a7d4c0`](https://github.com/weapp-vite/weapp-vite/commit/1a7d4c0e6406626317bb76a095d6759ae94d9d3e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add vite as dependencies

- Updated dependencies [[`53d5903`](https://github.com/weapp-vite/weapp-vite/commit/53d5903cf60e7b2316bdbc6d9dcadac16a7517bf)]:
  - @weapp-core/init@1.1.9

## 1.7.3

### Patch Changes

- [`29d4c63`](https://github.com/weapp-vite/weapp-vite/commit/29d4c63ec26fb061a20e70bb698c8df90e7308c5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化日志和构建hook的显示

## 1.7.2

### Patch Changes

- [`7fe8291`](https://github.com/weapp-vite/weapp-vite/commit/7fe829157b6609f0801338e6ac165271644ccc04) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 watch 热更新问题

## 1.7.1

### Patch Changes

- [`4bc81a1`](https://github.com/weapp-vite/weapp-vite/commit/4bc81a13712769de7662f216700c5c67592711c6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: wxs 增强支持分析与提取

- Updated dependencies [[`7f9c36a`](https://github.com/weapp-vite/weapp-vite/commit/7f9c36a30e41b4a2b95e61080f645b7c169fe847), [`c11d076`](https://github.com/weapp-vite/weapp-vite/commit/c11d07684c4592700a1141f2dc83dc3ce08c6676)]:
  - @weapp-core/init@1.1.8
  - @weapp-core/shared@1.0.4

## 1.7.0

### Minor Changes

- [`ace78e9`](https://github.com/weapp-vite/weapp-vite/commit/ace78e9c9d8ec82942f14d41bed293484bba765f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加 wxml 增强模式,支持 @ 加修饰符写法

### Patch Changes

- [`57f2d21`](https://github.com/weapp-vite/weapp-vite/commit/57f2d217e95b48815cd8293ac35de354ffb69d1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持独立分包拥有自己的构建依赖配置

## 1.6.9

### Patch Changes

- [`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持 Skyline 全局工具栏 appBar

- Updated dependencies [[`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52)]:
  - @weapp-core/schematics@1.0.5
  - @weapp-core/init@1.1.7

## 1.6.8

### Patch Changes

- [`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立分包支持构建 npm

- Updated dependencies [[`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b)]:
  - @weapp-core/schematics@1.0.4

## 1.6.7

### Patch Changes

- [`4b7b64a`](https://github.com/weapp-vite/weapp-vite/commit/4b7b64a692e5cb700160452f0f1b3b021408d507) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持在 json.[jt]s 中传入上下文和编译变量

## 1.6.6

### Patch Changes

- [`4f95b16`](https://github.com/weapp-vite/weapp-vite/commit/4f95b16923d5e9646aec6cf8d726316e2d5ab0ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat: 支持 html 作为 wxml 的后缀，以便复用 html 相关的插件和工具链
  - chore: 更新相关依赖包

## 1.6.5

### Patch Changes

- [`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dts 中对于 vite/client 的继承和智能提示

- Updated dependencies [[`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad)]:
  - @weapp-core/init@1.1.6

## 1.6.4

### Patch Changes

- [`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持使用 ts/js 来配置 json 文件 index.json.ts/js

- [`1170293`](https://github.com/weapp-vite/weapp-vite/commit/117029308b4740e84b3efbf0413f8dda7abea796) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 copy 配置项

- Updated dependencies [[`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901), [`1825f02`](https://github.com/weapp-vite/weapp-vite/commit/1825f024172dfeb357536c0aaeba6c4d53d97196)]:
  - @weapp-core/schematics@1.0.3
  - @weapp-core/init@1.1.5

## 1.6.3

### Patch Changes

- [`e7a95cd`](https://github.com/weapp-vite/weapp-vite/commit/e7a95cd26f5c94e3ef95c82dfd8e8fe11e356c85) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复多个分包提前返回的场景

## 1.6.2

### Patch Changes

- [`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add weapp.tsconfigPaths for tsconfigPaths plugin

- Updated dependencies [[`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7)]:
  - @weapp-core/init@1.1.4

## 1.6.1

### Patch Changes

- [`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持自定义 custom-tab-bar, 需要设置 tabBar.custom 为 true 来开启

- Updated dependencies [[`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e), [`228e4d2`](https://github.com/weapp-vite/weapp-vite/commit/228e4d2a9f780c018b13e91e15d1057d3c1360e0)]:
  - @weapp-core/schematics@1.0.2
  - @weapp-core/init@1.1.3

## 1.6.0

### Minor Changes

- [`5326cfc`](https://github.com/weapp-vite/weapp-vite/commit/5326cfc8a2d55d50414d557b15cf376cf36449d0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 去除 chokidar 和 watch 选项，改用 vite 内置的 watcher

## 1.5.6

### Patch Changes

- Updated dependencies [[`401fc58`](https://github.com/weapp-vite/weapp-vite/commit/401fc584fad1c884ac8f276f3dc4daccde9fe659)]:
  - @weapp-core/init@1.1.2

## 1.5.5

### Patch Changes

- [`df1303b`](https://github.com/weapp-vite/weapp-vite/commit/df1303bfbeef5613524b07142d1493aeb3c471f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 打包产物消失的问题

## 1.5.4

### Patch Changes

- [`2e6baf1`](https://github.com/weapp-vite/weapp-vite/commit/2e6baf1e0001477ca1d3df7ea67a5327533da196) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 删除不正确的依赖项

## 1.5.3

### Patch Changes

- Updated dependencies [[`bc9f19d`](https://github.com/weapp-vite/weapp-vite/commit/bc9f19dcf73e38b6b8a835a3e4660980eb1d9a7b)]:
  - @weapp-core/init@1.1.1

## 1.5.2

### Patch Changes

- [`8804452`](https://github.com/weapp-vite/weapp-vite/commit/8804452270184c7eb48d409ca2ec49e5b4d7599f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 分包 json 文件 copy 与 build 清空逻辑修复

## 1.5.1

### Patch Changes

- [`29dbbdc`](https://github.com/weapp-vite/weapp-vite/commit/29dbbdc356915e4778baccf6ec2f5ba67dd01781) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 添加 sitemap.json 和 theme.json 支持

- Updated dependencies [[`e0f4c38`](https://github.com/weapp-vite/weapp-vite/commit/e0f4c386823ec99c653ad2b5e1cbf4344ac632b4), [`e428516`](https://github.com/weapp-vite/weapp-vite/commit/e428516fd993bd9b4081c12773d614bf30fd48cd)]:
  - @weapp-core/schematics@1.0.1
  - @weapp-core/init@1.1.0

## 1.5.0

### Minor Changes

- [`95e195c`](https://github.com/weapp-vite/weapp-vite/commit/95e195c0400438833e63417c90030f5e296b5d29) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加生成脚手架功能

### Patch Changes

- Updated dependencies [[`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e), [`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e)]:
  - @weapp-core/init@1.0.9
  - @weapp-core/schematics@1.0.0

## 1.4.5

### Patch Changes

- [`518046e`](https://github.com/weapp-vite/weapp-vite/commit/518046ec1cd9e6bc132f8a7dea03d73962c20f31) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 直接执行 `npx weapp init` 会报出 `typescript` 找不到错误的问题

## 1.4.4

### Patch Changes

- Updated dependencies [[`1596334`](https://github.com/weapp-vite/weapp-vite/commit/159633422903bf3b5a5a3015bc0c495ec672c308)]:
  - @weapp-core/shared@1.0.3
  - @weapp-core/init@1.0.8

## 1.4.3

### Patch Changes

- [`90ecbab`](https://github.com/weapp-vite/weapp-vite/commit/90ecbabb3b5d0c6b276670c26bc10de60ac5c237) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动处理分包 `entry` 文件后缀

## 1.4.2

### Patch Changes

- [`9831c09`](https://github.com/weapp-vite/weapp-vite/commit/9831c097e0344a7313a6185f3672ce28ed645d42) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 允许在 json 里的 usingComponents 使用别名

- Updated dependencies [[`e15adce`](https://github.com/weapp-vite/weapp-vite/commit/e15adce483e9b47ef836680df49321db5431ac31)]:
  - @weapp-core/shared@1.0.2
  - @weapp-core/init@1.0.7

## 1.4.1

### Patch Changes

- [`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix:

- Updated dependencies [[`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d)]:
  - @weapp-core/init@1.0.6

## 1.4.0

### Minor Changes

- [`a5e2cbe`](https://github.com/weapp-vite/weapp-vite/commit/a5e2cbe3e811e89accc5932cb8e0a5d3ad3322b7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - <br/>

  - feat: 独立分包单独进行构建
  - feat: 配置 `json` 支持注释

## 1.3.4

### Patch Changes

- [`7a249e7`](https://github.com/weapp-vite/weapp-vite/commit/7a249e7903cbf27e28aa3583e035707f1e433bcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 watcher 输出日志

## 1.3.3

### Patch Changes

- [`b480be8`](https://github.com/weapp-vite/weapp-vite/commit/b480be86bd1ece7f6eec2e873d44f4883a62ea50) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 envDir 配置选项

## 1.3.2

### Patch Changes

- [`f905c14`](https://github.com/weapp-vite/weapp-vite/commit/f905c140f20b22583c8a2b713f73c46bdf927b1f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: json 文件重复 emit 问题

## 1.3.1

### Patch Changes

- [`dae031f`](https://github.com/weapp-vite/weapp-vite/commit/dae031f2e2c6aa319c1fb6d4537182495433c722) Thanks [@sonofmagic](https://github.com/sonofmagic)! - refactor: 整理依赖项提交

## 1.3.0

### Minor Changes

- [`b52d53a`](https://github.com/weapp-vite/weapp-vite/commit/b52d53ac848823b51e293c2e9318d82cc7d003f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 改进现有的依赖分析算法

## 1.2.5

### Patch Changes

- Updated dependencies [[`374bd9d`](https://github.com/weapp-vite/weapp-vite/commit/374bd9d22ad9df1aac65338f741b6fcc70bd342c)]:
  - @weapp-core/init@1.0.5

## 1.2.4

### Patch Changes

- [`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 构建后不停止的问题

- Updated dependencies [[`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926)]:
  - weapp-ide-cli@2.0.6

## 1.2.3

### Patch Changes

- [`3499363`](https://github.com/weapp-vite/weapp-vite/commit/34993636a593f95b349007befbf228c4449551a9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: npm 包构建报错问题

## 1.2.2

### Patch Changes

- [`a0b7eb9`](https://github.com/weapp-vite/weapp-vite/commit/a0b7eb98a54ba80ebe3da439908be521a1121a75) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 会 watch 和依赖死循环问题

## 1.2.1

### Patch Changes

- [`db848f9`](https://github.com/weapp-vite/weapp-vite/commit/db848f929ba144ec82a87d37c7195d98c93b92d8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 fdir 替换 klaw for better performance

## 1.2.0

### Minor Changes

- [`aa14554`](https://github.com/weapp-vite/weapp-vite/commit/aa14554bc6c5dec7ca56f0a70368e6b612dc9cca) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加自动构建 npm 算法

## 1.1.7

### Patch Changes

- [`1df6bab`](https://github.com/weapp-vite/weapp-vite/commit/1df6baba4419816260ae4e144e32331edba08ee8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复不正确的 wxss 产物路径问题

## 1.1.6

### Patch Changes

- [`de1b0f2`](https://github.com/weapp-vite/weapp-vite/commit/de1b0f2f88a37f0ea04f10787100ab5f3a36c192) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#6](https://github.com/weapp-vite/weapp-vite/issues/6) 由于 `typescript` 文件作为入口的时候，`css` 样式文件没有被正确的处理 导致的这个问题

## 1.1.5

### Patch Changes

- [`5cc86a5`](https://github.com/weapp-vite/weapp-vite/commit/5cc86a5be6eb7caa6bedbf586f04489ad90d0411) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dist watch 目录无限死循环问题

## 1.1.4

### Patch Changes

- [`584fe62`](https://github.com/weapp-vite/weapp-vite/commit/584fe6211f14d88779a711edba72e682b24ac59f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: css preprocessCSS error

## 1.1.3

### Patch Changes

- Updated dependencies [[`c0146d3`](https://github.com/weapp-vite/weapp-vite/commit/c0146d31304f35db5b3a03aa9f9497ed46688730)]:
  - @weapp-core/init@1.0.4
  - weapp-ide-cli@2.0.5

## 1.1.2

### Patch Changes

- [`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: deps upgrade

- Updated dependencies [[`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a)]:
  - weapp-ide-cli@2.0.4

## 1.1.1

### Patch Changes

- [`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Date: 2024-09-01

  - 重构 `vite` 上下文的实现
  - 优化自定义的路径的显示效果

- Updated dependencies [[`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8)]:
  - weapp-ide-cli@2.0.3
  - @weapp-core/init@1.0.3

## 1.1.0

### Minor Changes

- [`5507cd8`](https://github.com/sonofmagic/weapp-tailwindcss/commit/5507cd8c38fc0f0821548cb1f8382ae8e9d5fbf9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - support cli mode param

  releated: https://github.com/sonofmagic/weapp-tailwindcss/discussions/369

## 1.0.6

### Patch Changes

- Updated dependencies [6f469c3]
  - weapp-ide-cli@2.0.2

## 1.0.3

### Patch Changes

- fbb1ed7: 修复 `@weapp-core/init` 和 `weapp-vite` 的一些问题
- Updated dependencies [fbb1ed7]
  - @weapp-core/init@1.0.2

## 1.0.2

### Patch Changes

- f7a2d5d: fix: watcher do not close error
- Updated dependencies [f7a2d5d]
  - @weapp-core/init@1.0.1
  - @weapp-core/logger@1.0.1
  - @weapp-core/shared@1.0.1
  - weapp-ide-cli@2.0.1

## 1.0.1

### Patch Changes

- 2e458bb: fix: Cannot find module `weapp-vite/config` error

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- 0fc5083: release alpha
- f22c535: chore: compact for `weapp-vite`
- 2b7be6d: feat: add serve watch files
- Updated dependencies [80ce9ca]
- Updated dependencies [0fc5083]
- Updated dependencies [f22c535]
- Updated dependencies [36f5a7c]
- Updated dependencies [2b7be6d]
  - weapp-ide-cli@2.0.0
  - @weapp-core/shared@1.0.0
  - @weapp-core/init@1.0.0
  - @weapp-core/logger@1.0.0

## 1.0.0-alpha.4

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- Updated dependencies [36f5a7c]
  - @weapp-core/logger@1.0.0-alpha.1
  - @weapp-core/shared@1.0.0-alpha.4
  - @weapp-core/init@1.0.0-alpha.4
  - weapp-ide-cli@2.0.0-alpha.2

## 0.0.2-alpha.3

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
- Updated dependencies [792f50c]
  - weapp-ide-cli@2.0.0-alpha.1
  - @weapp-core/logger@0.0.1-alpha.0
  - @weapp-core/shared@0.0.2-alpha.3
  - @weapp-core/init@0.0.2-alpha.3

## 0.0.2-alpha.2

### Patch Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- Updated dependencies [ffa21da]
  - weapp-ide-cli@2.0.0-alpha.0
  - @weapp-core/shared@0.0.2-alpha.2
  - @weapp-core/init@0.0.2-alpha.2

## 0.0.2-alpha.1

### Patch Changes

- a4adb3f: feat: add serve watch files
- Updated dependencies [a4adb3f]
  - @weapp-core/shared@0.0.2-alpha.1
  - @weapp-core/init@0.0.2-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- f28a193: release alpha
- Updated dependencies [f28a193]
  - @weapp-core/shared@0.0.2-alpha.0
  - @weapp-core/init@0.0.2-alpha.0

## 0.0.1

### Patch Changes

- f01681a: release version
- Updated dependencies [f01681a]
  - @weapp-core/shared@0.0.1
  - @weapp-core/init@0.0.1
