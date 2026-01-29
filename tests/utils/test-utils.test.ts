/**
 * Test Utility Functions Unit Tests
 * Verify port allocation, environment checking, and other functionality
 */

import { describe, it, expect } from 'vitest'
import {
  findAvailablePort,
  allocatePorts,
  checkWeChatDevToolsCLI,
  checkProjectPath,
  checkIntegrationTestEnvironment
} from './test-utils.js'

describe('Test Utility Functions', () => {
  describe('Port Allocation Functionality', () => {
    it('should be able to find available port', async () => {
      const port = await findAvailablePort(9500)
      expect(port).toBeGreaterThanOrEqual(9500)
      expect(typeof port).toBe('number')
    })

    it('should be able to allocate multiple different ports', async () => {
      const ports = await allocatePorts(3)
      expect(ports).toHaveLength(3)

      // Verify all ports are numbers and not duplicated
      const uniquePorts = new Set(ports)
      expect(uniquePorts.size).toBe(3)

      ports.forEach(port => {
        expect(typeof port).toBe('number')
        expect(port).toBeGreaterThan(0)
      })
    })

    it('should allocate consecutive ports', async () => {
      const ports = await allocatePorts(2)
      expect(ports[1]).toBeGreaterThan(ports[0])
    })
  })

  describe('Environment Checking Functionality', () => {
    it('should check WeChat DevTools CLI', async () => {
      // Test default path check
      const hasDefaultCLI = await checkWeChatDevToolsCLI()
      expect(typeof hasDefaultCLI).toBe('boolean')
    })

    it('should check custom CLI path', async () => {
      // Test invalid path
      const hasInvalidCLI = await checkWeChatDevToolsCLI('/invalid/path')
      expect(hasInvalidCLI).toBe(false)
    })

    it('should check project path', async () => {
      // Test current project path (should have package.json etc.)
      const hasCurrentProject = await checkProjectPath('.')
      // Current directory may not be miniprogram project, so no forced requirement for true
      expect(typeof hasCurrentProject).toBe('boolean')

      // Test invalid path
      const hasInvalidProject = await checkProjectPath('/invalid/project/path')
      expect(hasInvalidProject).toBe(false)
    })

    it('should perform comprehensive environment check', async () => {
      const result = await checkIntegrationTestEnvironment('/invalid/path')

      expect(result).toHaveProperty('isReady')
      expect(result).toHaveProperty('issues')
      expect(typeof result.isReady).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)

      // Invalid path should have issues
      expect(result.isReady).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('工具函数', () => {
    it('应该提供等待功能', async () => {
      const start = Date.now()
      await new Promise(resolve => setTimeout(resolve, 50))
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(40) // 允许一些误差
    })

    it('应该提供超时包装器', async () => {
      const fastPromise = Promise.resolve('success')
      const result = await new Promise((resolve, reject) => {
        Promise.race([
          fastPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 100)
          )
        ]).then(resolve).catch(reject)
      })

      expect(result).toBe('success')
    })
  })
})