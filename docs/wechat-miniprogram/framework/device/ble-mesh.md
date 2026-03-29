<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/ble-mesh.html -->

# 蓝牙低功耗网状网络（BLE Mesh）

蓝牙低功耗网状网络（BLE Mesh）是建立在 [**蓝牙低功耗（BLE）**](./ble.md) 协议基础上的一种通信协议，它允许大量 BLE 设备组成一个网状网络，在足够大的物理覆盖范围内实现设备之间的互联与协同控制，从而满足多设备场景下的通信需求。

BLE Mesh 通信协议支持低功耗、可扩展性、灵活性、高可靠性、安全性等优秀特性，在智能家居、智能照明、工业自动化、医疗健康、环境监测等领域具有广泛的应用价值。

## 1. 基础概念

#### BLE Mesh 网络

BLE Mesh 网络是一种多对多的网络拓扑结构，网络中的设备节点通过「发布 / 订阅机制」收发消息。

#### 设备配网

未配网 BLE Mesh 设备需要完成配网操作后，才能加入 BLE Mesh 网络并成为设备节点，与网络中的其他节点进行消息通信。帮助 BLE Mesh 设备完成配网操作的设备叫做「启动配置设备」。

#### 设备节点

未配网 BLE Mesh 设备经过配网操作后，就成为了 BLE Mesh 网络中的设备节点。设备节点一般都具有中继、代理、好友、低功耗等特性中的一个或多个。

设备节点由多个元素构成，每个元素包含了多个模型，而每个模型定义了节点的基本功能，比如节点所需要的状态、控制状态的消息以及处理消息所产生的动作等。节点功能的实现是基于模型的，模型可分为 SIG 模型和自定义模型，前者由 SIG 定义，而后者由开发者定义。模型也可基于消息的发送 / 接收方分为客户端模型与服务端模型。

#### Mesh 地址

BLE Mesh 网络中的设备节点之间想要进行消息通信，就需要为每个节点分配地址用于消息的收发。Mesh 地址主要分为单播地址、组播地址、虚拟地址三种。

单播地址是在设备配网成功后由「启动配置设备」分配的。单播地址可能会出现在消息的来源 / 目标地址字段中。发送到单播地址的消息只能由拥有该单播地址的元素进行处理。

组播地址是 BLE Mesh 网络中的一种多播地址，通常用于将设备节点进行分组。如果发送带有组播地址的消息，所有订阅过该组播地址的设备节点都会收到该消息。

虚拟地址与特定的 UUID 标签相关联，可以用作模型的发布地址或订阅地址。

#### Mesh 消息

Mesh 消息分为控制消息与接入消息。控制消息是与 BLE Mesh 网络操作有关的消息，例如心跳和好友的请求消息。接入消息允许客户端模型检索或设置服务端模型中的状态值，或被服务端用于报告状态值。

Mesh 消息是 BLE Mesh 网络中数据传输的基本单位，由操作码（opcode）和携带参数（parameters）组成，前者用于标识消息的用途唯一性，后者可以存储有效数据，例如目标地址、设备状态等。

#### 代理设备

如果想要不是 BLE Mesh 设备的其他设备（例如手机）也能成为 BLE Mesh 网络中的一员，可以通过与代理设备节点进行 GATT 连接，借助代理设备实现在 BLE Mesh 网络中收发各种消息。

## 2.「小程序 BLE Mesh 插件」使用流程

在小程序中，基于标准 BLE Mesh 通信协议，以小程序插件形式提供了 BLE Mesh 的基础能力。开发者可以通过「小程序 BLE Mesh 插件」实现 BLE Mesh 设备的本地快速配网、控制管理、网络共享等功能。平台提供了「 [接口文档](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx013447465d3aa024) 」与「 [示例小程序](https://developers.weixin.qq.com/s/DsTarRmk7bM4) 」，方便开发者接入使用。

### 2.1 接入插件

在使用插件前，首先需要在小程序管理后台的「设置 - 第三方服务 - 插件管理」中添加插件，开发者可以登录小程序管理后台，通过 appid - wx013447465d3aa024 查找插件并添加。然后在 `app.json` 文件中声明指定版本的插件。关于小程序插件的具体介绍可参考「 [使用插件](../plugin/using.md) 」。

目前只有申请了「 [工具—设备管理](./device-access.md) 」服务类目的小程序才能使用「小程序 BLE Mesh 插件」。

```json
"plugins": {
  "ble-mesh-plugin": {
    "version": "latest",
    "provider": "wx013447465d3aa024"
  }
}
```

通过 `requirePlugin` 方法才能获取「小程序 BLE Mesh 插件」的相关接口。例如可以像下面这样调用：

```js
const { getMeshBLEManager } = requirePlugin('ble-mesh-plugin')
```

### 2.2 初始化 BLE Mesh 蓝牙配置器

在使用小程序 BLE Mesh 相关能力前，需要初始化 BLE Mesh 蓝牙配置器，用于扫描发现周围的 BLE Mesh 设备。

```js
const meshBLEManager = getMeshBLEManager()

meshBLEManager.init().then(({ enabled }) => {
  if (!enabled) {
    wx.showModal({
      title: '错误',
      content: '未启用蓝牙功能, 请打开蓝牙后重试',
      showCancel: false,
    })
  }
})
```

### 2.3 扫描发现 BLE Mesh 设备

BLE Mesh 蓝牙配置器初始化后，需要通过 `meshBLEManager.startScanMeshDevice` 扫描 BLE Mesh 设备，如果在附近扫描到设备就会回调 `meshBLEManager.onMeshDeviceFound` 事件，返回扫描到的 BLE Mesh 设备实例。由于扫描设备操作比较耗费系统资源，请在搜索到需要的设备后及时调用 `meshBLEManager.stopScanMeshDevice` 停止扫描。

```js
meshBLEManager.onMeshDeviceFound((res) => {
  // 扫描到的 BLE Mesh 设备
  console.log(res.device)
  // 找到需要的设备后，停止扫描操作
  meshBLEManager.stopScanMeshDevice()
})

// 开始扫描 BLE Mesh 设备
meshBLEManager.startScanMeshDevice({
  allowDuplicatesKey: false,
})
```

### 2.4 创建 BLE Mesh 网络

想要实现多个 BLE Mesh 设备之间的互联与协同控制，就需要先创建一个 BLE Mesh 网络。

```js
createMeshNetwork({ name: 'mesh_network' }).then((res) => {
  // 创建 BLE Mesh 网络后会生成唯一的网络标识id，用于后续的网络管理、设备配网、设备消息通信等功能。
  console.log(res.networkId)
})
```

### 2.5 共享 BLE Mesh 网络

开发者可以通过 `exportMeshNetworks` 与 `importMeshNetworks` 实现 BLE Mesh 网络数据的导入导出，让多个小程序用户可以控制管理同一网络下的 BLE Mesh 设备。此外调用 `getMeshNetworks` 还可以获取当前存在的所有 BLE Mesh 网络列表。

```js
// 导出 BLE Mesh 网络数据
const { restoreData } = exportMeshNetworks({ data: [{ name: 'mesh_network' }] })
// 导入 BLE Mesh 网络数据
importMeshNetworks({ restoreData })
// 获取当前存在的 BLE Mesh 网络列表
const networks = getMeshNetworks() // [{ name: 'network_name', networkId: 'network_id' }]
```

#### 注意

在通过 `exportMeshNetworks` 导出 BLE Mesh 网络数据后，可能需要对数据进行持久化存储。为了保证网络安全，开发者应该将数据加密后再执行存储操作，然后在导入时将数据解密。

在通过 `importMeshNetworks` 将 BLE Mesh 网络数据导入新用户小程序时，由于 iOS 系统限制，同一台 BLE Mesh 设备，不同用户获取到的蓝牙 deviceId 不同，导致无法建立代理设备连接。此时需要设备端在配网成功后持续广播 `Node Identity` 蓝牙广播包，方便小程序插件识别设备节点，更新蓝牙 deviceId 。

### 2.6 BLE Mesh 网络管理

通过 `getMeshNetworkManager` 可以获取 BLE Mesh 网络管理配置器，它包括了创建 / 删除 BLE Mesh 群组、获取 BLE Mesh 网络中所有节点的单播地址列表以及组播地址列表等功能。

```js
// 获取 BLE Mesh 网络管理配置器
const meshNetworkManager = getMeshNetworkManager({ networkId: 'network_id' })
// 创建 BLE Mesh 群组
const group = meshNetworkManager.createGroup({ name: 'group_name' })
// 删除 BLE Mesh 群组
meshNetworkManager.removeGroup({ name: 'group_name' })
// 获取组播地址列表
const groups = meshNetworkManager.getGroups()
[{
  name, // BLE Mesh 群组名称
  address, // BLE Mesh 组播地址
  nodes, // BLE Mesh 组播地址下绑定的设备节点信息
}]
// 获取单播地址列表
const unicasts = meshNetworkManager.getUnicasts()
[{
  deviceId, // BLE Mesh 设备id
  name, // BLE Mesh 设备名称
  localName, // BLE Mesh 设备广播数据段中的 LocalName 数据段
  address, // BLE Mesh 设备单播地址
}]
```

### 2.7 BLE Mesh 设备配网

想要实现 BLE Mesh 设备配网，首先需要获取 BLE Mesh 设备入网配置器 `provisioningManager` ，然后通过 `provisioningManager.provision` 完成配网操作。此外还可以通过 `provisioningManager.batchProvision` 实现一键配网多个 BLE Mesh 设备。当 BLE Mesh 设备完成配网操作后，才算真正加入了 BLE Mesh 网络。

```js
// 获取 BLE Mesh 设备入网配置器
const provisioningManager = getProvisioningManager({ networkId: 'network_id' })
// 单个 BLE Mesh 设备配网
await provisioningManager.provision({
  unprovisionedDevice, // 未配网的 BLE Mesh 设备实例
  authenticationMethod: AuthenticationMethod.NoOOB, // 配网时的 OOB 安全认证方式
})
// 多个 BLE Mesh 设备批量配网
await provisioningManager.batchProvision({
  unprovisionedDevices, // 未配网的 BLE Mesh 设备实例数组
})
```

### 2.8 BLE Mesh 设备消息通信

在完成 BLE Mesh 设备配网后，如果想要和设备进行消息通信，实现控制设备与获取设备信息等功能。首先应该获取 BLE Mesh 代理设备客户端配置器 `proxyClientManager` ，在开启蓝牙扫描的情况下使用 `proxyClientManager.hasProxyServer` 确认周围是否存在可用的代理设备，然后通过 `proxyClientManager.addAppKeyToNode` 和 `proxyClientManager.bindAppKeyToModel` 将 BLE Mesh 网络中的 AppKey 绑定到目标设备的 Server 模型上，最后发送标准的 BLE Mesh 消息，用于改变目标设备 Server 模型上的状态或者检索相关信息。

```js
// 获取 BLE Mesh 代理设备客户端配置器
const proxyClientManager = getProxyClientManager({ networkId: 'network_id' })
// 检查周围是否存在可用的代理设备 Server
const hasProxyServer = proxyClientManager.hasProxyServer
if (hasProxyServer) {
  // 添加 AppKey 到目标设备
  await this.proxyClientManager.addAppKeyToNode({
    destination, // 目标设备的单播地址
  })
  // 绑定 AppKey 到目标设备的 GenericOnOffServer 模型上
  await proxyClientManager.bindAppKeyToModel({
    destination, // 目标设备的单播地址
    modelId: ModelIds.GenericOnOffServer, // 标准 GenericOnOffServer 模型的 modelId
  })
  // 获取目标设备的 GenericOnOffServer 模型上的开关状态
  const resGet = await proxyClientManager.getOnOffStatus({
    destination, // 目标设备的单播地址或组播地址
  })
  console.log(resGet.source, resGet.message.isOn)
  // 控制目标设备的 GenericOnOffServer 模型上的开关状态
  const resSet = await proxyClientManager.setOnOffStatus({
    destination, // 目标设备的单播地址或组播地址
    status, // 需要设置的开关状态
  })
  console.log(resSet.source, resSet.message.isOn)
  // 开发者还可以通过自定义 BLE Mesh 消息，发送接收最基础的 opcode 和 parameters ，来实现例如 Vendor Model 的功能。
  proxyClientManager.onMessage(({ source, opcode, parameters }) => {
    // handle mesh message
  })
  proxyClientManager.send({
    destination, // 目标设备的单播地址或组播地址
    opcode, // 操作码
    parameters, // 携带参数
  })
}
```

## 3. 注意事项

1. 开发者可以通过「小程序 BLE Mesh 插件」 [示例小程序](https://developers.weixin.qq.com/s/DsTarRmk7bM4) ，快速接入小程序 BLE Mesh 能力。
2. 关于小程序 BLE Mesh 能力的详细描述，请查阅「小程序 BLE Mesh 插件」 [接口文档](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx013447465d3aa024) 。
3. 请尽量使用「小程序 BLE Mesh 插件」 `latest` 版本，以保证功能完善、稳定可用。
4. 目前「小程序 BLE Mesh 插件」只提供了 BLE Mesh 的基础能力，后面会根据开发者需要持续迭代更新。
