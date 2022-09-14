import type { Awaits, ReqFn, Returns, Combine } from './lib/interface'

const isFn = (value: unknown): value is ReqFn => typeof value === 'function'
// 将传入的awaits统一格式化为对象形式
const formatter = (func: ReqFn) => ({
    func,
    args: undefined,
    callback: () => { },
})
const Awaitsformat = (awaits: Awaits) => awaits.map(obj => isFn(obj) ? formatter(obj) : obj)
const combineAsyncError: Combine = (awaits, configs) => {
    const tasks = Awaitsformat(awaits)
    const len = {
        i: 0,
        length: awaits.length
    }
    const combine: Returns = {
        result: [],
        error: null
    }
    const pushResult = (value: unknown, flag = true) => combine.result.push({
        flag,
        data: {
            info: value
        }
    })
    // 获取combine中的最后一位成员
    const getLastCombine = () => combine.result[combine.result.length - 1]
    // 根据pipes配置项决定每个请求函数接收的参数
    const getPipes = () => {
        // 如果指定了single
        if (configs.pipes?.single) return getLastCombine()
        // 如果指定了whole
        if (configs.pipes?.whole) return [...combine.result]
        // 未指定
        return
    }
    const handle = async (res: (data: Returns) => void) => {
        for (; len.i < len.length; len.i++) {
            const { func, args, callback } = tasks[len.i]
            try {
                const pipes = getPipes()
                const argument = pipes ? { args, pipes } : { args }
                const data = await func(argument)
                pushResult(data)
            } catch (error) {
                // 发生错误时，根据配置项forever决定是否继续往下执行
                if (!configs.forever) {
                    combine.error = {
                        info: error,
                        funcName: func.name
                    }
                    break
                }
                pushResult(error, false)
            }
            callback && callback(getLastCombine())
        }
        res(combine)
    }
    new Promise<Returns>(handle)
        .then(data => configs.over && configs.over(data))
}

export default combineAsyncError