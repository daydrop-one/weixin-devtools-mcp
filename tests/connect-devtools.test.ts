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

// 导入被测试的模块和原始对象
import { connectDevtools, type ConnectOptions } from '../src/tools.js'
import automator from 'miniprogram-automator'

describe('connect_devtools 工具测试', () => {
  // 创建测试用的页面对象（匹配真实项目结构）
  const testCurrentPage = {
    path: '/pages/home/index'
  }

  // 创建测试用的MiniProgram对象
  const testMiniProgram = {
    currentPage: vi.fn(),
    screenshot: vi.fn()
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
        projectPath: '/path/to/invalid/project'
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
        projectPath: '/invalid/path'
      }
      const originalError = new Error('找不到项目配置文件')

      vi.mocked(automator.launch).mockRejectedValue(originalError)

      await expect(connectDevtools(options))
        .rejects.toThrow('连接微信开发者工具失败: 找不到项目配置文件')
    })

    it('应该处理非Error类型的异常', async () => {
      const options: ConnectOptions = {
        projectPath: '/invalid/path'
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
