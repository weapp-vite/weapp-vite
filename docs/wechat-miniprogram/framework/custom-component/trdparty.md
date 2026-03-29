<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/trdparty.html -->

# 开发第三方自定义组件

小程序从基础库版本 [2.2.1](../compatibility.md) 开始支持使用 npm 安装第三方包，因此也支持开发和使用第三方自定义组件包。关于 npm 功能的详情可先阅读 [相关文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html) 。

## 准备

开发一个开源的自定义组件包给他人使用，首先需要明确他人是要如何使用这个包的，如果只是拷贝小程序目录下直接使用的话，可以跳过此文档。此文档中后续内容是以 npm 管理自定义组件包的前提下进行说明的。

在开发之前，要求开发者具有基础的 node.js 和 npm 相关的知识，同时需要准备好支持 npm 功能的开发者工具， [点此下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 。

## 下载模板

为了方便开发者能够快速搭建好一个可用于开发、调试、测试的自定义组件包项目，官方提供了一个 [项目模板](https://github.com/wechat-miniprogram/miniprogram-custom-component) ，下载使用模板的方式有三种：

- 直接从 github 上下载 zip 文件并解压。
- 直接将 github 上的仓库 clone 下来。
- 使用官方提供的命令行工具初始化项目，下面会进行介绍。

项目模板中的构建是基于 gulp + webpack 来执行的，支持开发、构建、测试等命令，详情可参阅项目模板的 [README.md](https://github.com/wechat-miniprogram/miniprogram-custom-component/blob/master/README.md) 文件。

## 命令行工具

官方提供了 [命令行工具](https://github.com/wechat-miniprogram/miniprogram-cli) ，用于快速初始化一个项目。执行如下命令安装命令行工具：

```
npm install -g @wechat-miniprogram/miniprogram-cli
```

然后新建一个空目录作为项目根目录，在此根目录下执行：

```
miniprogram init --type custom-component
```

命令执行完毕后会发现项目根目录下生成了许多文件，这是根据官方的 [项目模板](https://github.com/wechat-miniprogram/miniprogram-custom-component) 生成的完整项目，之后开发者可直接在此之上进行开发修改。

命令行工具的更多用法可以查看 github 仓库上的 [README.md](https://github.com/wechat-miniprogram/miniprogram-cli/blob/master/README.md) 文件。

> PS：第一次使用 `miniprogram init` 初始化项目会去 github 上拉取模板，因此需要保证网络畅通。

## 测试工具

针对自定义组件的单元测试，可参阅文档 [单元测试](./unit-test.md) 。

## 自定义组件示例

以下为官方提供的自定义组件，可以参考并使用：

- [weui-miniprogram](https://github.com/wechat-miniprogram/weui-miniprogram)
- [recycle-view](https://github.com/wechat-miniprogram/recycle-view)

## 自定义组件扩展示例

以下为官方提供的自定义组件扩展，可以参考并使用：

- [computed](https://github.com/wechat-miniprogram/computed)
