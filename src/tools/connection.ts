/**
 * Connection Management Tools
 * Handles connection and disconnection to WeChat DevTools
 */

import { z } from 'zod';
import { defineTool, ToolCategories, ConsoleMessage, ExceptionMessage } from './ToolDefinition.js';
import { connectDevtools, connectDevtoolsEnhanced, type ConnectOptions, type EnhancedConnectOptions, DevToolsConnectionError } from '../tools.js';

/**
 * Create request interceptor function
 * Copied from network.ts for auto-starting network monitoring
 */
function createRequestInterceptor() {
  return function(this: any, options: any) {
    // @ts-ignore - wx is available in WeChat miniprogram environment
    const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;

    if (!wxObj) {
      return this.origin(options);
    }

    if (!wxObj.__networkLogs) {
      wxObj.__networkLogs = [];
    }

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();

    const originalSuccess = options.success;
    options.success = function(res: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'request',
        url: options.url,
        method: options.method || 'GET',
        headers: options.header,
        data: options.data,
        statusCode: res.statusCode,
        response: res.data,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: true
      });
      if (originalSuccess) originalSuccess(res);
    };

    const originalFail = options.fail;
    options.fail = function(err: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'request',
        url: options.url,
        method: options.method || 'GET',
        headers: options.header,
        data: options.data,
        error: err.errMsg || String(err),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: false
      });
      if (originalFail) originalFail(err);
    };

    return this.origin(options);
  };
}

/**
 * Create uploadFile interceptor function
 */
function createUploadFileInterceptor() {
  return function(this: any, options: any) {
    // @ts-ignore - wx is available in WeChat miniprogram environment
    const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;

    if (!wxObj) {
      return this.origin(options);
    }

    if (!wxObj.__networkLogs) {
      wxObj.__networkLogs = [];
    }

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();

    const originalSuccess = options.success;
    options.success = function(res: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'uploadFile',
        url: options.url,
        headers: options.header,
        data: {
          filePath: options.filePath,
          name: options.name,
          formData: options.formData
        },
        statusCode: res.statusCode,
        response: res.data,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: true
      });
      if (originalSuccess) originalSuccess(res);
    };

    const originalFail = options.fail;
    options.fail = function(err: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'uploadFile',
        url: options.url,
        headers: options.header,
        data: {
          filePath: options.filePath,
          name: options.name,
          formData: options.formData
        },
        error: err.errMsg || String(err),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: false
      });
      if (originalFail) originalFail(err);
    };

    return this.origin(options);
  };
}

/**
 * Create downloadFile interceptor function
 */
function createDownloadFileInterceptor() {
  return function(this: any, options: any) {
    // @ts-ignore - wx is available in WeChat miniprogram environment
    const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;

    if (!wxObj) {
      return this.origin(options);
    }

    if (!wxObj.__networkLogs) {
      wxObj.__networkLogs = [];
    }

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();

    const originalSuccess = options.success;
    options.success = function(res: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'downloadFile',
        url: options.url,
        headers: options.header,
        statusCode: res.statusCode,
        response: {
          tempFilePath: res.tempFilePath,
          filePath: res.filePath
        },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: true
      });
      if (originalSuccess) originalSuccess(res);
    };

    const originalFail = options.fail;
    options.fail = function(err: any) {
      wxObj.__networkLogs.push({
        id: requestId,
        type: 'downloadFile',
        url: options.url,
        headers: options.header,
        error: err.errMsg || String(err),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: false
      });
      if (originalFail) originalFail(err);
    };

    return this.origin(options);
  };
}

/**
 * Connect to WeChat DevTools (Traditional Version)
 */
export const connectDevtoolsTool = defineTool({
  name: 'connect_devtools',
  description: 'Connect to WeChat DevTools (traditional mode, for compatibility)',
  schema: z.object({
    projectPath: z.string().describe('Absolute path to the mini program project'),
    cliPath: z.string().optional().describe('Absolute path to WeChat DevTools CLI (optional, will auto-detect by default)'),
    port: z.number().optional().describe('WebSocket port number (optional, auto-assigned by default)'),
    autoAudits: z.boolean().optional().describe('Whether to enable automatic experience scoring on startup'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { projectPath, cliPath, port, autoAudits } = request.params;

    // Check if there's an active connection
    if (context.miniProgram) {
      try {
        // Verify if connection is still valid
        const currentPage = await context.miniProgram.currentPage();
        const pagePath = await currentPage.path;

        // Connection is valid, reuse existing connection
        response.appendResponseLine(`✅ Active connection detected, reusing existing connection`);
        response.appendResponseLine(`Project path: ${projectPath}`);
        response.appendResponseLine(`Current page: ${pagePath}`);
        response.appendResponseLine(`Note: Skipping reconnection, using established connection`);

        return;
      } catch (error) {
        // Connection is invalid, clear and continue with new connection
        context.miniProgram = null;
        context.currentPage = null;
      }
    }

    try {
      const options: ConnectOptions = { projectPath };
      if (cliPath) options.cliPath = cliPath;
      if (port) options.port = port;
      if (typeof autoAudits === 'boolean') {
        options.autoAudits = autoAudits;
      }

      const result = await connectDevtools(options);

      // Update context
      context.miniProgram = result.miniProgram;
      context.currentPage = result.currentPage;
      context.elementMap.clear();

      // Auto-start console monitoring
      try {
        // Clear previous listeners (if any)
        context.miniProgram.removeAllListeners('console');
        context.miniProgram.removeAllListeners('exception');

        // Start console monitoring
        context.consoleStorage.isMonitoring = true;
        context.consoleStorage.startTime = new Date().toISOString();

        context.miniProgram.on('console', (msg: any) => {
          const consoleMessage: ConsoleMessage = {
            type: msg.type || 'log',
            args: msg.args || [],
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          // Use new navigations structure
          const currentSession = context.consoleStorage.navigations[0];
          if (currentSession) {
            // Assign msgid (if idGenerator available)
            if (context.consoleStorage.idGenerator) {
              consoleMessage.msgid = context.consoleStorage.idGenerator();
              context.consoleStorage.messageIdMap.set(consoleMessage.msgid, consoleMessage);
            }
            currentSession.messages.push(consoleMessage);
          }
          console.log(`[Console ${msg.type}]:`, msg.args);
        });

        context.miniProgram.on('exception', (err: any) => {
          const exceptionMessage: ExceptionMessage = {
            message: err.message || String(err),
            stack: err.stack,
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          // Use new navigations structure
          const currentSession = context.consoleStorage.navigations[0];
          if (currentSession) {
            // Assign msgid (if idGenerator available)
            if (context.consoleStorage.idGenerator) {
              exceptionMessage.msgid = context.consoleStorage.idGenerator();
              context.consoleStorage.messageIdMap.set(exceptionMessage.msgid, exceptionMessage);
            }
            currentSession.exceptions.push(exceptionMessage);
          }
          console.log(`[Exception]:`, err.message, err.stack);
        });

        response.appendResponseLine(`Console monitoring started automatically`);
      } catch (consoleError) {
        response.appendResponseLine(`Warning: Console monitoring failed to start - ${consoleError instanceof Error ? consoleError.message : String(consoleError)}`);
      }

      // Auto-start network monitoring (using evaluate() to bypass framework restrictions)
      try {
        if (!context.networkStorage.isMonitoring) {
          // Use same evaluate() injection method as network.ts, with Mpx framework support
          await context.miniProgram.evaluate(function() {
            // @ts-ignore
            if (typeof wx === 'undefined' || wx.__networkInterceptorsInstalled) {
              return;
            }

            // @ts-ignore
            wx.__networkLogs = wx.__networkLogs || [];

            // Mpx interceptors are injected uniformly in connectDevtools() in tools.ts
            // Only fallback wx.request interceptor is kept here (for non-Mpx frameworks or direct wx API calls)

            // Save original methods (obtained via getter)
            // @ts-ignore
            const _originalRequest = wx.request;
            // @ts-ignore
            const _originalUploadFile = wx.uploadFile;
            // @ts-ignore
            const _originalDownloadFile = wx.downloadFile;

            // Intercept wx.request - delete getter first
            // @ts-ignore
            delete wx.request;
            // @ts-ignore
            Object.defineProperty(wx, 'request', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;

                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'request', url: options.url, method: options.method || 'GET',
                    headers: options.header, data: options.data, statusCode: res.statusCode,
                    response: res.data, duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: true
                  });
                  if (origSuccess) origSuccess.call(this, res);
                };

                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'request', url: options.url, method: options.method || 'GET',
                    headers: options.header, data: options.data, error: err.errMsg || String(err),
                    duration: Date.now() - start, timestamp: new Date().toISOString(), success: false
                  });
                  if (origFail) origFail.call(this, err);
                };

                return _originalRequest.call(this, options);
              }
            });

            // Intercept wx.uploadFile - delete getter first
            // @ts-ignore
            delete wx.uploadFile;
            // @ts-ignore
            Object.defineProperty(wx, 'uploadFile', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;

                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'uploadFile', url: options.url, headers: options.header,
                    data: { filePath: options.filePath, name: options.name, formData: options.formData },
                    statusCode: res.statusCode, response: res.data, duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: true
                  });
                  if (origSuccess) origSuccess.call(this, res);
                };

                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'uploadFile', url: options.url, headers: options.header,
                    data: { filePath: options.filePath, name: options.name, formData: options.formData },
                    error: err.errMsg || String(err), duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: false
                  });
                  if (origFail) origFail.call(this, err);
                };

                return _originalUploadFile.call(this, options);
              }
            });

            // Intercept wx.downloadFile - delete getter first
            // @ts-ignore
            delete wx.downloadFile;
            // @ts-ignore
            Object.defineProperty(wx, 'downloadFile', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;

                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'downloadFile', url: options.url, headers: options.header,
                    statusCode: res.statusCode, response: { tempFilePath: res.tempFilePath, filePath: res.filePath },
                    duration: Date.now() - start, timestamp: new Date().toISOString(), success: true
                  });
                  if (origSuccess) origSuccess.call(this, res);
                };

                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({
                    id, type: 'downloadFile', url: options.url, headers: options.header,
                    error: err.errMsg || String(err), duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: false
                  });
                  if (origFail) origFail.call(this, err);
                };

                return _originalDownloadFile.call(this, options);
              }
            });

            // @ts-ignore
            wx.__networkInterceptorsInstalled = true;
          });

          context.networkStorage.isMonitoring = true;
          context.networkStorage.startTime = new Date().toISOString();
        }

        response.appendResponseLine(`Network monitoring started automatically (enhanced interception)`);
      } catch (networkError) {
        response.appendResponseLine(`Warning: Network monitoring failed to start - ${networkError instanceof Error ? networkError.message : String(networkError)}`);
      }

      response.appendResponseLine(`Successfully connected to WeChat DevTools (traditional mode)`);
      response.appendResponseLine(`Project path: ${projectPath}`);
      response.appendResponseLine(`Current page: ${result.pagePath}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Connection failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Smart connection to WeChat DevTools (Enhanced Version)
 */
export const connectDevtoolsEnhancedTool = defineTool({
  name: 'connect_devtools_enhanced',
  description: 'Smart connection to WeChat DevTools, supports multiple modes and auto-fallback (recommended)',
  schema: z.object({
    projectPath: z.string().describe('Absolute path to the mini program project'),
    mode: z.enum(['auto', 'launch', 'connect']).optional().default('auto')
      .describe('Connection mode: auto(smart), launch(traditional), connect(two-phase)'),
    cliPath: z.string().optional().describe('Absolute path to WeChat DevTools CLI (optional)'),
    autoPort: z.number().optional().describe('Automation listening port (optional, auto-detects by default)'),
    autoAccount: z.string().optional().describe('Specify user openid (--auto-account)'),
    timeout: z.number().optional().default(45000).describe('Connection timeout (milliseconds)'),
    fallbackMode: z.boolean().optional().default(true).describe('Allow mode fallback'),
    healthCheck: z.boolean().optional().default(true).describe('Perform health check'),
    verbose: z.boolean().optional().default(false).describe('Verbose logging output'),
    autoAudits: z.boolean().optional().describe('Whether to enable automatic experience scoring on startup'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const {
      projectPath,
      mode,
      cliPath,
      autoPort,
      autoAccount,
      timeout,
      fallbackMode,
      healthCheck,
      verbose,
      autoAudits
    } = request.params;

    // Check if there's an active connection
    if (context.miniProgram) {
      try {
        // Verify if connection is still valid
        const currentPage = await context.miniProgram.currentPage();
        const pagePath = await currentPage.path;

        // Connection is valid, reuse existing connection
        response.appendResponseLine(`✅ Active connection detected, reusing existing connection`);
        response.appendResponseLine(`Project path: ${projectPath}`);
        response.appendResponseLine(`Current page: ${pagePath}`);
        response.appendResponseLine(`Note: Skipping reconnection, using established connection`);

        if (verbose) {
          response.appendResponseLine(`Tip: To force reconnection, close WeChat DevTools first`);
        }

        return;
      } catch (error) {
        // Connection is invalid, clear and continue with new connection
        if (verbose) {
          response.appendResponseLine(`Existing connection detected but invalid, preparing to reconnect...`);
        }
        context.miniProgram = null;
        context.currentPage = null;
      }
    }

    try {
      const options: EnhancedConnectOptions = {
        projectPath,
        mode,
        cliPath,
        autoPort,
        autoAccount,
        timeout,
        fallbackMode,
        healthCheck,
        verbose,
        autoAudits
      };

      const result = await connectDevtoolsEnhanced(options);

      // Update context
      context.miniProgram = result.miniProgram;
      context.currentPage = result.currentPage;
      context.elementMap.clear();

      // Auto-start console monitoring
      try {
        // Clear previous listeners (if any)
        context.miniProgram.removeAllListeners('console');
        context.miniProgram.removeAllListeners('exception');

        // Start console monitoring
        context.consoleStorage.isMonitoring = true;
        context.consoleStorage.startTime = new Date().toISOString();

        context.miniProgram.on('console', (msg: any) => {
          const consoleMessage: ConsoleMessage = {
            type: msg.type || 'log',
            args: msg.args || [],
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          // Use new navigations structure
          const currentSession = context.consoleStorage.navigations[0];
          if (currentSession) {
            // Assign msgid (if idGenerator available)
            if (context.consoleStorage.idGenerator) {
              consoleMessage.msgid = context.consoleStorage.idGenerator();
              context.consoleStorage.messageIdMap.set(consoleMessage.msgid, consoleMessage);
            }
            currentSession.messages.push(consoleMessage);
          }
          console.log(`[Console ${msg.type}]:`, msg.args);
        });

        context.miniProgram.on('exception', (err: any) => {
          const exceptionMessage: ExceptionMessage = {
            message: err.message || String(err),
            stack: err.stack,
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          // Use new navigations structure
          const currentSession = context.consoleStorage.navigations[0];
          if (currentSession) {
            // Assign msgid (if idGenerator available)
            if (context.consoleStorage.idGenerator) {
              exceptionMessage.msgid = context.consoleStorage.idGenerator();
              context.consoleStorage.messageIdMap.set(exceptionMessage.msgid, exceptionMessage);
            }
            currentSession.exceptions.push(exceptionMessage);
          }
          console.log(`[Exception]:`, err.message, err.stack);
        });

        response.appendResponseLine(`Console monitoring started automatically`);
      } catch (consoleError) {
        response.appendResponseLine(`Warning: Console monitoring failed to start - ${consoleError instanceof Error ? consoleError.message : String(consoleError)}`);
      }

      // Auto-start network monitoring (using evaluate() to bypass framework restrictions)
      try {
        if (!context.networkStorage.isMonitoring) {
          // Use evaluate() to inject interceptors (same logic as first tool)
          await context.miniProgram.evaluate(function() {
            // @ts-ignore
            if (typeof wx === 'undefined' || wx.__networkInterceptorsInstalled) return;
            // @ts-ignore
            wx.__networkLogs = wx.__networkLogs || [];

            // Mpx interceptors are injected uniformly in connectDevtools() in tools.ts
            // Only fallback wx.request interceptor is kept here (for non-Mpx frameworks or direct wx API calls)

            // @ts-ignore - Save original methods (obtained via getter)
            const _originalRequest = wx.request;
            // @ts-ignore
            const _originalUploadFile = wx.uploadFile;
            // @ts-ignore
            const _originalDownloadFile = wx.downloadFile;

            // @ts-ignore - Delete getter first
            delete wx.request;
            // @ts-ignore
            Object.defineProperty(wx, 'request', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;
                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'request', url: options.url, method: options.method || 'GET',
                    headers: options.header, data: options.data, statusCode: res.statusCode,
                    response: res.data, duration: Date.now() - start, timestamp: new Date().toISOString(), success: true });
                  if (origSuccess) origSuccess.call(this, res);
                };
                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'request', url: options.url, method: options.method || 'GET',
                    headers: options.header, data: options.data, error: err.errMsg || String(err),
                    duration: Date.now() - start, timestamp: new Date().toISOString(), success: false });
                  if (origFail) origFail.call(this, err);
                };
                return _originalRequest.call(this, options);
              }
            });

            // @ts-ignore - Delete getter first
            delete wx.uploadFile;
            // @ts-ignore
            Object.defineProperty(wx, 'uploadFile', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;
                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'uploadFile', url: options.url, headers: options.header,
                    data: { filePath: options.filePath, name: options.name, formData: options.formData },
                    statusCode: res.statusCode, response: res.data, duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: true });
                  if (origSuccess) origSuccess.call(this, res);
                };
                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'uploadFile', url: options.url, headers: options.header,
                    data: { filePath: options.filePath, name: options.name, formData: options.formData },
                    error: err.errMsg || String(err), duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: false });
                  if (origFail) origFail.call(this, err);
                };
                return _originalUploadFile.call(this, options);
              }
            });

            // @ts-ignore - Delete getter first
            delete wx.downloadFile;
            // @ts-ignore
            Object.defineProperty(wx, 'downloadFile', {
              configurable: true,
              value: function(options: any) {
                const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const start = Date.now();
                const origSuccess = options.success;
                const origFail = options.fail;
                options.success = function(res: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'downloadFile', url: options.url, headers: options.header,
                    statusCode: res.statusCode, response: { tempFilePath: res.tempFilePath, filePath: res.filePath },
                    duration: Date.now() - start, timestamp: new Date().toISOString(), success: true });
                  if (origSuccess) origSuccess.call(this, res);
                };
                options.fail = function(err: any) {
                  // @ts-ignore
                  wx.__networkLogs.push({ id, type: 'downloadFile', url: options.url, headers: options.header,
                    error: err.errMsg || String(err), duration: Date.now() - start,
                    timestamp: new Date().toISOString(), success: false });
                  if (origFail) origFail.call(this, err);
                };
                return _originalDownloadFile.call(this, options);
              }
            });

            // @ts-ignore
            wx.__networkInterceptorsInstalled = true;
          });

          context.networkStorage.isMonitoring = true;
          context.networkStorage.startTime = new Date().toISOString();
        }

        response.appendResponseLine(`Network monitoring started automatically (enhanced interception)`);
      } catch (networkError) {
        response.appendResponseLine(`Warning: Network monitoring failed to start - ${networkError instanceof Error ? networkError.message : String(networkError)}`);
      }

      // Display detailed information based on result
      response.appendResponseLine(`✅ Smart connection successful`);
      response.appendResponseLine(`Project path: ${projectPath}`);
      response.appendResponseLine(`Current page: ${result.pagePath}`);
      response.appendResponseLine(`Connection mode: ${result.connectionMode}`);
      response.appendResponseLine(`Startup time: ${result.startupTime}ms`);
      response.appendResponseLine(`Health status: ${result.healthStatus}`);

      if (result.processInfo) {
        response.appendResponseLine(`Process info: PID=${result.processInfo.pid}, Port=${result.processInfo.port}`);
      }

    } catch (error) {
      // Handle enhanced error information
      if (error instanceof DevToolsConnectionError) {
        response.appendResponseLine(`❗ ${error.phase} phase failed: ${error.message}`);
        if (error.originalError) {
          response.appendResponseLine(`Original error: ${error.originalError.message}`);
        }
        if (error.details && verbose) {
          response.appendResponseLine(`Details: ${JSON.stringify(error.details, null, 2)}`);
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        response.appendResponseLine(`Connection failed: ${errorMessage}`);
      }
      throw error;
    }
  },
});

/**
 * Get current page information
 */
export const getCurrentPageTool = defineTool({
  name: 'get_current_page',
  description: 'Get current page information and set as active page',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      context.currentPage = await context.miniProgram.currentPage();
      const pagePath = await context.currentPage.path;

      response.appendResponseLine(`Current page: ${pagePath}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to get current page: ${errorMessage}`);
      throw error;
    }
  },
});
