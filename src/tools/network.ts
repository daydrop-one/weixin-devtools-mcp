/**
 * Network request monitoring tools
 * Implements network monitoring by intercepting wx.request, wx.uploadFile, wx.downloadFile
 */

import { z } from 'zod';
import { defineTool, NetworkRequest, NetworkRequestType } from './ToolDefinition.js';

/**
 * Create request interceptor function
 * Note: This function will be serialized and executed in the miniprogram environment, cannot use closure variables
 * Keep the function simple, only record information then call the original method
 */
function createRequestInterceptor() {
  return function(this: any, options: any) {
    // Initialize global storage
    // Key fix: Directly access wx object in miniprogram environment, not through globalThis
    // wx is a global object provided by miniprogram, directly available
    // @ts-ignore - wx is available in WeChat miniprogram environment
    const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;

    if (!wxObj) {
      // wx object does not exist, cannot record, call original method directly
      return this.origin(options);
    }

    if (!wxObj.__networkLogs) {
      wxObj.__networkLogs = [];
    }

    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();

    // Wrap success callback
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

    // Wrap fail callback
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

    // Call original method
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
 * Start network monitoring tool
 *
 * Uses evaluate() to directly inject interception code in the miniprogram environment
 * This approach can bypass API caching issues in frameworks like Mpx
 */
export const startNetworkMonitoringTool = defineTool({
  name: 'start_network_monitoring',
  description: 'Start monitoring network requests in WeChat miniprogram, intercepting wx.request, wx.uploadFile, wx.downloadFile',
  schema: z.object({
    clearExisting: z.boolean().optional().default(false).describe('Whether to clear existing network request records'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { clearExisting } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    if (context.networkStorage.isMonitoring) {
      response.appendResponseLine('Network monitoring is already running');
      response.appendResponseLine(`Currently recorded ${context.networkStorage.requests.length} network requests`);
      return;
    }

    // Clear existing records
    if (clearExisting) {
      context.networkStorage.requests = [];
    }

    try {
      // Use evaluate() to directly inject interception code in the miniprogram environment
      // Supports dual mode: Mpx framework interceptor + wx.request fallback
      await context.miniProgram.evaluate(function(shouldClear: boolean) {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        if (typeof wx === 'undefined') {
          throw new Error('wx object is not available');
        }

        // Initialize or clear storage
        // @ts-ignore
        if (!wx.__networkLogs || shouldClear) {
          // @ts-ignore
          wx.__networkLogs = [];
        }

        // Check if interceptor is already installed
        // @ts-ignore
        if (wx.__networkInterceptorsInstalled && !shouldClear) {
          console.log('[MCP-DEBUG] Interceptor already installed, skipping duplicate installation');
          return; // Already installed, skip
        }

        // If clearing is needed, delete old markers first
        if (shouldClear) {
          console.log('[MCP-DEBUG] Force reinstall: clearing old installation marker');
          // @ts-ignore
          delete wx.__networkInterceptorsInstalled;
          // Also clear pending queue and config cache
          // @ts-ignore
          wx.__pendingQueue = [];
          // @ts-ignore
          wx.__requestConfigMap = {};
        }

        // ===== Mode 1: Detect and use Mpx framework interceptor =====
        console.log('[MCP-DEBUG] Starting Mpx framework detection...');

        // @ts-ignore - getApp is available in WeChat miniprogram environment
        const app = getApp();
        console.log('[MCP-DEBUG] getApp() result:', {
          hasApp: !!app,
          appType: typeof app,
          hasXfetch: !!(app && app.$xfetch),
          xfetchType: app && app.$xfetch ? typeof app.$xfetch : 'undefined'
        });

        const hasMpxFetch = app &&
                            app.$xfetch &&
                            app.$xfetch.interceptors &&
                            typeof app.$xfetch.interceptors.request.use === 'function';

        console.log('[MCP-DEBUG] Mpx detection result:', {
          hasMpxFetch: hasMpxFetch,
          hasInterceptors: !!(app && app.$xfetch && app.$xfetch.interceptors),
          hasRequestUse: !!(app && app.$xfetch && app.$xfetch.interceptors && app.$xfetch.interceptors.request),
          hasResponseUse: !!(app && app.$xfetch && app.$xfetch.interceptors && app.$xfetch.interceptors.response)
        });

        if (hasMpxFetch) {
          console.log('[MCP] ✅ Mpx framework detected, using getApp().$xfetch interceptor mode');
          console.log('[MCP] 📝 Using pending queue solution to resolve response structure changes by business interceptors');

          // Initialize pending queue and config cache
          // @ts-ignore
          if (!wx.__pendingQueue) {
            // @ts-ignore
            wx.__pendingQueue = [];
          }
          // @ts-ignore
          if (!wx.__requestConfigMap) {
            // @ts-ignore
            wx.__requestConfigMap = {};
          }

          // If reinstalling, clear old Mpx interceptor handlers (prevent accumulation)
          if (shouldClear) {
            console.log('[MCP-DEBUG] Preparing to clear handlers, shouldClear=', shouldClear);
            console.log('[MCP-DEBUG] request interceptor structure:', {
              hasInterceptors: !!app.$xfetch.interceptors.request,
              hasHandlers: !!app.$xfetch.interceptors.request.handlers,
              handlersType: typeof app.$xfetch.interceptors.request.handlers,
              handlersIsArray: Array.isArray(app.$xfetch.interceptors.request.handlers)
            });

            // @ts-ignore
            if (app.$xfetch.interceptors.request && app.$xfetch.interceptors.request.handlers) {
              // @ts-ignore
              app.$xfetch.interceptors.request.handlers = [];
              console.log('[MCP-DEBUG] ✅ Cleared old request interceptor handlers');
            } else {
              console.log('[MCP-DEBUG] ⚠️  request.handlers does not exist or is not an array');
            }

            // @ts-ignore
            if (app.$xfetch.interceptors.response && app.$xfetch.interceptors.response.handlers) {
              // @ts-ignore
              app.$xfetch.interceptors.response.handlers = [];
              console.log('[MCP-DEBUG] ✅ Cleared old response interceptor handlers');
            } else {
              console.log('[MCP-DEBUG] ⚠️  response.handlers does not exist or is not an array');
            }
          }

          // Request interceptor - Record request start and cache config
          // @ts-ignore
          getApp().$xfetch.interceptors.request.use(function(config: any) {
            const requestId = 'mpx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();

            console.log('[MCP-DEBUG] 🔵 Request interceptor triggered:', {
              requestId: requestId,
              method: config.method,
              url: config.url,
              hasData: !!config.data,
              hasParams: !!config.params,
              timestamp: new Date().toISOString()
            });

            // Save complete config to cache (because response interceptor may not have access to requestConfig)
            // @ts-ignore
            wx.__requestConfigMap[requestId] = {
              url: config.url,
              method: config.method || 'GET',
              header: config.header || config.headers,
              data: config.data,
              params: config.params,
              timeout: config.timeout || 30000
            };

            // Add to pending queue (FIFO)
            // @ts-ignore
            wx.__pendingQueue.push({
              id: requestId,
              url: config.url,
              method: config.method || 'GET',
              startTime: startTime
            });

            // Clean up timed-out pending requests (avoid queue buildup)
            const timeout = config.timeout || 30000;
            // @ts-ignore
            wx.__pendingQueue = wx.__pendingQueue.filter((item: any) =>
              Date.now() - item.startTime < timeout + 5000  // Extra 5 seconds tolerance
            );

            // @ts-ignore - wx is available in WeChat miniprogram environment
            wx.__networkLogs.push({
              id: requestId,
              type: 'request',
              method: config.method || 'GET',
              url: config.url,
              headers: config.header || config.headers,
              data: config.data,
              params: config.params,
              timestamp: new Date(startTime).toISOString(),
              source: 'getApp().$xfetch',
              pending: true,  // Mark as pending
              success: undefined  // Initialize success field, avoid state judgment issues
            });

            // @ts-ignore - wx is available in WeChat miniprogram environment
            console.log('[MCP-DEBUG] ✅ Request recorded, pending queue:', wx.__pendingQueue.length, ', logs:', wx.__networkLogs.length);

            return config; // Must return config to continue request chain
          });

          // Response interceptor - Use pending queue to match request/response
          // @ts-ignore
          getApp().$xfetch.interceptors.response.use(
            function onSuccess(data: any) {
              try {
                // Note: data may only be business data (e.g., {goodsList, tripId}), not complete response object
                // Because business interceptors (commonResInterceptor) changed the response structure

                console.log('[MCP-DEBUG] 🟢 Response interceptor triggered (success)');
                console.log('[MCP-DEBUG] 🔍 Response data type:', typeof data, ', keys:', Object.keys(data || {}));

                // Get earliest request from pending queue (FIFO matching)
                // @ts-ignore
                const requestInfo = wx.__pendingQueue.shift();

                if (!requestInfo) {
                  console.log('[MCP-DEBUG] ⚠️  Pending queue is empty, cannot match request');
                  return data;
                }

                const duration = Date.now() - requestInfo.startTime;

                console.log('[MCP-DEBUG] 📦 Retrieved request from queue:', {
                  requestId: requestInfo.id,
                  url: requestInfo.url,
                  method: requestInfo.method,
                  duration: duration + 'ms'
                });

                // Get complete request config from cache
                // @ts-ignore
                const savedConfig = wx.__requestConfigMap[requestInfo.id];

                if (!savedConfig) {
                  console.log('[MCP-DEBUG] ⚠️  Cached config not found');
                }

                // @ts-ignore
                // Find corresponding log record and update
                let logIndex = wx.__networkLogs.findIndex((log: any) => log.id === requestInfo.id);

                // Enhancement: If not found by ID, try matching by URL and time window (fallback strategy)
                if (logIndex === -1) {
                  console.log('[MCP-DEBUG] ⚠️  Log not found by ID, trying URL matching...');
                  // @ts-ignore
                  logIndex = wx.__networkLogs.findIndex((log: any) =>
                    log.url === requestInfo.url &&
                    log.pending === true &&
                    Math.abs(new Date(log.timestamp).getTime() - requestInfo.startTime) < 10000 // 10-second window
                  );

                  if (logIndex !== -1) {
                    console.log('[MCP-DEBUG] ✅ Found log via URL matching, index:', logIndex);
                  }
                }

                if (logIndex !== -1) {
                  // @ts-ignore
                  const existingLog = wx.__networkLogs[logIndex];
                  // @ts-ignore
                  wx.__networkLogs[logIndex] = {
                    ...existingLog,
                    statusCode: 200,  // Success if we got here
                    response: data,   // Can only get business data
                    duration: duration,
                    completedAt: new Date().toISOString(),
                    pending: false,
                    success: true
                  };
                  console.log('[MCP-DEBUG] ✅ Request record updated (merged response), index:', logIndex);
                } else {
                  console.log('[MCP-DEBUG] ❌ Matching log record not found at all, requestId:', requestInfo.id, ', url:', requestInfo.url);
                }

                // Clean up config cache
                // @ts-ignore
                if (savedConfig) {
                  // @ts-ignore
                  delete wx.__requestConfigMap[requestInfo.id];
                }

                // @ts-ignore - wx is available in WeChat miniprogram environment
                console.log('[MCP-DEBUG] 📊 Status - logs:', wx.__networkLogs.length, ', pending:', wx.__pendingQueue.length, ', config cache:', Object.keys(wx.__requestConfigMap || {}).length);

                return data; // Must return data to continue interceptor chain
              } catch (error) {
                console.log('[MCP-DEBUG] ❌ Response interceptor exception:', error);
                return data; // Even if error occurs, must return data, cannot interrupt business logic
              }
            },
            function onError(error: any) {
              try {
                console.log('[MCP-DEBUG] 🔴 Response interceptor triggered (error)');
                console.log('[MCP-DEBUG] 🔍 Error object:', error);

                // Get earliest request from pending queue (FIFO matching)
                // @ts-ignore
                const requestInfo = wx.__pendingQueue.shift();

                if (!requestInfo) {
                  console.log('[MCP-DEBUG] ⚠️  Pending queue is empty, cannot match error request');
                  return Promise.reject(error);
                }

                const duration = Date.now() - requestInfo.startTime;

                console.log('[MCP-DEBUG] 📦 Retrieved request from queue (error):', {
                  requestId: requestInfo.id,
                  url: requestInfo.url,
                  error: error.errMsg || error.msg || error.message || String(error),
                  duration: duration + 'ms'
                });

                // @ts-ignore
                // Find corresponding log record and update
                let logIndex = wx.__networkLogs.findIndex((log: any) => log.id === requestInfo.id);

                // Enhancement: If not found by ID, try matching by URL and time window (fallback strategy)
                if (logIndex === -1) {
                  console.log('[MCP-DEBUG] ⚠️  Log not found by ID (error scenario), trying URL matching...');
                  // @ts-ignore
                  logIndex = wx.__networkLogs.findIndex((log: any) =>
                    log.url === requestInfo.url &&
                    log.pending === true &&
                    Math.abs(new Date(log.timestamp).getTime() - requestInfo.startTime) < 10000 // 10-second window
                  );

                  if (logIndex !== -1) {
                    console.log('[MCP-DEBUG] ✅ Found log via URL matching (error scenario), index:', logIndex);
                  }
                }

                if (logIndex !== -1) {
                  // @ts-ignore
                  const existingLog = wx.__networkLogs[logIndex];
                  // @ts-ignore
                  wx.__networkLogs[logIndex] = {
                    ...existingLog,
                    error: error.errMsg || error.msg || error.message || String(error),
                    statusCode: error.status || error.statusCode,
                    duration: duration,
                    completedAt: new Date().toISOString(),
                    pending: false,
                    success: false
                  };
                  console.log('[MCP-DEBUG] ✅ Request record updated (merged error), index:', logIndex);
                } else {
                  console.log('[MCP-DEBUG] ❌ Matching log record not found at all (error scenario), requestId:', requestInfo.id, ', url:', requestInfo.url);
                }

                // Clean up config cache
                // @ts-ignore
                if (wx.__requestConfigMap && wx.__requestConfigMap[requestInfo.id]) {
                  // @ts-ignore
                  delete wx.__requestConfigMap[requestInfo.id];
                }

                // @ts-ignore - wx is available in WeChat miniprogram environment
                console.log('[MCP-DEBUG] 📊 Status - logs:', wx.__networkLogs.length, ', pending:', wx.__pendingQueue.length);

                return Promise.reject(error); // Maintain error propagation
              } catch (innerError) {
                console.log('[MCP-DEBUG] ❌ Error interceptor exception:', innerError);
                return Promise.reject(error); // Even if error occurs, must propagate original error, cannot interrupt business logic
              }
            }
          );

          // @ts-ignore - wx is available in WeChat miniprogram environment
          wx.__networkInterceptorsInstalled = 'mpx';
          console.log('[MCP] ✅ Mpx interceptor installation completed');
          // @ts-ignore - wx is available in WeChat miniprogram environment
          console.log('[MCP-DEBUG] Interceptor marked as installed: wx.__networkInterceptorsInstalled =', wx.__networkInterceptorsInstalled);
        } else {
          console.log('[MCP] ⚠️  Mpx framework not detected or $xfetch not available');
        }

        // ===== Mode 2: wx.request fallback (for non-Mpx frameworks or direct wx API calls) =====
        if (!hasMpxFetch) {
          console.log('[MCP] ⚠️  Mpx framework not detected, using wx.request interception mode');
        } else {
          console.log('[MCP-DEBUG] In Mpx mode, also installing wx.request fallback interceptor (double insurance)');
        }

        // Save original method references (obtained via getter)
        // @ts-ignore
        const _originalRequest = wx.request;
        // @ts-ignore
        const _originalUploadFile = wx.uploadFile;
        // @ts-ignore
        const _originalDownloadFile = wx.downloadFile;

        console.log('[MCP-DEBUG] Original method types:', {
          requestType: typeof _originalRequest,
          uploadFileType: typeof _originalUploadFile,
          downloadFileType: typeof _originalDownloadFile
        });

        // Intercept wx.request
        // Key: First delete getter property, then redefine as normal property
        // @ts-ignore
        delete wx.request;
        // @ts-ignore
        Object.defineProperty(wx, 'request', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: function(options: any) {
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();

            console.log('[MCP-DEBUG] 🔵 wx.request called:', {
              requestId: requestId,
              method: options.method || 'GET',
              url: options.url,
              hasData: !!options.data,
              timestamp: new Date().toISOString()
            });

            // Wrap success callback
            const originalSuccess = options.success;
            options.success = function(res: any) {
              console.log('[MCP-DEBUG] 🟢 wx.request success callback:', {
                requestId: requestId,
                statusCode: res.statusCode,
                duration: Date.now() - startTime
              });

              // @ts-ignore
              wx.__networkLogs.push({
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
                source: 'wx.request',
                success: true
              });

              // @ts-ignore - wx is available in WeChat miniprogram environment
              console.log('[MCP-DEBUG] ✅ wx.request recorded, current total:', wx.__networkLogs.length);

              if (originalSuccess) originalSuccess.call(this, res);
            };

            // Wrap fail callback
            const originalFail = options.fail;
            options.fail = function(err: any) {
              console.log('[MCP-DEBUG] 🔴 wx.request fail callback:', {
                requestId: requestId,
                error: err.errMsg,
                duration: Date.now() - startTime
              });

              // @ts-ignore
              wx.__networkLogs.push({
                id: requestId,
                type: 'request',
                url: options.url,
                method: options.method || 'GET',
                headers: options.header,
                data: options.data,
                error: err.errMsg || String(err),
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                source: 'wx.request',
                success: false
              });

              // @ts-ignore - wx is available in WeChat miniprogram environment
              console.log('[MCP-DEBUG] ✅ wx.request error recorded, current total:', wx.__networkLogs.length);

              if (originalFail) originalFail.call(this, err);
            };

            // Call original method
            return _originalRequest.call(this, options);
          }
        });

        console.log('[MCP-DEBUG] ✅ wx.request interceptor installed');

        // Intercept wx.uploadFile
        // Key: First delete getter property
        // @ts-ignore
        delete wx.uploadFile;
        // @ts-ignore
        Object.defineProperty(wx, 'uploadFile', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: function(options: any) {
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();

            const originalSuccess = options.success;
            options.success = function(res: any) {
              // @ts-ignore
              wx.__networkLogs.push({
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
                source: 'wx.uploadFile',
                success: true
              });
              if (originalSuccess) originalSuccess.call(this, res);
            };

            const originalFail = options.fail;
            options.fail = function(err: any) {
              // @ts-ignore
              wx.__networkLogs.push({
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
                source: 'wx.uploadFile',
                success: false
              });
              if (originalFail) originalFail.call(this, err);
            };

            return _originalUploadFile.call(this, options);
          }
        });

        // Intercept wx.downloadFile
        // Key: First delete getter property
        // @ts-ignore
        delete wx.downloadFile;
        // @ts-ignore
        Object.defineProperty(wx, 'downloadFile', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: function(options: any) {
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();

            const originalSuccess = options.success;
            options.success = function(res: any) {
              // @ts-ignore
              wx.__networkLogs.push({
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
                source: 'wx.downloadFile',
                success: true
              });
              if (originalSuccess) originalSuccess.call(this, res);
            };

            const originalFail = options.fail;
            options.fail = function(err: any) {
              // @ts-ignore
              wx.__networkLogs.push({
                id: requestId,
                type: 'downloadFile',
                url: options.url,
                headers: options.header,
                error: err.errMsg || String(err),
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                source: 'wx.downloadFile',
                success: false
              });
              if (originalFail) originalFail.call(this, err);
            };

            return _originalDownloadFile.call(this, options);
          }
        });

        // Mark interceptor as installed
        // @ts-ignore
        wx.__networkInterceptorsInstalled = true;
      }, clearExisting);

      // Set monitoring state
      context.networkStorage.isMonitoring = true;
      context.networkStorage.startTime = new Date().toISOString();

      response.appendResponseLine('✅ Network monitoring started (using enhanced interception)');
      response.appendResponseLine(`Monitoring start time: ${context.networkStorage.startTime}`);
      response.appendResponseLine(`Clear history: ${clearExisting ? 'Yes' : 'No'}`);
      response.appendResponseLine('');
      response.appendResponseLine('Intercepted methods:');
      response.appendResponseLine('  - wx.request');
      response.appendResponseLine('  - wx.uploadFile');
      response.appendResponseLine('  - wx.downloadFile');
      response.appendResponseLine('');
      response.appendResponseLine('💡 Using evaluate() injection, can bypass Mpx and other framework limitations');
      response.appendResponseLine('   All network requests will be captured, use get_network_requests to view');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start network monitoring: ${errorMessage}`);
    }
  },
});

/**
 * Stop network monitoring tool
 *
 * Note: Interceptors injected using evaluate() cannot be fully restored
 * Can only clear markers, actual interceptors will continue working
 */
export const stopNetworkMonitoringTool = defineTool({
  name: 'stop_network_monitoring',
  description: 'Stop monitoring network requests in WeChat miniprogram, restore original network methods',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    if (!context.networkStorage.isMonitoring) {
      response.appendResponseLine('Network monitoring is not running');
      return;
    }

    try {
      // Read final request data from miniprogram environment and clear marker
      const result = await context.miniProgram.evaluate(function() {
        // @ts-ignore
        const wxObj = typeof wx !== 'undefined' ? wx : null;
        if (!wxObj) {
          return { logs: [], success: false };
        }

        const logs = wxObj.__networkLogs || [];

        // Clear installation marker (allow reinstallation)
        // Note: Actual interceptors cannot be restored because we used Object.defineProperty
        // This is a limitation of the evaluate() approach, but the benefit is bypassing framework caching
        wxObj.__networkInterceptorsInstalled = false;

        return { logs, success: true };
      });

      if (!result.success) {
        throw new Error('Cannot access wx object');
      }

      const logs = result.logs as NetworkRequest[];

      // Update monitoring state
      context.networkStorage.isMonitoring = false;

      response.appendResponseLine('✅ Network monitoring stopped');
      response.appendResponseLine(`Collected ${logs.length} network requests during monitoring`);

      // Count requests by type
      const stats = logs.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      response.appendResponseLine('');
      response.appendResponseLine('Request type statistics:');
      if (stats.request) response.appendResponseLine(`  - request: ${stats.request}`);
      if (stats.uploadFile) response.appendResponseLine(`  - uploadFile: ${stats.uploadFile}`);
      if (stats.downloadFile) response.appendResponseLine(`  - downloadFile: ${stats.downloadFile}`);
      response.appendResponseLine('');
      response.appendResponseLine('⚠️ Note: Interceptors will continue working (characteristic of evaluate approach)');
      response.appendResponseLine('   Use clear_network_requests to clear data');
      response.appendResponseLine('   Use start_network_monitoring to restart recording');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to stop network monitoring: ${errorMessage}`);
    }
  },
});

/**
 * Get network requests tool
 */
export const getNetworkRequestsTool = defineTool({
  name: 'get_network_requests',
  description: 'Retrieve collected network request records, supports filtering by type, URL, and status',
  schema: z.object({
    type: z.enum(['all', 'request', 'uploadFile', 'downloadFile']).optional().default('all').describe('Request type filter'),
    urlPattern: z.string().optional().describe('URL matching pattern (supports regular expressions)'),
    successOnly: z.boolean().optional().default(false).describe('Return only successful requests'),
    limit: z.number().optional().default(50).describe('Limit number of results'),
    since: z.string().optional().describe('Get records after specified time, format: ISO 8601'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type, urlPattern, successOnly, limit, since } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    if (!context.networkStorage) {
      throw new Error('Network storage not initialized');
    }

    try {
      // Read network request data from miniprogram environment
      const logs: NetworkRequest[] = await context.miniProgram.evaluate(function() {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        const wxObj = typeof wx !== 'undefined' ? wx : null;
        return wxObj?.__networkLogs || [];
      });

      const sinceTime = since ? new Date(since) : null;
      const urlRegex = urlPattern ? new RegExp(urlPattern) : null;

      // Filter functions
      const filters = [
        // Filter invalid records (type='response' or url is empty/undefined)
        (req: NetworkRequest) => {
          // Filter out type='response' records (should not exist)
          if (req.type === 'response' as any) {
            return false;
          }
          // Filter out records with empty or 'undefined' URL
          if (!req.url || req.url === 'undefined') {
            return false;
          }
          // Filter out records with empty or 'N/A' ID
          if (!req.id || req.id === 'N/A') {
            return false;
          }
          return true;
        },
        // Type filter
        (req: NetworkRequest) => type === 'all' || req.type === type,
        // Time filter
        (req: NetworkRequest) => !sinceTime || new Date(req.timestamp) >= sinceTime,
        // URL filter
        (req: NetworkRequest) => !urlRegex || urlRegex.test(req.url),
        // Success status filter
        (req: NetworkRequest) => !successOnly || req.success,
      ];

      const filteredRequests = logs
        .filter(req => filters.every(filter => filter(req)))
        .slice(-limit);

      // Generate response
      response.appendResponseLine('=== Network Request Records ===');
      response.appendResponseLine(`Monitoring status: ${context.networkStorage.isMonitoring ? 'Running' : 'Stopped'}`);
      response.appendResponseLine(`Monitoring start time: ${context.networkStorage.startTime || 'Not set'}`);
      response.appendResponseLine(`Total requests: ${logs.length}`);
      response.appendResponseLine(`After filtering: ${filteredRequests.length} items`);
      response.appendResponseLine('');

      if (filteredRequests.length === 0) {
        response.appendResponseLine('No network request records matching the criteria');
        return;
      }

    filteredRequests.forEach((req, index) => {
      response.appendResponseLine(`--- Request ${index + 1} ---`);
      response.appendResponseLine(`ID: ${req.id || 'N/A'}`);
      response.appendResponseLine(`Type: ${req.type}`);

      // Filter out old, invalid records
      if (!req.url || req.url === 'undefined') {
        response.appendResponseLine(`⚠️ Invalid record (possibly old data)`);
        response.appendResponseLine('');
        return;
      }

      response.appendResponseLine(`URL: ${req.url}`);

      if (req.method) {
        response.appendResponseLine(`Method: ${req.method}`);
      }

      // Optimized status judgment logic
      const isPending = req.pending === true;
      const isCompleted = req.pending === false;
      const isSuccess = req.success === true;
      const isFailed = req.success === false;

      if (isPending) {
        response.appendResponseLine(`Status: ⏳ Requesting (no response received)`);
      } else if (isCompleted) {
        if (isSuccess) {
          response.appendResponseLine(`Status: ✅ Success`);
        } else if (isFailed) {
          response.appendResponseLine(`Status: ❌ Failed`);
        } else {
          response.appendResponseLine(`Status: ⚠️ Unknown (success=${req.success})`);
        }
      } else {
        // Compatible with old format (wx.request etc., no pending field)
        if (isSuccess) {
          response.appendResponseLine(`Status: ✅ Success`);
        } else if (isFailed) {
          response.appendResponseLine(`Status: ❌ Failed`);
        } else {
          response.appendResponseLine(`Status: ⚠️ Unknown status`);
        }
      }

      if (req.statusCode) {
        response.appendResponseLine(`Status code: ${req.statusCode}`);
      }

      if (req.duration !== undefined) {
        response.appendResponseLine(`Duration: ${req.duration}ms`);
      }

      response.appendResponseLine(`Time: ${req.timestamp}`);

      if (req.source) {
        response.appendResponseLine(`Source: ${req.source}`);
      }

      // === Request information ===
      if (req.headers && Object.keys(req.headers).length > 0) {
        response.appendResponseLine(`Request headers: ${JSON.stringify(req.headers)}`);
      }

      if (req.data) {
        const dataStr = typeof req.data === 'string'
          ? req.data
          : JSON.stringify(req.data);
        const truncatedData = dataStr.length > 200
          ? dataStr.substring(0, 200) + '...'
          : dataStr;
        response.appendResponseLine(`Request data: ${truncatedData}`);
      }

      if (req.params) {
        response.appendResponseLine(`Request params: ${JSON.stringify(req.params)}`);
      }

      // === Response information ===
      if (req.response) {
        const respStr = typeof req.response === 'string'
          ? req.response
          : JSON.stringify(req.response);
        const truncatedResp = respStr.length > 200
          ? respStr.substring(0, 200) + '...'
          : respStr;
        response.appendResponseLine(`Response data: ${truncatedResp}`);
      }

      if (req.responseHeaders && Object.keys(req.responseHeaders).length > 0) {
        response.appendResponseLine(`Response headers: ${JSON.stringify(req.responseHeaders)}`);
      }

      if (req.error) {
        response.appendResponseLine(`Error message: ${req.error}`);
      }

      if (req.completedAt) {
        response.appendResponseLine(`Completed at: ${req.completedAt}`);
      }

      response.appendResponseLine('');
      });

      response.appendResponseLine('=== Retrieval completed ===');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve network requests: ${errorMessage}`);
    }
  },
});

/**
 * Diagnose interceptor status tool - for debugging
 */
export const diagnoseInterceptorTool = defineTool({
  name: 'diagnose_interceptor',
  description: 'Diagnose network interceptor installation status and runtime status',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const result = await context.miniProgram.evaluate(() => {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        const wxObj = typeof wx !== 'undefined' ? wx : null;

        // Test console.log
        console.log('[INTERCEPTOR-DIAGNOSE] === Starting interceptor diagnosis ===');
        console.log('[INTERCEPTOR-DIAGNOSE] wx object exists:', !!wxObj);

        // @ts-ignore - getApp is available in WeChat miniprogram environment
        const hasGetApp = typeof getApp !== 'undefined';
        // @ts-ignore - getApp is available in WeChat miniprogram environment
        const app = hasGetApp ? getApp() : null;

        const diagnosticInfo = {
          environment: {
            hasWx: !!wxObj,
            hasGetApp: hasGetApp,
          },
          interceptor: {
            installed: !!(wxObj && wxObj.__networkInterceptorsInstalled),
            hasNetworkLogs: !!(wxObj && wxObj.__networkLogs),
            networkLogsLength: wxObj && wxObj.__networkLogs ? wxObj.__networkLogs.length : 0,
          },
          mpx: {
            hasGetApp: hasGetApp,
            hasApp: !!app,
            has$xfetch: !!(app && app.$xfetch),
          },
          networkLogs: wxObj && wxObj.__networkLogs ? wxObj.__networkLogs.slice(-5) : [],
        };

        console.log('[INTERCEPTOR-DIAGNOSE] Diagnostic info:', JSON.stringify(diagnosticInfo, null, 2));
        console.log('[INTERCEPTOR-DIAGNOSE] === Diagnosis completed ===');

        return diagnosticInfo;
      });

      response.appendResponseLine('=== Interceptor Diagnosis Results ===\n');
      response.appendResponseLine(`Environment check:`);
      response.appendResponseLine(`  wx object: ${result.environment.hasWx ? '✅' : '❌'}`);
      response.appendResponseLine(`  getApp: ${result.environment.hasGetApp ? '✅' : '❌'}`);
      response.appendResponseLine('');
      response.appendResponseLine(`Interceptor status:`);
      response.appendResponseLine(`  Installed: ${result.interceptor.installed ? '✅' : '❌'}`);
      response.appendResponseLine(`  Log array: ${result.interceptor.hasNetworkLogs ? '✅' : '❌'}`);
      response.appendResponseLine(`  Record count: ${result.interceptor.networkLogsLength}`);
      response.appendResponseLine('');
      response.appendResponseLine(`Mpx framework:`);
      response.appendResponseLine(`  getApp available: ${result.mpx.hasGetApp ? '✅' : '❌'}`);
      response.appendResponseLine(`  App instance: ${result.mpx.hasApp ? '✅' : '❌'}`);
      response.appendResponseLine(`  $xfetch: ${result.mpx.has$xfetch ? '✅' : '❌'}`);
      response.appendResponseLine('');

      if (result.networkLogs && result.networkLogs.length > 0) {
        response.appendResponseLine(`Recent ${result.networkLogs.length} network logs:`);
        result.networkLogs.forEach((log: any, index: number) => {
          response.appendResponseLine(`  ${index + 1}. [${log.type}] ${log.url || log.method}`);
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Diagnosis failed: ${errorMessage}`);
    }
  },
});

/**
 * Clear network requests tool
 */
export const clearNetworkRequestsTool = defineTool({
  name: 'clear_network_requests',
  description: 'Clear collected network request records',
  schema: z.object({
    type: z.enum(['all', 'request', 'uploadFile', 'downloadFile']).optional().default('all').describe('Type of requests to clear'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    if (!context.networkStorage) {
      throw new Error('Network storage not initialized');
    }

    try {
      // Get current count
      const beforeCount: number = await context.miniProgram.evaluate(function() {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        const wxObj = typeof wx !== 'undefined' ? wx : null;
        return (wxObj?.__networkLogs || []).length;
      });

      // Clear data in miniprogram environment
      const afterCount: number = await context.miniProgram.evaluate(function(typeToDelete: string) {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        const wxObj = typeof wx !== 'undefined' ? wx : null;
        if (!wxObj || !wxObj.__networkLogs) {
          return 0;
        }

        if (typeToDelete === 'all') {
          wxObj.__networkLogs = [];
        } else {
          wxObj.__networkLogs = wxObj.__networkLogs.filter((req: any) => req.type !== typeToDelete);
        }

        return wxObj.__networkLogs.length;
      }, type);

      const clearedCount = beforeCount - afterCount;

      response.appendResponseLine('✅ Network request records cleared successfully');
      response.appendResponseLine(`Cleared type: ${type}`);
      response.appendResponseLine(`Cleared count: ${clearedCount} items`);
      response.appendResponseLine(`Remaining count: ${afterCount} items`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clear network requests: ${errorMessage}`);
    }
  },
});
