<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html -->

# 使用插件

## 添加插件

在使用插件前，首先要在小程序管理后台首页的“小程序信息设置页-第三方设置-插件管理”中添加插件。开发者可登录小程序管理后台，通过 appid 查找插件并添加。如果插件无需申请，添加后可直接使用；否则需要申请并等待插件开发者通过后，方可在小程序中使用相应的插件。

## 引入插件代码包

使用插件前，使用者要在 `app.json` 中声明需要使用的插件，例如：

**代码示例：**

```json
{
  "plugins": {
    "myPlugin": {
      "version": "1.0.0",
      "provider": "wxidxxxxxxxxxxxxxxxx"
    }
  }
}
```

如上例所示， `plugins` 定义段中可以包含多个插件声明，每个插件声明以一个使用者自定义的插件引用名作为标识，并指明插件的 appid 和需要使用的版本号。其中，引用名（如上例中的 `myPlugin` ）由使用者自定义，无需和插件开发者保持一致或与开发者协调。在后续的插件使用中，该引用名将被用于表示该插件。

## 在分包内引入插件代码包

如果插件只在一个分包内用到，可以将插件仅放在这个分包内，例如：

```json
{
  "subpackages": [
    {
      "root": "packageA",
      "pages": [
        "pages/cat",
        "pages/dog"
      ],
      "plugins": {
        "myPlugin": {
          "version": "1.0.0",
          "provider": "wxidxxxxxxxxxxxxxxxx"
        }
      }
    }
  ]
}
```

在分包内使用插件有如下限制：

- 默认情况下，仅能在这个分包内使用该插件，除非通过 [分包异步化](../subpackages/async.md) 进行异步的跨分包引用；
- 同一个插件不能被多个分包同时引用；
- 如果基础库版本低于 2.9.0 ，不能从分包外的页面直接跳入分包内的插件页面，需要先跳入分包内的非插件页面、再跳入同一分包内的插件页面。

## 使用插件

使用插件时，插件的代码对于使用者来说是不可见的。为了正确使用插件，使用者应查看插件详情页面中的“开发文档”一节，阅读由插件开发者提供的插件开发文档，通过文档来明确插件提供的自定义组件、页面名称及提供的 js 接口规范等。

### 自定义组件

使用插件提供的自定义组件，和 [使用普通自定义组件](../custom-component/README.md) 的方式相仿。在 `json` 文件定义需要引入的自定义组件时，使用 `plugin://` 协议指明插件的引用名和自定义组件名，例如：

**代码示例：**

```json
{
  "usingComponents": {
    "hello-component": "plugin://myPlugin/hello-component"
  }
}
```

出于对插件的保护，插件提供的自定义组件在使用上有一定的限制：

- 默认情况下，小程序和其他插件的 `this.selectComponent` 接口无法获得插件的自定义组件实例对象，同样插件的 `this.selectComponent` 也无法获得小程序和其他插件的；
    - 这个限制可以通过 [自定义的组件实例获取结果](../custom-component/events.md#%E8%87%AA%E5%AE%9A%E4%B9%89%E7%9A%84%E7%BB%84%E4%BB%B6%E5%AE%9E%E4%BE%8B%E8%8E%B7%E5%8F%96%E7%BB%93%E6%9E%9C) 来去除
- [wx.createSelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/wx.createSelectorQuery.html) 等接口的 `>>>` 选择器无法选入插件内部。

### 页面

插件的页面从小程序基础库版本 [2.1.0](../compatibility.md) 开始支持。

需要跳转到插件页面时， `url` 使用 `plugin://` 前缀，形如 `plugin://PLUGIN_NAME/PLUGIN_PAGE` ， 如：

**代码示例：**

```html
<navigator url="plugin://myPlugin/hello-page">
  Go to pages/hello-page!
</navigator>
```

### js 接口

使用插件的 js 接口时，可以使用 `requirePlugin` 方法。例如，插件提供一个名为 `hello` 的方法和一个名为 `world` 的变量，则可以像下面这样调用：

```js
var myPluginInterface = requirePlugin('myPlugin');

myPluginInterface.hello();
var myWorld = myPluginInterface.world;
```

基础库 [2.14.0](../compatibility.md) 起，也可以通过插件的 AppID 来获取接口，如：

```js
var myPluginInterface = requirePlugin('wxidxxxxxxxxxxxxxxxx');
```

### 导出到插件

> [在开发者工具中预览效果](https://developers.weixin.qq.com/s/GbXmMLml7vjC) ，需要手动填写一下 `miniprogram/app.json` 中的插件 AppID

从基础库 [2.11.1](../compatibility.md) 起，使用插件的小程序可以导出一些内容，供插件获取。具体来说，在声明使用插件时，可以通过 `export` 字段来指定一个文件，如：

```json
{
  "myPlugin": {
    "version": "1.0.0",
    "provider": "wxidxxxxxxxxxxxxxxxx",
    "export": "index.js"
  }
}
```

则该文件（上面的例子里是 `index.js` ）导出的内容可以被这个插件用全局函数获得。例如，在上面的文件中，使用插件的小程序做了如下导出：

```js
// index.js
module.exports = { whoami: 'Wechat MiniProgram' }
```

那么插件就可以获得上面导出的内容：

```js
// plugin
requireMiniProgram().whoami // 'Wechat MiniProgram'
```

具体导出什么内容，可以阅读插件开发文档，和插件的开发者做好约定。

当插件在分包中时，这个特性也可以使用，但指定的文件的路径是相对于分包的。例如在 `root: packageA` 的分包中指定了 `export: exports/plugin.js` ，那么被指定的文件在文件系统上应该是 `/packageA/exports/plugin.js` 。

使用的多个插件的导出互不影响，两个插件可以导出同一个文件，也可以是不同的文件。但导出同一个文件时，如果一个插件对导出内容做了修改，那么另一个插件也会被影响，请注意这一点。

**请谨慎导出 wx 对象或某个具体的 wx API，这将使插件可以以使用者小程序的身份调用 API。**

另外也可以 [参考开发插件的相关文档](./development.md#%E8%8E%B7%E5%8F%96%E5%B0%8F%E7%A8%8B%E5%BA%8F%E5%AF%BC%E5%87%BA)

### 为插件提供自定义组件

> [在开发者工具中预览效果](https://developers.weixin.qq.com/s/QRRovLmu7Xjm) ，需要手动填写一下 `miniprogram/app.json` 中的插件 AppID

有时，插件可能会在页面或者自定义组件中，将一部分区域交给使用的小程序来渲染，因此需要使用的小程序提供一个自定义组件。但由于插件中不能直接指定小程序的自定义组件路径，因此需要通过为插件指定 [抽象节点（generics）](../custom-component/generics.md) 的方式来提供。

如果是插件的自定义组件需要指定抽象节点实现，可以在引用时指定：

```html
<!-- miniprogram/page/index.wxml -->
<plugin-view generic:mp-view="comp-from-miniprogram" />
```

从基础库 [2.12.2](../compatibility.md) 起，可以通过配置项为插件页面指定抽象组件实现。例如，要给插件名为 `plugin-index` 的页面中的抽象节点 `mp-view` 指定小程序的自定义组件 `components/comp-from-miniprogram` 作为实现的话：

```json
{
  "myPlugin": {
    "provider": "wxAPPID",
    "version": "1.0.0",
    "genericsImplementation": {
      "plugin-index": {
        "mp-view": "components/comp-from-miniprogram"
      }
    }
  }
}
```

另外也可以 [参考开发插件的相关文档](./development.md#%E5%BC%95%E7%94%A8%E5%B0%8F%E7%A8%8B%E5%BA%8F%E7%9A%84%E8%87%AA%E5%AE%9A%E4%B9%89%E7%BB%84%E4%BB%B6)
