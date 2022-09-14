interface ReqFnArg {
    args: unknown,
    pipes?: Result | Result[],
}
type ReqFn = (arg?: ReqFnArg) => void | Promise<unknown>
// 任务队列中每个成员的配置项
interface FnConfigs {
    func: ReqFn,
    args?: unknown,
    callback?: (argument: Result) => void,
}
// 任务队列(无论同步或异步)
type Awaits = (ReqFn | FnConfigs)[]
// combineAsyncError函数的配置项
interface Configs {
    over: (data: Returns) => void,
    forever?: boolean,
    pipes?: {
        single?: boolean,
        whole?: boolean,
    },
}
// 每个请求函数成功、失败时的值
interface Result {
    flag: boolean,
    data: {
        info: unknown,
    }
}
interface Error {
    info: unknown,
    funcName: string,
}
// combineAsyncError函数的返回值
interface Returns {
    result: Result[],
    error:
    | null
    | Error,
}
type Combine = (awaits: Awaits, config: Configs) => void

export {
    Awaits,
    ReqFn,
    Configs,
    Returns,
    Combine,
}