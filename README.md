# 摘要

开发中无论怎样都会产生网络请求，这样一来自然也就避免不了大量使用`then`、`catch`或`try catch`来捕获错误，而捕获错误的代码量是随着网络请求的增多而增多，那应该如何优雅的系统性捕获某个网络请求中所对应的所有错误呢？

# 需求

现有**嵌套请求**如下：

先请求书本作者---再请求书本价格---再请求书本出版社

- 当成功时则需要返回所有结果
- 当某次请求失败时，需要抛出具体的错误原因

# 模拟异步

在这里我们称`requestAuthor`、`requestPrice`、`requestPress`为请求函数。且`interface`用于模拟某次请求的成功与否
```js
// 标识每次请求的成功与否
const interface = [true, false, false]

const book = '三国演义'
// 请求书本的作者信息接口
const requestAuthor = () => new Promise((res, rej) => {
    setTimeout(() => {
        if (interface[0]) return res(`《${book}》的作者是罗贯中`)
        rej(`请求《${book}》的【作者】时出错，你现在可以做出具体的操作了`)
    }, 1000)
})
// 请求书本的价格信息接口
const requestPrice = () => new Promise((res, rej) => {
    setTimeout(() => {
        if (interface[1]) return res(`《${book}》的价格是99元`)
        rej(`请求《${book}》的【价格】时出错，你现在可以做出具体的操作了`)
    }, 1000)
})
// 请求书本的出版社信息接口
const requestPress = () => new Promise((res, rej) => {
    setTimeout(() => {
        if (interface[2]) return res(`《${book}》的出版社是人民邮电出版社`)
        rej(`请求《${book}》的【出版社】时出错，你现在可以做出具体的操作了`)
    }, 1000)
})
```

# Promise

```js
requestAuthor()
    .then(data => {
        console.log('第一次请求', data)
        return requestPrice()
    })
    .then(data => {
        console.log('第二次请求', data)
        return requestPress()
    })
    .then(data => {
        console.log('第三次请求', data)
    })
    .catch(e => console.log('请求出错', e))
```

> async的实现方式与上述代码大致相同，所以不再给出

使用链式`then`的方式，在我看来，有以下问题
- 如果想在**第三次请求**中得到前面两次的请求结果，可能需要对每个`then`的返回值以及请求函数进行包装，或使用额外的环境进行存储
- 如果想让某个请求函数在出错时，**继续往下执行**，这可能就需要对`Promise`作一番处理
- 现在只是三次嵌套请求，如果**继续增加**则会导致`then`也继续增加

综上所述，现在给出`combine-async-error`的解决方案

# combine-async-error

## 安装

```cmd
npm install combine-async-error
```

## 入门

```js
import combineAsyncError from 'combine-async-error'

const asyncQueue = [requestAuthor, requestPrice, requestPress]
const end = data => console.log(data)

combineAsyncError(asyncQueue)
	.then(end)
```

## 参数说明

接收两个参数
- `awaits`：异步任务队列
- `config`：配置项

### awaits

`awaits`必须是一个数组，该数组中的每位成员必须是**函数或对象**，举例

```js
const asyncQueue = [ requestAuthor ]
const end = data => console.log(data)

combineAsyncError(asyncQueue)
	.then(end)
```

当`awaits`是对象时，格式如下
```js
const asyncQueue = [
    requestAuthor,
    {
        func: requestPrice,
        args: ['鲨鱼辣椒'],
        callback: Function.prototype
    }
]
const end = data => console.log(data)

combineAsyncError(asyncQueue)
    .then(end)
```
`func`为要执行的请求函数

`[args]`表示当执行请求函数时要传递的参数；可选

`[callback]`会在请求函数执行完毕时调用；可选

### config

传入`combineAsyncError`的配置项，如不传入，则全部使用默认配置项

## 配置项

### isCheckTypes

在设计`combine-async-error`时，关于传入的参数是否进行校验，其实是存在一些负面影响的，为此，`combine-async-error`主动添加了`isCheckTypes`配置项，如果该配置项的值为`false`，则不对入参进行检查，反之进行严格的类型检查。如果可以确保传入的类型始终是正确的，那么强烈建议你将该配置项更改为`false`；默认为`true`

> 由于JavaScript中存在隐式类型转换，所以即使你指定了isCheckTypes为true，combine-async-error也不会对传入的第二个参数(config)进行检查

```js
isCheckTypes: true
```

### acc

```js
acc: () => {}
```

如果指定了该值为函数，则**所有请求**完成后会执行该函数，此`回调函数`会收到**最终的请求结果**

如果未指定该值，则`combine-async-error`返回一个`Promise`对象，你可以在它的`then`方法中得到**最终的请求结果**

### forever

遇到错误时，是否继续执行(发出请求)。无论是嵌套还是并发请求模式，该配置项始终生效

```js
forever: false
```

### pipes

#### single

后一个请求函数是否接收前一个请求函数的结果

#### whole

后一个请求函数是否接收前面所有请求函数的结果

当`whole`为`true`时，`single`无效，反之有效

```js
pipes: {
    single: false,
    whole: true
}
```

### all

`combine-async-error`应该得到原有的扩展，为此它支持新的配置项`all`，如果为`all`指定了`order`值，则传入`combine-async-error`的请求数组会并发执行，而不是继续以嵌套的形式执行

下面的写法相当于使用了`all`的默认配置，因为`all`的值默认为`false`

```js
all: false // 嵌套请求
```

下面的写法则是开启了**并发之旅**，`all`为一个`对象`，其`order`属性决定并发的请求结果是否按照顺序来存放到最终数组中

```js
all: {
	order: true
}
```

关于`order`的使用，举例如下

```
// 假设requestAuthor始终会在3-6秒钟之内返回请求结果
const requestAuthor = () => {}
// 假设requestPrice始终会在1秒钟之内返回请求结果
const requestPrice = () => {}

const getInfo = [requestAuthor, requestPrice]
combine-async-error(getInfo, {
	all: {
		order: true
	}
})
```

由于你指定了`order`为`true`，那么在**最终的请求结果**数组`result`中，`requestAuthor`的请求结果会作为`result`的第一个成员出现，而`requestPrice`的请求结果则会作为该数组的第二个成员出现，这是因为`order`始终会保证`result`与`getInfo`的顺序一一对应，即使`requestPrice`是最先执行完的请求函数

如果指定了`order`为`false`，则最先执行完的请求函数所对应的结果就会在`result`中越靠前；在上例中`requestPrice`的请求结果会出现在`result`的第一个位置

### requestCallback

```js
requestCallback: {
	always: false,
	success: false,
	failed: false
}
```

`always`表示无论请求函数是成功还是失败，都会在拿到请求结果后执行为该请求函数提前指定好的`callback`，此`callback`会收到当前请求函数的结果

`success`表示只有当请求函数成功时，才会去执行提前执行好的`callback`，并且`callback`会收到当前请求函数执行成功的结果；`failed`则表示失败，与`success`同理

例如，当传入请求函数的形式为

```
combine-async-error([
	{
		func: requestAuthor,
		callback: () => {} // 提前为requestAuthor指定好的回调函数
	}
], {
	requestCallback: {
		failed: true // 指定了failed
	}
})
```

上述示例中，只有当`requestAuthor`请求函数出错时，才会执行该请求函数所指定好的`callback`回调，并且此回调函数会收到`requestAuthor`失败的原因

## 返回值

需要注意的是，`combine-async-error`不会抛出任何错误(除非你传递的类型参数不正确)

### combineAsyncError的返回值

该返回值取决于是否指定了`acc`配置项
`combineAsyncError`的返回值有以下两种情况
- `undefined`
- `Promise`实例

### 请求结果的返回值

#### 请求成功
当所有请求函数都执行成功时，收到的结果如下

```js
// 标识每次请求的失败与否
const interface = [true, true, true]
```

```js
{
    "result": [
        { "flag": true, "data": { "msg": "《三国演义》的作者是罗贯中" } },
        { "flag": true, "data": { "msg": "《三国演义》的价格是99元" } },
        { "flag": true, "data": { "msg": "《三国演义》的出版社是人民邮电出版社" } }
    ],
    "error": null
}
```

`error`为`null`，代表本次没有请求函数出现失败

`result`中存储着每次请求到的数据，`flag`标识当前请求是否成功，`data.msg`则为请求到的数据

#### 某个请求函数失败

```js
// 标识每次请求的失败与否
const interface = [true, false, true]
```

```js
{
    "result": [
        { "flag": true, "data": { "msg": "《三国演义》的作者是罗贯中" } }
    ],
    "error": {
        "msg": "请求《三国演义》的【价格】时出错，你现在可以做出具体的操作了",
        "funcName": "requestPrice"
    }
}
```

当某个请求失败时，`error`中将包含该请求函数的**失败原因**及**名字**

#### 注意

`请求结果({result: ..., error: ...})`的返回形式，及如何返回，会受到`配置项`的影响

# 不足

如果你对`combine-async-error`有任何建议，欢迎反馈

期待你的最优解


    // 修复了配置项失效的问题
    // requestCallback
    // all
    // isCheckTypes