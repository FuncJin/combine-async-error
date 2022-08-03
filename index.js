const defaultConfig = {
    isCheckTypes: true,
    acc: false,
    forever: false,
    pipes: {
        single: false,
        whole: false,
    },
    all: false,
    requestCallback: {
        always: false,
        success: false,
        failed: false,
    }
}

const checkWholeTypes = (awaits, asyncConfig) => {
    const init = v => ({ func: v, args: [], callback: Function.prototype })
    const checkType = (data, type) => Object.prototype.toString.call(data).slice(8, -1) === type
    const tasks = awaits.map(v => checkType(v, 'Object') ? { ...init(v), ...v } : init(v))
    const config = { ...defaultConfig, ...asyncConfig }
    if (!config.isCheckTypes) return { tasks, config }
    const rightType = { 'Array': 'Array: []', 'Object': 'Object: {}', 'Function': 'Function: () => void' }
    const redAlert = (c, t) => { throw TypeError(`${c} is not type ${rightType[t]}`) }
    const combineAsyncErrorArgs = [
        [awaits, 'Array', () => { redAlert(awaits, 'Array') }],
        [config, 'Object', () => { redAlert(config, 'Object') }],
    ]
    combineAsyncErrorArgs.forEach(([t, r, f]) => !checkType(t, r) ? f() : null)
    const singleArgs = {
        'func': v => !checkType(v, 'Function') ? redAlert(v, 'Function') : null,
        'args': v => !checkType(v, 'Array') ? redAlert(v, 'Array') : null,
        'callback': v => !checkType(v, 'Function') ? redAlert(v, 'Function') : null,
    }
    const proxy = new Proxy(singleArgs, { get() { return Function.prototype } })
    singleArgs.__proto__ = proxy
    const tasksType = awaits.map(v => {
        if (checkType(v, 'Object')) {
            Object.keys(v).forEach(key => singleArgs[key](v[key]))
            return { ...init(v), ...v }
        }
        singleArgs.func(v)
        return init(v)
    })
    return { tasks: tasksType, config }
}

const combineAsyncError = (awaits, asyncConfig) => {
    const { tasks, config } = checkWholeTypes(awaits, asyncConfig)
    const doGlide = {
        node: null,
        out: null,
        times: 0,
        len: awaits.length,
        data: { result: [], error: null },
    }
    const push = v => {
        doGlide.data.result.push(v)
        doGlide.node.next()
    }
    const operations = {
        pipes: () => {
            const { single, whole } = config.pipes
            const { result } = doGlide.data
            if (whole) return { isNeedPreArg: true, preReturn: result }
            if (!single) return { isNeedPreArg: false }
            const preReturn = result[result.length - 1]
            return { isNeedPreArg: true, preReturn }
        },
        forever: (error, callback) => {
            const { forever } = config
            if (forever) return callback()
            doGlide.out({ ...doGlide.data, error })
        },
        requestCallback: func => {
            const { requestCallback: { always, success, failed } } = config
            if (always || success) return func()
            if (always || failed) func()
        }
    }
    const noErrorAwait = async bar => {
        try {
            const { isNeedPreArg, preReturn } = operations.pipes()
            const { func, args, callback } = bar
            const msg = isNeedPreArg ? await func(preReturn, ...args) : await func(...args)
            operations.requestCallback(() => callback(msg))
            push({ flag: true, data: { msg } })
        } catch (error) {
            const { times } = doGlide
            const t = times - 1
            operations.requestCallback(() => tasks[t].callback(error))
            const funcName = tasks[t].func.name
            const data = { msg: error, funcName }
            const errorFunc = () => push({ flag: false, data: { msg: error, funcName } })
            operations.forever(data, errorFunc)
        }
    }
    const handler = out => {
        doGlide.out = out
        config.all ? meanwhile() : nested()
    }
    const nested = () => {
        doGlide.node = (function* () {
            while (doGlide.times < doGlide.len)
                yield noErrorAwait(tasks[doGlide.times++])
            doGlide.out(doGlide.data)
        })()
        doGlide.node.next()
    }
    const meanwhile = () => {
        const { data: dData } = doGlide
        const raceReq = (flag, data) => dData.result.push({ flag, data })
        const orderReq = (flag, data, i) => dData.result[i] = { flag, data }
        const isMeanwhile = () => dData.result.length === tasks.length ? doGlide.out(dData) : null
        const handerMean = callback => tasks.forEach(async (v, i) => {
            try {
                const msg = await v.func()
                callback(true, { msg }, i)
                isMeanwhile()
            } catch (error) {
                const funcName = v.func.name
                const e = { msg: error, funcName }
                operations.forever(e, () => {
                    const funcName = tasks[i].func.name
                    callback(false, { msg: error, funcName }, i)
                    isMeanwhile()
                })
            }
        })
        handerMean(config.all.order ? orderReq : raceReq)
    }
    const letsGo = new Promise(out => handler(out))
    if (!config.acc) return letsGo
    letsGo.then(v => config.acc(v))
}

export default combineAsyncError
