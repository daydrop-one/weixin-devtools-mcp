/**
 * connect_devtools 工具测试
 * 测试微信开发者工具连接功能的各种场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock miniprogram-automator 模块
vi.mock('miniprogram-automator', () => ({
  default: {
    launch: vi.fn()
  }
}))

// Mock 异步延迟函数
vi.mock('util', () => ({
  promisify: (fn: any) => {
    if (fn.name === 'setTimeout') {
      return async (ms: number) => {
        return new Promise(resolve => setTimeout(resolve, ms))
      }
    }
    return fn
  }
}))

// Mock tools.js 中的连接函数
vi.mock('../src/tools.js', async () => {
  const actual = await vi.importActual('../src/tools.js') as any;
  return {
    connectDevtools: actual.connectDevtools, // 使用真实实现
    waitForWebSocketReady: actual.waitForWebSocketReady, // 使用真实实现
    checkDevToolsRunning: actual.checkDevToolsRunning,   // 使用真实实现，通过mock fetch控制行为
    DevToolsConnectionError: actual.DevToolsConnectionError
  };
})

// 导入被测试的模块和原始对象
import { connectDevtools, waitForWebSocketReady, checkDevToolsRunning, type ConnectOptions } from '../src/tools.js'
import automator from 'miniprogram-automator'

describe('connect_devtools 工具测试', () => {
  // 创建测试用的页面对象（匹配真实项目结构）
  const testCurrentPage = {
    path: '/pages/home/index'
  }

  // 创建测试用的MiniProgram对象
  const testMiniProgram = {
    currentPage: vi.fn(),
    screenshot: vi.fn(),
    mockWxMethod: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined)
  } as any

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks()

    // 设置默认的成功场景
    vi.mocked(automator.launch).mockResolvedValue(testMiniProgram)
    testMiniProgram.currentPage.mockResolvedValue(testCurrentPage)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('参数验证测试', () => {
    it('应该要求 projectPath 参数', async () => {
      const options = {} as ConnectOptions

      await expect(connectDevtools(options))
        .rejects.toThrow('项目路径是必需的')
    })

    it('应该接受有效的 projectPath', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      }

      const result = await connectDevtools(options)

      expect(result.pagePath).toBe('/pages/home/index')
      expect(result.miniProgram).toBe(testMiniProgram)
      expect(result.currentPage).toBe(testCurrentPage)
    })

    it('应该接受可选的 cliPath 参数', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/custom/cli/path'
      }

      await connectDevtools(options)

      expect(vi.mocked(automator.launch)).toHaveBeenCalledWith({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/custom/cli/path'
      })
    })

    it('应该接受可选的 port 参数', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        port: 9420
      }

      await connectDevtools(options)

      expect(vi.mocked(automator.launch)).toHaveBeenCalledWith({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        port: 9420
      })
    })
  })

  describe('连接功能测试', () => {
    it('应该成功连接微信开发者工具', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      }

      const result = await connectDevtools(options)

      // 验证 automator.launch 被正确调用
      expect(vi.mocked(automator.launch)).toHaveBeenCalledWith({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      })
      expect(vi.mocked(automator.launch)).toHaveBeenCalledTimes(1)

      // 验证 currentPage 被调用
      expect(testMiniProgram.currentPage).toHaveBeenCalledTimes(1)

      // 验证返回结果
      expect(result.miniProgram).toBe(testMiniProgram)
      expect(result.currentPage).toBe(testCurrentPage)
      expect(result.pagePath).toBe('/pages/home/index')
    })

    it('应该处理 automator.launch 失败', async () => {
      const options: ConnectOptions = {
        projectPath: '/tmp'  // 使用存在的路径，让 mock 失败而不是路径验证失败
      }
      const errorMessage = '项目不存在'

      vi.mocked(automator.launch).mockRejectedValue(new Error(errorMessage))

      await expect(connectDevtools(options))
        .rejects.toThrow(`连接微信开发者工具失败: ${errorMessage}`)
    })

    it('应该处理 currentPage 获取失败', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      }

      vi.mocked(automator.launch).mockResolvedValue(testMiniProgram)
      testMiniProgram.currentPage.mockRejectedValue(new Error('无法获取当前页面'))

      await expect(connectDevtools(options))
        .rejects.toThrow('连接微信开发者工具失败: 无法获取当前页面')
    })
  })

  describe('选项参数测试', () => {
    it('应该传递所有提供的选项给 automator.launch', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/custom/cli',
        port: 9421
      }

      await connectDevtools(options)

      expect(vi.mocked(automator.launch)).toHaveBeenCalledWith({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/custom/cli',
        port: 9421
      })
    })

    it('应该只传递提供的选项', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
        // 没有 cliPath 和 port
      }

      await connectDevtools(options)

      expect(vi.mocked(automator.launch)).toHaveBeenCalledWith({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      })
    })
  })

  describe('错误处理测试', () => {
    it('应该处理空字符串 projectPath', async () => {
      const options: ConnectOptions = {
        projectPath: ''
      }

      await expect(connectDevtools(options))
        .rejects.toThrow('项目路径是必需的')
    })

    it('应该包装原始错误信息', async () => {
      const options: ConnectOptions = {
        projectPath: '/tmp'  // 使用存在的路径
      }
      const originalError = new Error('找不到项目配置文件')

      vi.mocked(automator.launch).mockRejectedValue(originalError)

      await expect(connectDevtools(options))
        .rejects.toThrow('连接微信开发者工具失败: 找不到项目配置文件')
    })

    it('应该处理非Error类型的异常', async () => {
      const options: ConnectOptions = {
        projectPath: '/tmp'  // 使用存在的路径
      }

      vi.mocked(automator.launch).mockRejectedValue('字符串错误')

      await expect(connectDevtools(options))
        .rejects.toThrow('连接微信开发者工具失败: 字符串错误')
    })
  })

  describe('返回值结构测试', () => {
    it('应该返回包含所有必需字段的结果对象', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      }

      const result = await connectDevtools(options)

      expect(result).toHaveProperty('miniProgram')
      expect(result).toHaveProperty('currentPage')
      expect(result).toHaveProperty('pagePath')
      expect(typeof result.pagePath).toBe('string')
    })

    it('应该返回正确的页面路径', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx'
      }

      const customPagePath = '/pages/custom/custom'
      const customPage = { path: customPagePath }
      testMiniProgram.currentPage.mockResolvedValue(customPage)

      const result = await connectDevtools(options)

      expect(result.pagePath).toBe(customPagePath)
    })
  })
})

/**
 * waitForWebSocketReady 单元测试
 * 测试 WebSocket 服务就绪等待逻辑
 */
describe('waitForWebSocketReady 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('应该在超时后抛出正确的错误消息', async () => {
    // Mock fetch 拒绝连接，模拟服务未启动
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const port = 9420
    const timeout = 2000 // 短超时便于测试
    const verbose = false

    const startTime = Date.now()

    await expect(waitForWebSocketReady(port, timeout, verbose))
      .rejects
      .toThrow(/WebSocket服务启动超时，端口: 9420，已等待: \d+ms/)

    const elapsed = Date.now() - startTime

    // 验证等待时间接近超时时间
    expect(elapsed).toBeGreaterThanOrEqual(timeout)
    expect(elapsed).toBeLessThan(timeout + 1500) // 允许1.5秒误差
  })

  it('应该在服务立即可用时快速返回', async () => {
    // Mock fetch 成功响应，模拟服务已启动
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)

    const port = 9420
    const timeout = 5000
    const verbose = false

    const startTime = Date.now()

    await waitForWebSocketReady(port, timeout, verbose)

    const elapsed = Date.now() - startTime

    // 应该几乎立即返回
    expect(elapsed).toBeLessThan(1000)
  })

  it('应该在延迟后成功检测到服务', async () => {
    let callCount = 0

    // 前5次调用失败,第6次成功
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount > 5) {
        return { ok: true } as Response
      }
      throw new Error('Connection refused')
    })

    const port = 9420
    const timeout = 10000
    const verbose = false

    const startTime = Date.now()

    await waitForWebSocketReady(port, timeout, verbose)

    const elapsed = Date.now() - startTime

    // 应该在约 2.5-3 秒内返回 (前5次失败,每次等待500ms)
    expect(elapsed).toBeGreaterThanOrEqual(2000)
    expect(elapsed).toBeLessThan(4000)
  })

  it('应该在verbose模式下输出详细日志', async () => {
    // Mock console.log 来捕获日志输出
    const consoleLogSpy = vi.spyOn(console, 'log')

    // Mock fetch 成功响应，模拟服务已启动
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)

    const port = 9420
    const timeout = 5000
    const verbose = true

    await waitForWebSocketReady(port, timeout, verbose)

    // 验证输出了启动日志
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('等待WebSocket服务启动')
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('端口: 9420')
    )

    // 验证输出了成功日志
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket服务已启动')
    )

    consoleLogSpy.mockRestore()
  })

  it('应该验证错误消息包含端口和经过时间', async () => {
    // Mock fetch 拒绝连接，模拟服务未启动
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const port = 9440
    const timeout = 1500
    const verbose = false

    try {
      await waitForWebSocketReady(port, timeout, verbose)
      // 不应该到这里
      expect(false).toBe(true)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const errorMessage = (error as Error).message

      // 验证错误消息格式
      expect(errorMessage).toContain('WebSocket服务启动超时')
      expect(errorMessage).toContain(`端口: ${port}`)
      expect(errorMessage).toMatch(/已等待: \d+ms/)

      // 验证端口号正确
      expect(errorMessage).toContain('9440')

      // 提取经过时间并验证
      const match = errorMessage.match(/已等待: (\d+)ms/)
      expect(match).not.toBeNull()
      if (match) {
        const elapsed = parseInt(match[1], 10)
        expect(elapsed).toBeGreaterThanOrEqual(timeout)
        expect(elapsed).toBeLessThan(timeout + 1500)
      }
    }
  })

  it('应该验证渐进式重试逻辑', async () => {
    let callCount = 0
    const callTimestamps: number[] = []

    // 记录每次调用的时间戳
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      callTimestamps.push(Date.now())
      // 让测试在第15次调用时成功
      if (callCount >= 15) {
        return { ok: true } as Response
      }
      throw new Error('Connection refused')
    })

    const port = 9420
    const timeout = 20000
    const verbose = false

    await waitForWebSocketReady(port, timeout, verbose)

    // 验证至少调用了15次
    expect(callCount).toBeGreaterThanOrEqual(15)

    // 验证前10次的间隔约为500ms
    for (let i = 1; i < Math.min(10, callTimestamps.length); i++) {
      const interval = callTimestamps[i] - callTimestamps[i - 1]
      // 前10次应该约为500ms间隔
      expect(interval).toBeGreaterThanOrEqual(400)
      expect(interval).toBeLessThan(700)
    }

    // 验证第10次之后的间隔约为1000ms
    if (callTimestamps.length > 11) {
      for (let i = 11; i < callTimestamps.length; i++) {
        const interval = callTimestamps[i] - callTimestamps[i - 1]
        // 第10次之后应该约为1000ms间隔
        expect(interval).toBeGreaterThanOrEqual(900)
        expect(interval).toBeLessThan(1300)
      }
    }
  }, 30000) // 增加测试超时时间
})

/**
 * Mock 验证测试
 * 验证我们的mock设置是否正确工作
 */
describe('Mock 验证测试', () => {
  it('应该正确模拟 miniprogram-automator', () => {
    expect(automator.launch).toBeDefined()
    expect(vi.isMockFunction(automator.launch)).toBe(true)
  })

  it('应该正确创建 MiniProgram 模拟对象', () => {
    const miniProgram = {
      currentPage: vi.fn(),
      screenshot: vi.fn()
    } as any

    expect(miniProgram.currentPage).toBeDefined()
    expect(vi.isMockFunction(miniProgram.currentPage)).toBe(true)
  })

  it('应该正确重置mock状态', () => {
    vi.mocked(automator.launch).mockResolvedValue('test' as any)
    expect(automator.launch).toHaveBeenCalledTimes(0)

    vi.clearAllMocks()
    expect(automator.launch).toHaveBeenCalledTimes(0)
  })
})
