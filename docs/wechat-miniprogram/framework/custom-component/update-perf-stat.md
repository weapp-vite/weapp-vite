<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/update-perf-stat.html -->

# 获取更新性能统计信息

> 基础库 2.12.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

如果想要知道 setData 引发界面更新的开销，可以使用更新性能统计信息接口。它将返回每次更新中主要更新步骤发生的时间戳，可以用来大体上估计自定义组件（或页面）更新性能。例如：

```js
Component({
  attached() { // 调用时机不能早于 attached
    this.setUpdatePerformanceListener({withDataPaths: true}, (res) => {
      console.log(res)
    })
  }
})
```

`setUpdatePerformanceListener` 方法接受一个 `options` 对象和回调函数 `listener` 作为参数。

其中， `options` 对象包含以下字段：

<table><thead><tr><th>字段</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>withDataPaths</td> <td>Boolean</td> <td>是否返回变更的 data 字段信息</td></tr></tbody></table>

`listeners` 返回携带一个 `res` 对象，表示一次由 setData 引发的 **更新过程** 。根据 setData 调用时机的不同，更新过程大体可以分为三类：

1. **基本更新** ，它有一个唯一的 `updateProcessId` ；
2. **子更新** ，它是另一个基本更新的一个子步骤，也有唯一的 `updateProcessId` ，但还有一个 `parentUpdateProcessId` ；
3. **被合并更新** ，它被合并到了另一个基本更新或子更新过程中，无法被独立统计。

每次成功的 setData 调用都会产生一个更新过程，使得 `listener` 回调一次。不过 setData 究竟触发了哪类更新过程很难判断，更新性能好坏与其具体是哪类更新也没有必然联系，只是它们的返回值参数有所不同。

`res` 中包含以下字段：

<table><thead><tr><th>字段</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>updateProcessId</td> <td>Number</td> <td>此次更新过程的 ID</td></tr> <tr><td>parentUpdateProcessId</td> <td>Number</td> <td>对于子更新，返回它所属的更新过程 ID</td></tr> <tr><td>isMergedUpdate</td> <td>Boolean</td> <td>是否是被合并更新，如果是，则 <code>updateProcessId</code> 表示被合并到的更新过程 ID</td></tr> <tr><td>dataPaths</td> <td>Array</td> <td>此次更新的 data 字段信息，只有 <code>withDataPaths</code> 设为 <code>true</code> 时才会返回</td></tr> <tr><td>pendingStartTimestamp</td> <td>Number</td> <td>此次更新进入等待队列时的时间戳</td></tr> <tr><td>updateStartTimestamp</td> <td>Number</td> <td>更新运算开始时的时间戳</td></tr> <tr><td>updateEndTimestamp</td> <td>Number</td> <td>更新运算结束时的时间戳</td></tr></tbody></table>

说明：

- `setUpdatePerformanceListener` 只会激活当前组件或页面的统计， `parentUpdateProcessId` 有可能是其他组件或者页面的更新过程 ID 而未被统计回调，如果想要知道页面内所有的更新过程，需要在所有组件中都调用 `setUpdatePerformanceListener` ；
- 统计本身有一点点开销，如果想要禁用统计，调用 `setUpdatePerformanceListener` 时传入第二个参数 `listener` 为 `null` 即可。
