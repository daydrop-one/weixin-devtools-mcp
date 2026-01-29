/**
 * connection.ts Tool Tests
 * Test MCP tool layer connection management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock connection functions in tools.ts
vi.mock('../../src/tools.js', () => ({
  connectDevtools: vi.fn(),
  connectDevtoolsEnhanced: vi.fn(),
  DevToolsConnectionError: class DevToolsConnectionError extends Error {
    constructor(
      message: string,
      public phase: 'startup' | 'connection' | 'health_check',
      public originalError?: Error,
      public details?: Record<string, any>
    ) {
      super(message)
      this.name = 'DevToolsConnectionError'
    }
  }
}))

// Import tools being tested
import {
  connectDevtoolsTool,
  connectDevtoolsEnhancedTool,
  getCurrentPageTool
} from '../../src/tools/connection.js'

// Import mock functions for verification
import {
  connectDevtools,
  connectDevtoolsEnhanced,
  DevToolsConnectionError
} from '../../src/tools.js'

describe('connection.ts Tool Tests', () => {
  // Create mock page object for testing
  const mockCurrentPage = {
    path: '/pages/home/index'
  }

  // Create mock MiniProgram object for testing
  const mockMiniProgram = {
    currentPage: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    evaluate: vi.fn()
  }

  // Create mock context object for testing
  const mockContext = {
    miniProgram: null as any,
    currentPage: null as any,
    elementMap: new Map(),
    consoleStorage: {
      isMonitoring: false,
      startTime: '',
      consoleMessages: [] as any[],
      exceptionMessages: [] as any[]
    },
    networkStorage: {
      isMonitoring: false,
      startTime: '',
      networkRequests: [] as any[]
    }
  } as any

  // Create mock request and response objects for testing
  const createMockRequest = (params: any) => ({ params })
  const createMockResponse = () => {
    const lines: string[] = []
    return {
      appendResponseLine: vi.fn((line: string) => lines.push(line)),
      setIncludeSnapshot: vi.fn(),
      getLines: () => lines
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMiniProgram.currentPage.mockResolvedValue(mockCurrentPage)
    mockMiniProgram.evaluate.mockResolvedValue(undefined)
    mockContext.miniProgram = null
    mockContext.currentPage = null
    mockContext.elementMap.clear()
    mockContext.consoleStorage = {
      isMonitoring: false,
      startTime: '',
      consoleMessages: [],
      exceptionMessages: []
    }
    mockContext.networkStorage = {
      isMonitoring: false,
      startTime: '',
      networkRequests: []
    }
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('connectDevtoolsTool - Traditional connection tool', () => {
    it('should successfully connect to WeChat DevTools', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(connectDevtools).toHaveBeenCalledWith({
        projectPath: '/path/to/project'
      })

      expect(mockContext.miniProgram).toBe(mockMiniProgram)
      expect(mockContext.currentPage).toBe(mockCurrentPage)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Successfully connected to WeChat DevTools (Traditional mode)')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Project path: /path/to/project')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Current page: /pages/home/index')
    })

    it('should support optional cliPath and port parameters', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        cliPath: '/custom/cli/path',
        port: 9420
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(connectDevtools).toHaveBeenCalledWith({
        projectPath: '/path/to/project',
        cliPath: '/custom/cli/path',
        port: 9420
      })
    })

    it('should pass autoAudits parameter', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        autoAudits: true
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(connectDevtools).toHaveBeenCalledWith({
        projectPath: '/path/to/project',
        autoAudits: true
      })
    })

    it('should reuse existing active connection', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      // Set existing connection
      mockContext.miniProgram = mockMiniProgram
      mockContext.currentPage = mockCurrentPage

      await connectDevtoolsTool.handler(request, response, mockContext)

      // Should not call connectDevtools
      expect(connectDevtools).not.toHaveBeenCalled()

      // Should output message about reusing connection
      expect(response.appendResponseLine).toHaveBeenCalledWith('✅ Detected existing active connection, reusing current connection')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Project path: /path/to/project')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Current page: /pages/home/index')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Note: Skip reconnection, use established connection')
    })

    it('should reconnect when connection is invalid', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      // Set existing connection, but currentPage will fail
      mockContext.miniProgram = mockMiniProgram
      mockMiniProgram.currentPage.mockRejectedValueOnce(new Error('Connection expired'))

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      // Should reconnect
      expect(connectDevtools).toHaveBeenCalled()
      expect(mockContext.miniProgram).toBe(mockMiniProgram)
      expect(mockContext.currentPage).toBe(mockCurrentPage)
    })

    it('should automatically start console monitoring', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(mockMiniProgram.removeAllListeners).toHaveBeenCalledWith('console')
      expect(mockMiniProgram.removeAllListeners).toHaveBeenCalledWith('exception')
      expect(mockMiniProgram.on).toHaveBeenCalledWith('console', expect.any(Function))
      expect(mockMiniProgram.on).toHaveBeenCalledWith('exception', expect.any(Function))
      expect(mockContext.consoleStorage.isMonitoring).toBe(true)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Console monitoring has been automatically started')
    })

    it('should automatically start network monitoring', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(mockMiniProgram.evaluate).toHaveBeenCalled()
      expect(mockContext.networkStorage.isMonitoring).toBe(true)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Network monitoring has been automatically started (Enhanced interception)')
    })

    it('should handle connection failure', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      vi.mocked(connectDevtools).mockRejectedValue(new Error('Connection failed'))

      await expect(connectDevtoolsTool.handler(request, response, mockContext))
        .rejects.toThrow('Connection failed')

      expect(response.appendResponseLine).toHaveBeenCalledWith('Connection failed: Connection failed')
    })
  })

  describe('connectDevtoolsEnhancedTool - Enhanced connection tool', () => {
    it('should successfully intelligently connect to WeChat DevTools', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto',
        verbose: true,
        healthCheck: true
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index',
        connectionMode: 'launch' as const,
        startupTime: 1234,
        healthStatus: 'healthy' as const
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      expect(connectDevtoolsEnhanced).toHaveBeenCalledWith({
        projectPath: '/path/to/project',
        mode: 'auto',
        cliPath: undefined,
        autoPort: undefined,
        autoAccount: undefined,
        timeout: undefined,
        fallbackMode: undefined,
        healthCheck: true,
        verbose: true,
        autoAudits: undefined
      })

      expect(mockContext.miniProgram).toBe(mockMiniProgram)
      expect(mockContext.currentPage).toBe(mockCurrentPage)
      expect(response.appendResponseLine).toHaveBeenCalledWith('✅ Smart connection successful')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Project path: /path/to/project')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Current page: /pages/home/index')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Connection mode: launch')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Startup time: 1234ms')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Health status: healthy')
    })

    it('should support all enhanced parameters', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'connect',
        cliPath: '/custom/cli',
        autoPort: 9440,
        autoAccount: 'test-account',
        timeout: 30000,
        fallbackMode: false,
        healthCheck: false,
        verbose: true
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index',
        connectionMode: 'connect' as const,
        startupTime: 2345,
        healthStatus: 'healthy' as const,
        processInfo: {
          pid: 12345,
          port: 9440
        }
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      expect(connectDevtoolsEnhanced).toHaveBeenCalledWith({
        projectPath: '/path/to/project',
        mode: 'connect',
        cliPath: '/custom/cli',
        autoPort: 9440,
        autoAccount: 'test-account',
        timeout: 30000,
        fallbackMode: false,
        healthCheck: false,
        verbose: true,
        autoAudits: undefined
      })

      expect(response.appendResponseLine).toHaveBeenCalledWith('Process info: PID=12345, Port=9440')
    })

    it('should pass autoAudits parameter to enhanced connection', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'launch',
        autoAudits: true
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index',
        connectionMode: 'launch' as const,
        startupTime: 1000,
        healthStatus: 'healthy' as const
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      expect(connectDevtoolsEnhanced).toHaveBeenCalledWith({
        projectPath: '/path/to/project',
        mode: 'launch',
        cliPath: undefined,
        autoPort: undefined,
        autoAccount: undefined,
        timeout: undefined,
        fallbackMode: undefined,
        healthCheck: undefined,
        verbose: undefined,
        autoAudits: true
      })
    })

    it('should reuse existing active connection', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto',
        verbose: true
      })
      const response = createMockResponse()

      // Set existing connection
      mockContext.miniProgram = mockMiniProgram
      mockContext.currentPage = mockCurrentPage

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      // Should not call connectDevtoolsEnhanced
      expect(connectDevtoolsEnhanced).not.toHaveBeenCalled()

      // Should output message about reusing connection
      expect(response.appendResponseLine).toHaveBeenCalledWith('✅ Detected existing active connection, reusing current connection')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Project path: /path/to/project')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Current page: /pages/home/index')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Note: Skip reconnection, use established connection')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Tip: To force reconnection, please close WeChat DevTools first')
    })

    it('should output connection failure notice in verbose mode', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto',
        verbose: true
      })
      const response = createMockResponse()

      // Set existing connection, but currentPage will fail
      mockContext.miniProgram = mockMiniProgram
      mockMiniProgram.currentPage.mockRejectedValueOnce(new Error('Connection expired'))

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index',
        connectionMode: 'launch' as const,
        startupTime: 1234,
        healthStatus: 'healthy' as const
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      // Should output expiration notice
      expect(response.appendResponseLine).toHaveBeenCalledWith('Detected existing connection but it has expired, preparing to reconnect...')

      // Should reconnect
      expect(connectDevtoolsEnhanced).toHaveBeenCalled()
    })

    it('should correctly format WebSocket timeout error', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'connect',
        autoPort: 9420,
        timeout: 5000,
        verbose: true
      })
      const response = createMockResponse()

      const error = new DevToolsConnectionError(
        'WebSocket service startup timeout, port: 9420, waited: 5209ms',
        'startup',
        new Error('WebSocket service startup timeout, port: 9420, waited: 5209ms'),
        { timestamp: new Date().toISOString() }
      )

      vi.mocked(connectDevtoolsEnhanced).mockRejectedValue(error)

      await expect(connectDevtoolsEnhancedTool.handler(request, response, mockContext))
        .rejects.toThrow()

      // Verify error message format
      expect(response.appendResponseLine).toHaveBeenCalledWith('❗ startup phase failed: WebSocket service startup timeout, port: 9420, waited: 5209ms')
      expect(response.appendResponseLine).toHaveBeenCalledWith('Original error: WebSocket service startup timeout, port: 9420, waited: 5209ms')
      expect(response.appendResponseLine).toHaveBeenCalledWith(expect.stringContaining('Details:'))
    })

    it('should handle generic errors', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto'
      })
      const response = createMockResponse()

      vi.mocked(connectDevtoolsEnhanced).mockRejectedValue(new Error('Connection failed'))

      await expect(connectDevtoolsEnhancedTool.handler(request, response, mockContext))
        .rejects.toThrow('Connection failed')

      expect(response.appendResponseLine).toHaveBeenCalledWith('Connection failed: Connection failed')
    })

    it('should automatically start console and network monitoring', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index',
        connectionMode: 'launch' as const,
        startupTime: 1234,
        healthStatus: 'healthy' as const
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      // Verify console monitoring
      expect(mockMiniProgram.removeAllListeners).toHaveBeenCalledWith('console')
      expect(mockMiniProgram.removeAllListeners).toHaveBeenCalledWith('exception')
      expect(mockMiniProgram.on).toHaveBeenCalledWith('console', expect.any(Function))
      expect(mockMiniProgram.on).toHaveBeenCalledWith('exception', expect.any(Function))
      expect(mockContext.consoleStorage.isMonitoring).toBe(true)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Console monitoring has been automatically started')

      // Verify network monitoring
      expect(mockMiniProgram.evaluate).toHaveBeenCalled()
      expect(mockContext.networkStorage.isMonitoring).toBe(true)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Network monitoring has been automatically started (Enhanced interception)')
    })
  })

  describe('getCurrentPageTool - Get current page', () => {
    it('should successfully get current page information', async () => {
      const request = createMockRequest({})
      const response = createMockResponse()

      mockContext.miniProgram = mockMiniProgram

      await getCurrentPageTool.handler(request, response, mockContext)

      expect(mockMiniProgram.currentPage).toHaveBeenCalled()
      expect(mockContext.currentPage).toBe(mockCurrentPage)
      expect(response.appendResponseLine).toHaveBeenCalledWith('Current page: /pages/home/index')
    })

    it('should require connection to DevTools first', async () => {
      const request = createMockRequest({})
      const response = createMockResponse()

      await expect(getCurrentPageTool.handler(request, response, mockContext))
        .rejects.toThrow('Please connect to WeChat DevTools first')
    })

    it('should handle page retrieval failure', async () => {
      const request = createMockRequest({})
      const response = createMockResponse()

      mockContext.miniProgram = mockMiniProgram
      mockMiniProgram.currentPage.mockRejectedValue(new Error('Retrieval failed'))

      await expect(getCurrentPageTool.handler(request, response, mockContext))
        .rejects.toThrow('Retrieval failed')

      expect(response.appendResponseLine).toHaveBeenCalledWith('Failed to get current page: Retrieval failed')
    })
  })

  describe('Error handling tests', () => {
    it('should handle console monitoring startup failure', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)
      mockMiniProgram.on.mockImplementation(() => {
        throw new Error('Listener startup failed')
      })

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(response.appendResponseLine).toHaveBeenCalledWith('Warning: Console monitoring startup failed - Listener startup failed')
    })

    it('should handle network monitoring startup failure', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)
      mockMiniProgram.evaluate.mockRejectedValue(new Error('Injection failed'))

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(response.appendResponseLine).toHaveBeenCalledWith('Warning: Network monitoring startup failed - Injection failed')
    })
  })

  describe('Context state management tests', () => {
    it('should clear elementMap on new connection', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project'
      })
      const response = createMockResponse()

      const connectResult = {
        miniProgram: mockMiniProgram,
        currentPage: mockCurrentPage,
        pagePath: '/pages/home/index'
      }

      // Set some old element mappings
      mockContext.elementMap.set('old-uid', 'old-selector')

      vi.mocked(connectDevtools).mockResolvedValue(connectResult)

      await connectDevtoolsTool.handler(request, response, mockContext)

      expect(mockContext.elementMap.size).toBe(0)
    })

    it('should correctly update context state', async () => {
      const request = createMockRequest({
        projectPath: '/path/to/project',
        mode: 'auto'
      })
      const response = createMockResponse()

      const newMiniProgram = { ...mockMiniProgram }
      const newPage = { path: '/pages/new/new' }

      const connectResult = {
        miniProgram: newMiniProgram,
        currentPage: newPage,
        pagePath: '/pages/new/new',
        connectionMode: 'launch' as const,
        startupTime: 1234,
        healthStatus: 'healthy' as const
      }

      vi.mocked(connectDevtoolsEnhanced).mockResolvedValue(connectResult)

      await connectDevtoolsEnhancedTool.handler(request, response, mockContext)

      expect(mockContext.miniProgram).toBe(newMiniProgram)
      expect(mockContext.currentPage).toBe(newPage)
    })
  })
})
