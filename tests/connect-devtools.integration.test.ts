/**
 * connect_devtools 集成测试
 * 真实调用微信开发者工具，验证实际连接功能
 *
 * 运行方式：
 * RUN_INTEGRATION_TESTS=true npm test -- tests/connect-devtools.integration.test.ts
 */

import { describe, it, expect, afterEach } from 'vitest'
import { connectDevtools, takeScreenshot, type ConnectOptions } from '../src/tools.js'

// 环境检查：只有显式开启才运行集成测试
// const shouldRunIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true'
const shouldRunIntegrationTests = true

describe.skipIf(!shouldRunIntegrationTests)('connect_devtools 真实集成测试', () => {
  let connectedResources: any = null

  afterEach(async () => {
    // 确保每次测试后都清理资源
    if (connectedResources?.miniProgram) {
      try {
        console.log('正在清理微信开发者工具连接...')
        await connectedResources.miniProgram.close()
        console.log('连接已成功关闭')
      } catch (error) {
        console.warn('清理资源时出错:', error)
      } finally {
        connectedResources = null
      }
    }
  })

  describe('真实连接功能测试', () => {
    it('应该能真实连接到微信开发者工具', async () => {
      console.log('开始连接微信开发者工具...')

      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
        port: 9421  // 使用不同端口避免冲突
      }

      const result = await connectDevtools(options)
      connectedResources = result

      console.log('连接成功，页面路径:', result.pagePath)

      // 验证连接结果
      expect(result.miniProgram).toBeDefined()
      expect(result.currentPage).toBeDefined()
      expect(result.pagePath).toBeTruthy()
      expect(typeof result.pagePath).toBe('string')

      // 验证MiniProgram对象的真实性
      expect(typeof result.miniProgram.currentPage).toBe('function')
      expect(typeof result.miniProgram.screenshot).toBe('function')
    }, 30000) // 30秒超时

    it('应该能获取真实的页面信息', async () => {
      console.log('测试页面信息获取...')

      const result = await connectDevtools({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        port: 9422  // 使用不同端口避免冲突
      })
      connectedResources = result

      // 验证页面对象的真实属性
      expect(result.currentPage).toBeDefined()
      expect(result.currentPage.path).toBeTruthy()
      expect(typeof result.currentPage.path).toBe('string')

      console.log('当前页面路径:', result.currentPage.path)

      // 验证页面对象具有真实的方法
      expect(typeof result.currentPage.$).toBe('function')
      expect(typeof result.currentPage.$$).toBe('function')
    }, 30000)

    it('应该能执行真实的截图功能', async () => {
      console.log('测试截图功能...')

      const result = await connectDevtools({
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        port: 9423  // 使用不同端口避免冲突
      })
      connectedResources = result

      console.log('连接成功，等待页面稳定...')

      // 等待页面完全加载和渲染
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 确保当前页面可用
      const currentPage = await result.miniProgram.currentPage()
      expect(currentPage).toBeDefined()
      console.log('当前页面确认:', currentPage.path)

      // 使用专门的 takeScreenshot 函数（内置重试机制）
      console.log('开始截图...')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const screenshotPath = `/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/screenshot-${timestamp}.png`

      try {
        await takeScreenshot(result.miniProgram, { path: screenshotPath })

        // 验证截图文件是否保存成功
        const fs = await import('fs')
        expect(fs.existsSync(screenshotPath)).toBe(true)

        // 检查文件大小（截图文件应该有合理的大小）
        const stats = fs.statSync(screenshotPath)
        expect(stats.size).toBeGreaterThan(1000) // 截图文件应该大于1KB

        console.log('截图成功保存到:', screenshotPath, '文件大小:', stats.size, 'bytes')
      } catch (error) {
        console.error('截图失败:', error)
        // 即使截图失败，我们也记录错误信息，但不让测试完全失败
        // 这样可以看到其他功能是否正常
        console.log('注意：截图功能当前不可用，可能是微信开发者工具安全设置问题')
        expect.soft(false).toBe(true) // 软失败，不会停止测试
      }
    }, 45000)
  })

  describe('真实错误处理测试', () => {
    it('应该正确处理无效项目路径', async () => {
      const options: ConnectOptions = {
        projectPath: '/invalid/project/path'
      }

      await expect(connectDevtools(options))
        .rejects.toThrow(/连接微信开发者工具失败/)
    }, 30000)

    it('应该正确处理无效CLI路径', async () => {
      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        cliPath: '/invalid/cli/path'
      }

      await expect(connectDevtools(options))
        .rejects.toThrow(/连接微信开发者工具失败/)
    }, 30000)
  })

  describe('真实参数传递测试', () => {
    it('应该能使用自定义端口', async () => {
      console.log('测试自定义端口连接...')

      const options: ConnectOptions = {
        projectPath: '/Users/didi/workspace/wooPro/weixin-devtools-mcp/playground/wx',
        port: 9424  // 使用不同端口避免冲突
      }

      const result = await connectDevtools(options)
      connectedResources = result

      expect(result.miniProgram).toBeDefined()
      expect(result.currentPage).toBeDefined()

      console.log('自定义端口连接成功')
    }, 30000)
  })
})

// 如果未启用集成测试，显示提示信息
if (!shouldRunIntegrationTests) {
  describe('集成测试提示', () => {
    it('显示如何运行集成测试', () => {
      console.log(`
🔧 集成测试未启用

要运行真实的微信开发者工具集成测试，请使用：
RUN_INTEGRATION_TESTS=true npm test -- tests/connect-devtools.integration.test.ts

或者运行所有集成测试：
RUN_INTEGRATION_TESTS=true npm run test:integration

注意：集成测试需要：
1. 微信开发者工具已安装
2. CLI权限已开启
3. @playground/wx 项目可用
      `)
    })
  })
}
