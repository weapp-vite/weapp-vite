<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-sdk/wx_operation.html -->

# 异步接口使用指南

> 头文件： `wmpf/operation.h` 。

SDK 的接口存在大量异步操作。如果看到一个函数的返回值类型为 `wx_operation_t` ，则说明此函数是一个异步函数，需要在合适的时机调用如下任一函数以等待来异步执行的结果：

- `wx_operation_wait()` ：同步阻塞式等待。支持设置超时时间。
- `wx_operation_await()` ：异步等待，不会阻塞当前线程。支持设置回调函数。

如果不关心异步操作的结果，可以调用如下函数释放 `wx_operation_t` 对象。

- `wx_operation_destroy()` ：主动销毁 `wx_operation_t` 对象。异步操作会继续执行。

如果想取消一个异步操作，可以调用如下函数：

- `wx_operation_cancel()` ：取消异步操作。

请特别注意 `wx_operation_t` 对象的生命周期，以免造成内存泄漏：

- 调用 `wx_operation_wait` 或 `wx_operation_await` 函数直至异步调用结束，那么 `wx_operation_t` 对象会被自动回收。
- 如果调用 `wx_operation_wait` 超时，可以重新调用 `wx_operation_wait` 函数以继续等待，或者调用 `wx_operation_cancel()` 主动结束此次异步调用。cancel 后 `wx_operation_t` 对象亦会被自动回收。
- 也可以手动调用 `wx_operation_destroy()` 销毁 operation 对象，这种情况下异步操作还会继续进行，但是将不会收到异步调用的结果。

## 1. 同步等待

同步阻塞当前线程，直到操作完成或超时。

- 如果操作完成（包括正常返回和接口异常的情况）， `wx_operation_t` 将被自动释放。
- 如果异步操作没有在指定时间内完成，返回 `WXERROR_TIMEOUT` 。可以有以下选择：
    - 重新调用 `wx_operation_wait()` 继续等待；
    - 调用 `wx_operation_cancel()` 取消异步调用；
    - 调用 `wx_operation_destroy()` 销毁 operation 对象。

```c
wx_error_t wx_operation_wait(wx_operation_t operation, uint32_t timeout_ms);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>operation</td> <td>wx_operation_t</td> <td>想要等待的 operation 对象</td></tr> <tr><td>timeout_ms</td> <td>uint32_t</td> <td>超时时间，单位毫秒。设置为 <code>0</code> 表示不超时。</td></tr></tbody></table>

**返回值**

`wx_error_t` wait 的结果

<table><thead><tr><th>错误码</th> <th>说明</th></tr></thead> <tbody><tr><td>WXERROR_OK</td> <td>接口调用正常完成，operation 对象会被自动释放。</td></tr> <tr><td>WXERROR_TIMEOUT</td> <td>operation 超时。</td></tr> <tr><td>其他</td> <td>接口调用异常返回错误，operation 对象会被自动释放。</td></tr></tbody></table>

## 2. 异步等待

异步等待，不会阻塞当前线程。异步操作的结果将通过 `callback` 函数通知。 `wx_operation_t` 对象将会被自动释放。

```c
void wx_operation_await(wx_operation_t operation,
                        wx_operation_callback_t callback,
                        void* user_data);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>operation</td> <td>wx_operation_t</td> <td>想要等待的 operation 对象</td></tr> <tr><td>callback</td> <td>wx_operation_callback_t</td> <td>回调函数</td></tr> <tr><td>user_data</td> <td>void*</td> <td>想要在回调函数里接收的自定义数据。</td></tr></tbody></table>

## 3. 取消异步操作

取消异步操作， `wx_operation_t` 对象会被释放。调用该函数之后，不应该再对 `wx_operation_t` 对象执行任何操作。

```c
wx_error_t wx_operation_cancel(wx_operation_t operation);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>operation</td> <td>wx_operation_t</td> <td>想要取消的 operation 对象</td></tr></tbody></table>

**返回值**

`wx_error_t` cancel 的结果

## 4. 释放对象

主动释放 `wx_operation_t` 对象，但不会取消异步操作本身。调用该函数之后，不应该再对 operation 对象执行任何操作。

- 如果没有对 `wx_operation_t` 对象调用 wait 或 cancel 函数，且不关心异步操作的结果，可以调用此函数手动释放 `wx_operation_t` 对象。
- 当调用 `wx_operation_wait()` 函数返回 `WXERROR_TIMEOUT` ，如果不希望继续等待，可以调用此函数来释放 `wx_operation_t` 对象。
- 其他情况下 `wx_operation_t` 对象会被自动释放，不应该再调用此函数主动释放。

```c
void wx_operation_destroy(wx_operation_t operation);
```

**参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>operation</td> <td>wx_operation_t</td> <td>想要释放的 operation 对象</td></tr></tbody></table>
