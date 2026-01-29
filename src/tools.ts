/**
 * WeChat DevTools MCP Tool Functions
 * Provides testable pure function implementations
 */

import automator from "miniprogram-automator";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { promisify } from "util";
const sleep = promisify(setTimeout);

/**
 * Connection options interface
 */
export interface ConnectOptions {
  projectPath: string;
  cliPath?: string;
  port?: number;
  autoAudits?: boolean;
}

/**
 * Enhanced connection options interface
 */
export interface EnhancedConnectOptions extends ConnectOptions {
  mode?: 'auto' | 'launch' | 'connect';
  autoPort?: number;           // CLI --auto-port parameter
  autoAccount?: string;        // CLI --auto-account parameter
  timeout?: number;            // Connection timeout
  fallbackMode?: boolean;      // Allow fallback to other modes
  healthCheck?: boolean;       // Perform health check after connection
  verbose?: boolean;          // Verbose logging output
}

/**
 * Startup result interface
 */
export interface StartupResult {
  processInfo: {
    pid: number;
    port: number;
  };
  startTime: number;
}

/**
 * Detailed connection result interface
 */
export interface DetailedConnectResult extends ConnectResult {
  connectionMode: 'launch' | 'connect';
  startupTime: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  processInfo?: {
    pid: number;
    port: number;
  };
}

/**
 * DevTools connection error class
 */
export class DevToolsConnectionError extends Error {
  constructor(
    message: string,
    public phase: 'startup' | 'connection' | 'health_check',
    public originalError?: Error,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DevToolsConnectionError';
  }
}

/**
 * Connection result interface
 */
export interface ConnectResult {
  miniProgram: any;
  currentPage: any;
  pagePath: string;
}

/**
 * automator.launch options interface
 */
interface AutomatorLaunchOptions {
  projectPath: string;
  cliPath?: string;
  port?: number;
  projectConfig?: {
    setting?: {
      autoAudits?: boolean;
    };
  };
}

/**
 * Connect to WeChat DevTools
 *
 * @param options Connection options
 * @returns Connection result
 * @throws Throws error on connection failure
 */
export async function connectDevtools(options: ConnectOptions): Promise<ConnectResult> {
  const { projectPath, cliPath, port, autoAudits } = options;

  if (!projectPath) {
    throw new Error("Project path is required");
  }

  try {
    // Handle @playground/wx format path, convert to absolute filesystem path
    let resolvedProjectPath = projectPath;
    if (projectPath.startsWith('@playground/')) {
      // Convert to relative path, then resolve to absolute path
      const relativePath = projectPath.replace('@playground/', 'playground/');
      resolvedProjectPath = path.resolve(process.cwd(), relativePath);
    } else if (!path.isAbsolute(projectPath)) {
      // If not absolute path, convert to absolute path
      resolvedProjectPath = path.resolve(process.cwd(), projectPath);
    }

    // Validate project path exists
    if (!fs.existsSync(resolvedProjectPath)) {
      throw new Error(`Project path '${resolvedProjectPath}' doesn't exist`);
    }

    // Build automator.launch options
    const launchOptions: AutomatorLaunchOptions = { projectPath: resolvedProjectPath };
    if (cliPath) launchOptions.cliPath = cliPath;
    if (port) launchOptions.port = port;
    if (typeof autoAudits === 'boolean') {
      launchOptions.projectConfig = {
        ...(launchOptions.projectConfig || {}),
        setting: {
          ...(launchOptions.projectConfig?.setting || {}),
          autoAudits
        }
      };
    }

    // Launch and connect to WeChat DevTools
    const miniProgram = await automator.launch(launchOptions);

    // Get current page
    const currentPage = await miniProgram.currentPage();
    if (!currentPage) {
      throw new Error("Unable to get current page");
    }
    const pagePath = await currentPage.path;

    // Auto-start network monitoring
    try {
      // Create request interceptor (inline function)
      await miniProgram.mockWxMethod('request', function(this: any, options: any) {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;
        if (!wxObj) return this.origin(options);
        if (!wxObj.__networkLogs) wxObj.__networkLogs = [];

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
      });

      // Intercept uploadFile
      await miniProgram.mockWxMethod('uploadFile', function(this: any, options: any) {
        // @ts-ignore
        const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;
        if (!wxObj) return this.origin(options);
        if (!wxObj.__networkLogs) wxObj.__networkLogs = [];

        const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const startTime = Date.now();

        const originalSuccess = options.success;
        options.success = function(res: any) {
          wxObj.__networkLogs.push({
            id: requestId,
            type: 'uploadFile',
            url: options.url,
            statusCode: res.statusCode,
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
            error: err.errMsg || String(err),
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            success: false
          });
          if (originalFail) originalFail(err);
        };

        return this.origin(options);
      });

      // Intercept downloadFile
      await miniProgram.mockWxMethod('downloadFile', function(this: any, options: any) {
        // @ts-ignore
        const wxObj = (typeof wx !== 'undefined' ? wx : null) as any;
        if (!wxObj) return this.origin(options);
        if (!wxObj.__networkLogs) wxObj.__networkLogs = [];

        const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const startTime = Date.now();

        const originalSuccess = options.success;
        options.success = function(res: any) {
          wxObj.__networkLogs.push({
            id: requestId,
            type: 'downloadFile',
            url: options.url,
            statusCode: res.statusCode,
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
            error: err.errMsg || String(err),
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            success: false
          });
          if (originalFail) originalFail(err);
        };

        return this.origin(options);
      });

      // Intercept Mpx framework $xfetch (sync injection with wx.request to improve first request capture rate)
      await miniProgram.evaluate(function() {
        // @ts-ignore - wx is available in WeChat miniprogram environment
        if (typeof wx === 'undefined') return;

        // @ts-ignore
        wx.__networkLogs = wx.__networkLogs || [];

        // Detect Mpx framework
        // @ts-ignore - getApp is available in WeChat miniprogram environment
        const app = typeof getApp !== 'undefined' ? getApp() : null;
        const hasMpxFetch = app &&
                            app.$xfetch &&
                            app.$xfetch.interceptors &&
                            typeof app.$xfetch.interceptors.request.use === 'function';

        // Debug logging
        // @ts-ignore - Output debug info in runtime environment
        const debugInfo = {
          // @ts-ignore
          hasGetApp: typeof getApp !== 'undefined',
          hasApp: !!app,
          has$xfetch: !!(app && app.$xfetch),
          hasInterceptors: !!(app && app.$xfetch && app.$xfetch.interceptors),
          hasMpxFetch: hasMpxFetch
        };
        console.log('[MCP-DEBUG] Mpx detection:', debugInfo);

        // Force install Mpx interceptor (no flag check, reinstall each time to override old ones)
        // This resolves issues with residual flags when miniprogram is not reloaded
        // @ts-ignore
        if (hasMpxFetch) {
          console.log('[MCP] Installing Mpx $xfetch interceptor (force override)...');

          // Install Mpx request interceptor
          // @ts-ignore
          app.$xfetch.interceptors.request.use(function(config: any) {
            const requestId = 'mpx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            const startTime = Date.now();

            config.__mcp_requestId = requestId;
            config.__mcp_startTime = startTime;

            // @ts-ignore
            wx.__networkLogs.push({
              id: requestId,
              type: 'request',
              method: config.method || 'GET',
              url: config.url,
              headers: config.header || config.headers,
              data: config.data,
              params: config.params,
              timestamp: new Date().toISOString(),
              source: 'getApp().$xfetch',
              phase: 'request'
            });

            return config;
          });

          // Install Mpx response interceptor
          // @ts-ignore
          app.$xfetch.interceptors.response.use(
            function onSuccess(response: any) {
              const requestId = response.requestConfig?.__mcp_requestId;
              const startTime = response.requestConfig?.__mcp_startTime || Date.now();

              // @ts-ignore
              wx.__networkLogs.push({
                id: requestId,
                type: 'response',
                statusCode: response.status,
                data: response.data,
                headers: response.header || response.headers,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                source: 'getApp().$xfetch',
                phase: 'response',
                success: true
              });

              return response;
            },
            function onError(error: any) {
              const requestId = error.requestConfig?.__mcp_requestId;
              const startTime = error.requestConfig?.__mcp_startTime || Date.now();

              // @ts-ignore
              wx.__networkLogs.push({
                id: requestId,
                type: 'response',
                statusCode: error.status || error.statusCode,
                error: error.message || error.errMsg || String(error),
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                source: 'getApp().$xfetch',
                phase: 'response',
                success: false
              });

              throw error;
            }
          );

          console.log('[MCP] Mpx $xfetch interceptor installation completed');
        }

        // @ts-ignore
        wx.__networkInterceptorsInstalled = true;
      });

      console.log('[connectDevtools] Network monitoring auto-started (Mpx framework support included)');
    } catch (err) {
      console.warn('[connectDevtools] Network monitoring startup failed:', err);
    }

    return {
      miniProgram,
      currentPage,
      pagePath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to WeChat DevTools: ${errorMessage}`);
  }
}

/**
 * Smart connection to WeChat DevTools (optimized version)
 * Supports multiple connection modes and intelligent fallback
 *
 * @param options Enhanced connection options
 * @returns Detailed connection result
 */
export async function connectDevtoolsEnhanced(
  options: EnhancedConnectOptions
): Promise<DetailedConnectResult> {
  const {
    mode = 'auto',
    fallbackMode = true,
    healthCheck = true,
    verbose = false
  } = options;

  const startTime = Date.now();

  // Validate project path (unified validation before all modes)
  if (!options.projectPath) {
    throw new Error("Project path is required");
  }

  // Resolve and validate project path
  let resolvedProjectPath = options.projectPath;
  if (options.projectPath.startsWith('@playground/')) {
    const relativePath = options.projectPath.replace('@playground/', 'playground/');
    resolvedProjectPath = path.resolve(process.cwd(), relativePath);
  } else if (!path.isAbsolute(options.projectPath)) {
    resolvedProjectPath = path.resolve(process.cwd(), options.projectPath);
  }

  if (!fs.existsSync(resolvedProjectPath)) {
    throw new Error(`Project path '${resolvedProjectPath}' doesn't exist`);
  }

  if (verbose) {
    console.log(`Starting connection to WeChat DevTools, mode: ${mode}`);
    console.log(`Project path: ${resolvedProjectPath}`);
  }

  try {
    switch (mode) {
      case 'auto':
        return await intelligentConnect(options, startTime);
      case 'connect':
        return await connectMode(options, startTime);
      case 'launch':
        return await launchMode(options, startTime);
      default:
        throw new Error(`Unsupported connection mode: ${mode}`);
    }
  } catch (error) {
    if (verbose) {
      console.error(`Connection failed:`, error);
    }
    throw error;
  }
}

/**
 * Determine if error is a session conflict error resolvable via connectMode
 */
function isSessionConflictError(error: any): boolean {
  if (error instanceof DevToolsConnectionError) {
    return error.details?.reason === 'session_conflict';
  }
  const message = error?.message || '';
  return message.includes('already') ||
         message.includes('session') ||
         message.includes('conflict') ||
         message.includes('automation');
}

/**
 * Intelligent connection logic (optimized version)
 *
 * Strategy description:
 * 1. Use launchMode by default (relies on automator.launch intelligent handling)
 *    - automator.launch auto-detects IDE status and project matching
 *    - Auto-reuses existing sessions or opens new projects
 * 2. Only fallback to connectMode on specific errors like session conflicts
 * 3. Removed complex port detection and project validation logic (delegated to official library)
 */
async function intelligentConnect(
  options: EnhancedConnectOptions,
  startTime: number
): Promise<DetailedConnectResult> {
  if (options.verbose) {
    console.log('🎯 Intelligent connection strategy: prefer launchMode (auto-handle project validation and session reuse)');
  }

  try {
    // Use launchMode by default
    // automator.launch() auto-handles:
    // 1. Detect if IDE is running
    // 2. Verify project path matches
    // 3. Reuse existing session or open new project
    return await launchMode(options, startTime);
  } catch (error) {
    if (options.verbose) {
      console.log('⚠️ launchMode failed, analyzing error type...');
    }

    // Only fallback to connectMode on specific recoverable errors
    if (options.fallbackMode && isSessionConflictError(error)) {
      if (options.verbose) {
        console.log('🔄 Detected session conflict, attempting fallback to connectMode');
      }
      return await connectMode(options, startTime);
    }

    // Other errors throw directly
    throw error;
  }
}

/**
 * Connect mode: two-phase connection
 */
async function connectMode(
  options: EnhancedConnectOptions,
  startTime: number
): Promise<DetailedConnectResult> {
  try {
    // Phase 1: CLI startup
    const startupResult = await executeWithDetailedError(
      () => startupPhase(options),
      'startup'
    );

    // Phase 2: WebSocket connection
    const connectionResult = await executeWithDetailedError(
      () => connectionPhase(options, startupResult),
      'connection'
    );

    // Health check
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (options.healthCheck) {
      healthStatus = await executeWithDetailedError(
        () => performHealthCheck(connectionResult.miniProgram),
        'health_check'
      );
    }

    return {
      ...connectionResult,
      connectionMode: 'connect',
      startupTime: Date.now() - startTime,
      healthStatus,
      processInfo: startupResult.processInfo
    };
  } catch (error) {
    // Check if session conflict error
    if (error instanceof DevToolsConnectionError &&
        error.phase === 'startup' &&
        error.details?.reason === 'session_conflict') {

      if (options.verbose) {
        console.log('🔄 Detected session conflict, auto-fallback to traditional connection mode (launch)...');
      }

      // If fallback allowed, auto-use launch mode
      if (options.fallbackMode) {
        return await launchMode(options, startTime);
      }
    }

    // Other errors throw directly
    throw error;
  }
}

/**
 * Launch mode: traditional connection method
 */
async function launchMode(
  options: EnhancedConnectOptions,
  startTime: number
): Promise<DetailedConnectResult> {
  const connectOptions: ConnectOptions = {
    projectPath: options.projectPath,
    cliPath: options.cliPath,
    port: options.autoPort || options.port,
    autoAudits: options.autoAudits
  };

  const result = await connectDevtools(connectOptions);

  // Health check
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (options.healthCheck) {
    healthStatus = await executeWithDetailedError(
      () => performHealthCheck(result.miniProgram),
      'health_check'
    );
  }

  return {
    ...result,
    connectionMode: 'launch',
    startupTime: Date.now() - startTime,
    healthStatus
  };
}

/**
 * Startup phase: start automation using CLI command
 */
async function startupPhase(options: EnhancedConnectOptions): Promise<StartupResult> {
  const port = options.autoPort || 9420;
  const cliCommand = buildCliCommand(options);

  if (options.verbose) {
    console.log('Executing CLI command:', cliCommand.join(' '));
  }

  // Execute CLI command
  const process = await executeCliCommand(cliCommand);

  // Wait for WebSocket service to be ready
  await waitForWebSocketReady(port, options.timeout || 45000, options.verbose);

  return {
    processInfo: {
      pid: process.pid!,
      port
    },
    startTime: Date.now()
  };
}

/**
 * Connection phase: connect to WebSocket
 */
async function connectionPhase(
  options: EnhancedConnectOptions,
  startupResult: StartupResult
): Promise<ConnectResult> {
  const wsEndpoint = `ws://localhost:${startupResult.processInfo.port}`;

  if (options.verbose) {
    console.log('Connecting to WebSocket endpoint:', wsEndpoint);
  }

  // Connect to WebSocket endpoint
  const miniProgram = await connectWithRetry(wsEndpoint, 3);

  // Get current page
  const currentPage = await miniProgram.currentPage();
  if (!currentPage) {
    throw new Error('Unable to get current page');
  }

  const pagePath = await currentPage.path;

  return {
    miniProgram,
    currentPage,
    pagePath
  };
}

/**
 * Build CLI command
 */
function buildCliCommand(options: EnhancedConnectOptions): string[] {
  const cliPath = options.cliPath || findDefaultCliPath();
  const resolvedProjectPath = resolveProjectPath(options.projectPath);

  const args = ['auto', '--project', resolvedProjectPath];

  // Use correct port parameter name (should be --auto-port not --port)
  if (options.autoPort) {
    args.push('--auto-port', options.autoPort.toString());
  }

  // Remove unsupported --auto-account parameter
  // autoAccount parameter not shown in official CLI help, likely deprecated
  if (options.autoAccount) {
    // Keep interface compatibility but don't pass to CLI
    console.warn('autoAccount parameter may not be supported, ignored');
  }

  if (options.verbose) {
    args.push('--debug');
  }

  return [cliPath, ...args];
}

/**
 * Find default CLI path
 */
function findDefaultCliPath(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
  } else if (platform === 'win32') {
    return 'C:/Program Files (x86)/Tencent/WeChat Web Developer Tools/cli.bat';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Resolve project path
 */
function resolveProjectPath(projectPath: string): string {
  if (projectPath.startsWith('@playground/')) {
    const relativePath = projectPath.replace('@playground/', 'playground/');
    return path.resolve(process.cwd(), relativePath);
  } else if (!path.isAbsolute(projectPath)) {
    return path.resolve(process.cwd(), projectPath);
  }
  return projectPath;
}

/**
 * Execute CLI command
 */
async function executeCliCommand(command: string[]): Promise<ChildProcess> {
  const [cliPath, ...args] = command;

  return new Promise((resolve, reject) => {
    const process = spawn(cliPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';
    let resolved = false;

    if (process.stdout) {
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[CLI stdout]:', text.trim());
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[CLI stderr]:', text.trim());

        // Detect port conflict error
        if (text.includes('must be restarted on port')) {
          const match = text.match(/started on .+:(\d+) and must be restarted on port (\d+)/);
          if (match) {
            const [, currentPort, requestedPort] = match;
            if (!resolved) {
              resolved = true;
              process.kill();
              reject(new Error(
                `Port conflict: IDE already running on port ${currentPort}, but requested port is ${requestedPort}.\n` +
                `Solutions:\n` +
                `1. Use current port: autoPort: ${currentPort}\n` +
                `2. Close WeChat DevTools and reconnect`
              ));
            }
          }
        }

        // Detect automation session conflict error
        if ((text.includes('automation') || text.includes('自动化')) &&
            (text.includes('already') || text.includes('exists') || text.includes('已存在'))) {
          if (!resolved) {
            resolved = true;
            process.kill();

            // Create special session conflict error, allow upper layer to handle fallback
            const sessionConflictError = new DevToolsConnectionError(
              `Automation session conflict: WeChat DevTools already has active automation session`,
              'startup',
              undefined,
              {
                reason: 'session_conflict',
                suggestFallback: true,
                details: `Possible reasons:\n` +
                  `1. Previously used connect_devtools (traditional mode) with established connection\n` +
                  `2. Other programs using automation features\n` +
                  `Solutions:\n` +
                  `1. Use established connection (tool auto-detects and reuses)\n` +
                  `2. Close WeChat DevTools and reopen\n` +
                  `3. Use connect_devtools to continue in traditional mode`
              }
            );
            reject(sessionConflictError);
          }
        }

        // Detect CLI command failure (generic)
        if (text.includes('error') || text.includes('failed') || text.includes('失败')) {
          if (!resolved && text.length > 10) { // Ensure not false positive
            console.log('[CLI warning] Detected potential error:', text.trim());
          }
        }
      });
    }

    process.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`CLI command execution failed: ${error.message}`));
      }
    });

    process.on('exit', (code, signal) => {
      if (!resolved && code !== 0 && code !== null) {
        resolved = true;
        const errorMsg = errorOutput || `CLI process exited abnormally (code=${code}, signal=${signal})`;
        reject(new Error(errorMsg));
      }
    });

    process.on('spawn', () => {
      // CLI command started, return process object
      if (!resolved) {
        resolved = true;
        resolve(process);
      }
    });

    // Set timeout
    setTimeout(() => {
      if (!resolved && !process.killed) {
        resolved = true;
        process.kill();
        reject(new Error('CLI command startup timeout'));
      }
    }, 10000);
  });
}

/**
 * Wait for WebSocket service to be ready
 * @public Exported for test use
 */
export async function waitForWebSocketReady(port: number, timeout: number, verbose: boolean = false): Promise<void> {
  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = Math.ceil(timeout / 1000); // Check once per second

  if (verbose) {
    console.log(`Waiting for WebSocket service startup, port: ${port}, timeout: ${timeout}ms`);
  }

  while (Date.now() - startTime < timeout) {
    attempt++;

    if (verbose && attempt % 5 === 0) { // Show progress every 5 seconds
      const elapsed = Date.now() - startTime;
      console.log(`WebSocket detection progress: ${Math.round(elapsed/1000)}s / ${Math.round(timeout/1000)}s`);
    }

    // Try multiple detection methods
    const isReady = await checkDevToolsRunning(port) || await checkWebSocketDirectly(port);

    if (isReady) {
      if (verbose) {
        const elapsed = Date.now() - startTime;
        console.log(`WebSocket service started, elapsed: ${elapsed}ms`);
      }
      return;
    }

    // Progressive wait time: first 10 attempts every 500ms, then every 1000ms
    const waitTime = attempt <= 10 ? 500 : 1000;
    await sleep(waitTime);
  }

  const elapsed = Date.now() - startTime;
  throw new Error(`WebSocket service startup timeout, port: ${port}, waited: ${elapsed}ms`);
}

/**
 * Try WebSocket connection detection directly
 */
async function checkWebSocketDirectly(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Try to create WebSocket connection
      const ws = new (require('ws'))(`ws://localhost:${port}`);

      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

    } catch {
      resolve(false);
    }
  });
}

/**
 * Check if DevTools is running
 */
export async function checkDevToolsRunning(port: number): Promise<boolean> {
  try {
    // Try to connect to WebSocket to detect service status
    const response = await fetch(`http://localhost:${port}`, {
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Auto-detect the port currently running IDE
 * Returns detected port number, or null if not detected
 */
export async function detectIDEPort(verbose: boolean = false): Promise<number | null> {
  // Common ports list
  const commonPorts = [9420, 9440, 9430, 9450, 9460];

  if (verbose) {
    console.log('🔍 Detecting WeChat DevTools running port...');
  }

  // Strategy 1: Try common ports
  for (const port of commonPorts) {
    if (verbose) {
      console.log(`  Detecting port ${port}...`);
    }

    if (await checkDevToolsRunning(port)) {
      if (verbose) {
        console.log(`✅ Detected IDE running on port ${port}`);
      }
      return port;
    }
  }

  // Strategy 2: Use lsof command to check (macOS/Linux only)
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const { execSync } = await import('child_process');
      // Find ports occupied by WeChat DevTools, only check automation ports in 9400-9500 range
      const output = execSync(
        "lsof -i -P | grep wechat | grep LISTEN | awk '{print $9}' | cut -d: -f2 | grep '^94[0-9][0-9]$'",
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();

      if (output) {
        const ports = output.split('\n').map((p: string) => parseInt(p, 10)).filter((p: number) => !isNaN(p));

        if (verbose && ports.length > 0) {
          console.log(`  lsof detected ports: ${ports.join(', ')}`);
        }

        // Iterate over detected ports, verify if valid automation port
        for (const port of ports) {
          if (port >= 9400 && port <= 9500) {
            if (await checkDevToolsRunning(port)) {
              if (verbose) {
                console.log(`✅ Detected IDE running on port ${port} via lsof`);
              }
              return port;
            }
          }
        }
      }
    } catch (error) {
      // lsof failed, continue
      if (verbose) {
        console.log('  lsof detection failed');
      }
    }
  }

  if (verbose) {
    console.log('❌ No IDE running port detected');
  }

  return null;
}

/**
 * WebSocket connection with retry
 */
async function connectWithRetry(wsEndpoint: string, maxRetries: number): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await automator.connect({ wsEndpoint });
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      // Exponential backoff retry
      await sleep(1000 * Math.pow(2, i));
    }
  }
}

/**
 * Perform health check
 */
async function performHealthCheck(miniProgram: any): Promise<'healthy' | 'degraded' | 'unhealthy'> {
  try {
    // Check basic connection
    const currentPage = await miniProgram.currentPage();
    if (!currentPage) {
      return 'unhealthy';
    }

    // Check page response
    const path = await currentPage.path;
    if (!path) {
      return 'degraded';
    }

    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

/**
 * Execution wrapper with detailed error info
 */
async function executeWithDetailedError<T>(
  operation: () => Promise<T>,
  phase: 'startup' | 'connection' | 'health_check'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const originalError = error instanceof Error ? error : new Error(String(error));
    // Keep original error message, don't override with generic "phase failed"
    throw new DevToolsConnectionError(
      originalError.message,
      phase,
      originalError,
      { timestamp: new Date().toISOString() }
    );
  }
}

/**
 * Element snapshot interface
 */
export interface ElementSnapshot {
  uid: string;
  tagName: string;
  text?: string;
  attributes?: Record<string, string>;
  position?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Page snapshot interface
 */
export interface PageSnapshot {
  path: string;
  elements: ElementSnapshot[];
}

/**
 * Element map info interface
 * Used for precise element location on page
 */
export interface ElementMapInfo {
  selector: string;  // Basic selector, e.g. "button.cube-btn"
  index: number;     // Index in match results, starts from 0
}

/**
 * Generate unique identifier (uid) for element
 */
export async function generateElementUid(element: any, index: number): Promise<string> {
  try {
    const tagName = element.tagName;
    const className = await element.attribute('class').catch(() => '');
    const id = await element.attribute('id').catch(() => '');

    console.log(`[generateElementUid] tagName=${tagName}, className="${className}", id="${id}", index=${index}`);

    let selector = tagName;
    if (id) {
      selector += `#${id}`;
    } else if (className) {
      selector += `.${className.split(' ')[0]}`;
    } else {
      selector += `:nth-child(${index + 1})`;
    }

    console.log(`[generateElementUid] Generated UID: ${selector}`);
    return selector;
  } catch (error) {
    console.log(`[generateElementUid] Error:`, error);
    return `${element.tagName || 'unknown'}:nth-child(${index + 1})`;
  }
}

/**
 * Get page element snapshot
 *
 * @param page Page object
 * @returns Page snapshot and element map
 */
export async function getPageSnapshot(page: any): Promise<{
  snapshot: PageSnapshot;
  elementMap: Map<string, ElementMapInfo>;
}> {
  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    const elements: ElementSnapshot[] = [];
    const elementMap = new Map<string, ElementMapInfo>();

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Try multiple selector strategies to get elements
    let childElements: any[] = [];
    let usedStrategy = 'unknown';

    // Strategy 1: Prefer wildcard (fastest, single API call)
    try {
      childElements = await page.$$('*');
      if (childElements.length > 0) {
        usedStrategy = 'wildcard(*)';
        console.log(`✅ Strategy 1 success: wildcard query obtained ${childElements.length} elements`);
      }
    } catch (error) {
      console.warn('⚠️ Strategy 1 failed (*)', error);
    }

    // Strategy 2: Degrade to common component selectors (only if strategy 1 fails)
    if (childElements.length === 0) {
      console.log('🔄 Strategy 1 no results, degrading to strategy 2 (common component selectors)');
      const commonSelectors = [
        'view', 'text', 'button', 'image', 'input', 'textarea', 'picker', 'switch',
        'slider', 'scroll-view', 'swiper', 'icon', 'rich-text', 'progress',
        'navigator', 'form', 'checkbox', 'radio', 'cover-view', 'cover-image'
      ];

      for (const selector of commonSelectors) {
        try {
          const elements = await page.$$(selector);
          childElements.push(...elements);
          if (elements.length > 0) {
            console.log(`  - ${selector}: ${elements.length} elements`);
          }
        } catch (error) {
          // Ignore individual selector failures
        }
      }

      if (childElements.length > 0) {
        usedStrategy = 'common-selectors';
        console.log(`✅ Strategy 2 success: obtained ${childElements.length} elements`);
      }
    }

    // Strategy 3: Finally try hierarchical selectors
    if (childElements.length === 0) {
      console.log('🔄 Strategy 2 no results, degrading to strategy 3 (hierarchical selectors)');
      try {
        const rootElements = await page.$$('page > *');
        childElements = rootElements;
        if (childElements.length > 0) {
          usedStrategy = 'hierarchical(page>*)';
          console.log(`✅ Strategy 3 success: obtained ${childElements.length} elements`);
        }
      } catch (error) {
        console.warn('⚠️ Strategy 3 failed (page > *)', error);
      }
    }

    if (childElements.length === 0) {
      console.warn('❌ All strategies failed to obtain elements');
      return {
        snapshot: { path: await page.path, elements: [] },
        elementMap: new Map()
      };
    }

    console.log(`📊 Finally obtained ${childElements.length} elements (strategy: ${usedStrategy})`);

    // Track element count for each base selector
    const selectorIndexMap = new Map<string, number>();

    // Optimization: batch parallel processing of element attributes
    const startTime = Date.now();

    for (let i = 0; i < childElements.length; i++) {
      const element = childElements[i];
      try {
        // 🚀 Optimization 1: Use Promise.allSettled to parallel get all element properties
        // Reduce API call round trips: from 6 serial → 1 parallel
        const [
          tagNameResult,
          textResult,
          classResult,
          idResult,
          sizeResult,
          offsetResult
        ] = await Promise.allSettled([
          Promise.resolve(element.tagName || 'unknown'),
          element.text().catch(() => ''),
          element.attribute('class').catch(() => ''),
          element.attribute('id').catch(() => ''),
          element.size().catch(() => null),
          element.offset().catch(() => null)
        ]);

        // Extract results
        const tagName = tagNameResult.status === 'fulfilled' ? tagNameResult.value : 'unknown';
        const text = textResult.status === 'fulfilled' ? textResult.value : '';
        const className = classResult.status === 'fulfilled' ? classResult.value : '';
        const id = idResult.status === 'fulfilled' ? idResult.value : '';
        const size = sizeResult.status === 'fulfilled' ? sizeResult.value : null;
        const offset = offsetResult.status === 'fulfilled' ? offsetResult.value : null;

        // Generate UID (use obtained tagName, className, id, avoid redundant queries)
        let selector = tagName;
        if (id) {
          selector += `#${id}`;
        } else if (className) {
          selector += `.${className.split(' ')[0]}`;
        } else {
          selector += `:nth-child(${i + 1})`;
        }

        const uid = selector;

        // Build snapshot
        const snapshot: ElementSnapshot = {
          uid,
          tagName,
        };

        // Add text content
        if (text && text.trim()) {
          snapshot.text = text.trim();
        }

        // Add position info
        if (size && offset) {
          snapshot.position = {
            left: offset.left,
            top: offset.top,
            width: size.width,
            height: size.height
          };
        }

        // Add attribute info (optional, not collected currently)
        // If attributes needed, add more attribute queries in Promise.allSettled above

        elements.push(snapshot);

        // Generate queryable base selector
        let baseSelector = tagName;
        if (id) {
          baseSelector = `${tagName}#${id}`;
        } else if (className) {
          baseSelector = `${tagName}.${className.split(' ')[0]}`;
        }

        // Calculate element index for this selector (incremental count)
        const currentIndex = selectorIndexMap.get(baseSelector) || 0;
        selectorIndexMap.set(baseSelector, currentIndex + 1);

        // Store ElementMapInfo
        elementMap.set(uid, {
          selector: baseSelector,
          index: currentIndex
        });

      } catch (error) {
        console.warn(`⚠️ Error processing element ${i}:`, error);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Element processing time: ${processingTime}ms (average ${(processingTime / childElements.length).toFixed(2)}ms/element)`);

    const pagePath = await page.path;
    const snapshot: PageSnapshot = {
      path: pagePath,
      elements
    };

    return { snapshot, elementMap };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get page snapshot: ${errorMessage}`);
  }
}

/**
 * Click element options interface
 */
export interface ClickOptions {
  uid: string;
  dblClick?: boolean;
}

/**
 * Click page element
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Click options
 */
export async function clickElement(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: ClickOptions
): Promise<void> {
  const { uid, dblClick = false } = options;

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      throw new Error(`Cannot find element with uid ${uid}, please get page snapshot first`);
    }

    console.log(`[Click] Ready to click element - UID: ${uid}, Selector: ${mapInfo.selector}, Index: ${mapInfo.index}`);

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      throw new Error(`Cannot find element with selector ${mapInfo.selector}`);
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      throw new Error(`Element index ${mapInfo.index} out of range, found ${elements.length} elements`);
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      throw new Error(`Cannot get element at index ${mapInfo.index}`);
    }

    // Record page path before click
    const beforePath = await page.path;
    console.log(`[Click] Page before click: ${beforePath}`);

    // Execute click
    await element.tap();
    console.log(`[Click] Executed tap() operation`);

    // If double click, click again
    if (dblClick) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
      await element.tap();
      console.log(`[Click] Executed second tap() (double-click)`);
    }

    // Wait a moment for page to respond
    await new Promise(resolve => setTimeout(resolve, 300));

    // Record page path after click
    try {
      const afterPath = await page.path;
      console.log(`[Click] Page after click: ${afterPath}`);
      if (beforePath !== afterPath) {
        console.log(`[Click] ✅ Page switched: ${beforePath} → ${afterPath}`);
      } else {
        console.log(`[Click] ⚠️ Page not switched, may be same-page operation or navigation delay`);
      }
    } catch (error) {
      console.warn(`[Click] Cannot get page path after click:`, error);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Click] Click failed:`, error);
    throw new Error(`Failed to click element: ${errorMessage}`);
  }
}

/**
 * Screenshot options interface
 */
export interface ScreenshotOptions {
  path?: string;
}

/**
 * Page screenshot
 *
 * @param miniProgram MiniProgram object
 * @param options Screenshot options
 * @returns If path not specified, returns base64 data; otherwise returns undefined
 */
export async function takeScreenshot(
  miniProgram: any,
  options: ScreenshotOptions = {}
): Promise<string | undefined> {
  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    const { path } = options;

    // Ensure page is fully loaded and stable
    try {
      console.log('Getting current page and waiting for stability...')
      const currentPage = await miniProgram.currentPage();
      if (currentPage && typeof currentPage.waitFor === 'function') {
        // Wait for page stability, increase wait time
        await currentPage.waitFor(1000);
        console.log('Page wait completed')
      }
    } catch (waitError) {
      console.warn('Page wait failed, continue trying screenshot:', waitError)
    }

    // Retry mechanism for screenshot
    let result: string | undefined
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Screenshot attempt ${attempt}/3`)
        if (path) {
          // Save to specified path
          await miniProgram.screenshot({ path });
          result = undefined
          console.log(`Screenshot saved successfully: ${path}`)
          break
        } else {
          // Return base64 data
          const base64Data = await miniProgram.screenshot();
          console.log('Screenshot API call completed, checking return data...')
          if (base64Data && typeof base64Data === 'string' && base64Data.length > 0) {
            result = base64Data
            console.log(`Screenshot successful, data length: ${base64Data.length}`)
            break
          } else {
            throw new Error(`Screenshot returned invalid data: ${typeof base64Data}, length: ${base64Data ? base64Data.length : 'null'}`)
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`Screenshot attempt ${attempt} failed:`, lastError.message)

        if (attempt < 3) {
          // Wait longer before retry, let page stabilize
          console.log(`Waiting ${1000 + attempt * 500}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, 1000 + attempt * 500))
        }
      }
    }

    if (!result && !path) {
      const troubleshootingTips = `

⚠️ Screenshot troubleshooting tips:
1. Ensure WeChat DevTools is in **simulator mode** (not device debug)
2. Check tool settings:
   - Settings → Security Settings → Service Port ✅
   - Settings → General Settings → Automation Test ✅
3. Check macOS system permissions:
   - System Preferences → Security & Privacy → Privacy → Screen Recording
   - Ensure WeChat DevTools is in allow list
4. Try restarting WeChat DevTools
5. See detailed documentation: docs/SCREENSHOT_ISSUE.md

Last error: ${lastError?.message || 'Unknown error'}`;

      throw new Error(`Screenshot failed, retried 3 times${troubleshootingTips}`)
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // If error message already contains troubleshooting tips, throw directly
    if (errorMessage.includes('troubleshooting')) {
      throw error;
    }
    // Otherwise add brief tip
    throw new Error(`${errorMessage}\n\nTip: See docs/SCREENSHOT_ISSUE.md for detailed troubleshooting methods`);
  }
}

/**
 * Query result interface
 */
export interface QueryResult {
  uid: string;
  tagName: string;
  text?: string;
  attributes?: Record<string, string>;
  position?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Query element options interface
 */
export interface QueryOptions {
  selector: string;
}

/**
 * Query page elements by selector
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Query options
 * @returns Array of matched element info
 */
export async function queryElements(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: QueryOptions
): Promise<QueryResult[]> {
  const { selector } = options;

  if (!selector || typeof selector !== 'string' || selector.trim() === '') {
    throw new Error("Selector cannot be empty");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find elements by selector
    const elements = await page.$$(selector);
    const results: QueryResult[] = [];

    // Track UID conflicts
    const uidCounter = new Map<string, number>();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      try {
        // Use generateElementUid to generate base UID
        const baseUid = await generateElementUid(element, i);

        // Detect UID conflicts and add [N] suffix
        const count = uidCounter.get(baseUid) || 0;
        uidCounter.set(baseUid, count + 1);

        // First element no suffix, subsequent elements add [N] suffix
        const uid = count === 0 ? baseUid : `${baseUid}[${count + 1}]`;

        const result: QueryResult = {
          uid,
          tagName: element.tagName || 'unknown',
        };

        // Get element text
        try {
          const text = await element.text();
          if (text && text.trim()) {
            result.text = text.trim();
          }
        } catch (error) {
          // Ignore elements that can't get text
        }

        // Get element position info
        try {
          const [size, offset] = await Promise.all([
            element.size(),
            element.offset()
          ]);

          result.position = {
            left: offset.left,
            top: offset.top,
            width: size.width,
            height: size.height
          };
        } catch (error) {
          // Ignore elements that can't get position
        }

        // Get common attributes
        try {
          const attributes: Record<string, string> = {};
          const commonAttrs = ['class', 'id', 'data-testid'];
          for (const attr of commonAttrs) {
            try {
              const value = await element.attribute(attr);
              if (value) {
                attributes[attr] = value;
              }
            } catch (error) {
              // Ignore non-existent attributes
            }
          }

          if (Object.keys(attributes).length > 0) {
            result.attributes = attributes;
          }
        } catch (error) {
          // Ignore attribute retrieval errors
        }

        results.push(result);

        // Populate elementMap: use original query selector and array index
        elementMap.set(uid, {
          selector: selector,  // Use original query selector, not baseUid
          index: i             // Use index position in query results
        });

      } catch (error) {
        console.warn(`Error processing element ${i}:`, error);
      }
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to query elements: ${errorMessage}`);
  }
}

/**
 * Wait conditions interface
 */
export interface WaitForOptions {
  selector?: string;     // Wait for element selector
  timeout?: number;      // Timeout (ms), default 5000ms
  text?: string;         // Wait for text match
  visible?: boolean;     // Wait for element visibility state
  disappear?: boolean;   // Wait for element to disappear
}

/**
 * Wait for condition to be satisfied
 *
 * @param page Page object
 * @param options Wait options
 * @returns Wait result
 */
export async function waitForCondition(
  page: any,
  options: WaitForOptions | number | string
): Promise<boolean> {
  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Handle simple numeric timeout
    if (typeof options === 'number') {
      await page.waitFor(options);
      return true;
    }

    // Handle simple selector string
    if (typeof options === 'string') {
      const startTime = Date.now();
      const timeout = 5000; // Default 5 second timeout

      while (Date.now() - startTime < timeout) {
        try {
          const element = await page.$(options);
          if (element) {
            return true;
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for element ${options}`);
    }

    // Handle complex wait condition object
    const {
      selector,
      timeout = 5000,
      text,
      visible,
      disappear = false
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        if (selector) {
          const element = await page.$(selector);

          if (disappear) {
            // Wait for element to disappear
            if (!element) {
              return true;
            }
          } else {
            // Wait for element to appear
            if (element) {
              // Check text match
              if (text) {
                try {
                  const elementText = await element.text();
                  if (!elementText || !elementText.includes(text)) {
                    throw new Error('Text not matching');
                  }
                } catch (error) {
                  throw new Error('Text not matching');
                }
              }

              // Check visibility
              if (visible !== undefined) {
                try {
                  const size = await element.size();
                  const isVisible = size.width > 0 && size.height > 0;
                  if (isVisible !== visible) {
                    throw new Error('Visibility not matching');
                  }
                } catch (error) {
                  throw new Error('Visibility not matching');
                }
              }

              return true;
            }
          }
        } else if (typeof timeout === 'number') {
          // Simple time wait
          await page.waitFor(timeout);
          return true;
        }
      } catch (error) {
        // Continue waiting until timeout
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Build error message
    let errorMsg = 'Timeout waiting for condition: ';
    if (selector) {
      errorMsg += `selector ${selector}`;
      if (disappear) errorMsg += ' disappear';
      if (text) errorMsg += ` contain text "${text}"`;
      if (visible !== undefined) errorMsg += ` ${visible ? 'visible' : 'hidden'}`;
    }
    throw new Error(errorMsg);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to wait for condition: ${errorMessage}`);
  }
}

/**
 * Text input options interface
 */
export interface InputTextOptions {
  uid: string;
  text: string;
  clear?: boolean;
  append?: boolean;
}

/**
 * Form control options interface
 */
export interface FormControlOptions {
  uid: string;
  value: any;
  trigger?: string;
}

/**
 * Get value options interface
 */
export interface GetValueOptions {
  uid: string;
  attribute?: string;
}

/**
 * Input text to element
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Input options
 */
export async function inputText(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: InputTextOptions
): Promise<void> {
  const { uid, text, clear = false, append = false } = options;

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      throw new Error(`Cannot find element with uid ${uid}, please get page snapshot first`);
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      throw new Error(`Cannot find element with selector ${mapInfo.selector}`);
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      throw new Error(`Element index ${mapInfo.index} out of range, found ${elements.length} elements`);
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      throw new Error(`Cannot get element at index ${mapInfo.index}`);
    }

    // Clear element (if needed)
    if (clear && !append) {
      await element.clear();
    }

    // Input text
    if (append) {
      // Append mode: get existing value first
      const currentValue = await element.value().catch(() => '');
      await element.input(currentValue + text);
    } else {
      await element.input(text);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to input text: ${errorMessage}`);
  }
}

/**
 * Get element value
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Get options
 * @returns Element value
 */
export async function getElementValue(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: GetValueOptions
): Promise<string> {
  const { uid, attribute } = options;

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      throw new Error(`Cannot find element with uid ${uid}, please get page snapshot first`);
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      throw new Error(`Cannot find element with selector ${mapInfo.selector}`);
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      throw new Error(`Element index ${mapInfo.index} out of range, found ${elements.length} elements`);
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      throw new Error(`Cannot get element at index ${mapInfo.index}`);
    }

    // Get value
    if (attribute) {
      return await element.attribute(attribute);
    } else {
      // Try to get value property, if fails get text
      try {
        return await element.value();
      } catch (error) {
        return await element.text();
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get element value: ${errorMessage}`);
  }
}

/**
 * Set form control value
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Set options
 */
export async function setFormControl(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: FormControlOptions
): Promise<void> {
  const { uid, value, trigger = 'change' } = options;

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      throw new Error(`Cannot find element with uid ${uid}, please get page snapshot first`);
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      throw new Error(`Cannot find element with selector ${mapInfo.selector}`);
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      throw new Error(`Element index ${mapInfo.index} out of range, found ${elements.length} elements`);
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      throw new Error(`Cannot get element at index ${mapInfo.index}`);
    }

    // Set value and trigger event
    await element.trigger(trigger, { value });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to set form control: ${errorMessage}`);
  }
}

/**
 * Assert result interface
 */
export interface AssertResult {
  passed: boolean;
  message: string;
  actual: any;
  expected: any;
  timestamp: number;
}

/**
 * Element existence assertion options interface
 */
export interface ExistenceAssertOptions {
  selector?: string;
  uid?: string;
  timeout?: number;
  shouldExist: boolean;
}

/**
 * Element state assertion options interface
 */
export interface StateAssertOptions {
  uid: string;
  visible?: boolean;
  enabled?: boolean;
  checked?: boolean;
  focused?: boolean;
}

/**
 * Content assertion options interface
 */
export interface ContentAssertOptions {
  uid: string;
  text?: string;
  textContains?: string;
  textMatches?: string;
  attribute?: { key: string; value: string };
}

/**
 * Assert element existence
 *
 * @param page Page object
 * @param options Assert options
 * @returns Assert result
 */
export async function assertElementExists(
  page: any,
  options: ExistenceAssertOptions
): Promise<AssertResult> {
  const { selector, uid, timeout = 5000, shouldExist } = options;

  if (!selector && !uid) {
    throw new Error("Must provide selector or uid parameter");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  const startTime = Date.now();
  let element = null;
  let actualExists = false;

  try {
    // Check element existence within timeout
    while (Date.now() - startTime < timeout) {
      try {
        if (selector) {
          element = await page.$(selector);
        } else if (uid) {
          // If only uid, need to get selector from elementMap first
          // Assume caller has correct mapping
          element = await page.$(uid);
        }

        actualExists = !!element;

        if (actualExists === shouldExist) {
          return {
            passed: true,
            message: `Assert passed: element ${shouldExist ? 'exists' : 'does not exist'}`,
            actual: actualExists,
            expected: shouldExist,
            timestamp: Date.now()
          };
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Continue checking until timeout
      }
    }

    // Return failure result after timeout
    return {
      passed: false,
      message: `Assert failed: expected element ${shouldExist ? 'exists' : 'does not exist'}, actual ${actualExists ? 'exists' : 'does not exist'}`,
      actual: actualExists,
      expected: shouldExist,
      timestamp: Date.now()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Assert execution failed: ${errorMessage}`,
      actual: null,
      expected: shouldExist,
      timestamp: Date.now()
    };
  }
}

/**
 * Assert element visibility
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Assert options
 * @returns Assert result
 */
export async function assertElementVisible(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: StateAssertOptions
): Promise<AssertResult> {
  const { uid, visible } = options;

  if (visible === undefined) {
    throw new Error("Must specify visible parameter");
  }

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with uid ${uid}`,
        actual: null,
        expected: visible,
        timestamp: Date.now()
      };
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with selector ${mapInfo.selector}`,
        actual: false,
        expected: visible,
        timestamp: Date.now()
      };
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      return {
        passed: false,
        message: `Assert failed: element index ${mapInfo.index} out of range, found ${elements.length} elements`,
        actual: false,
        expected: visible,
        timestamp: Date.now()
      };
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      return {
        passed: false,
        message: `Assert failed: cannot get element at index ${mapInfo.index}`,
        actual: false,
        expected: visible,
        timestamp: Date.now()
      };
    }

    // Check visibility
    const size = await element.size();
    const actualVisible = size.width > 0 && size.height > 0;

    const passed = actualVisible === visible;
    return {
      passed,
      message: passed
        ? `Assert passed: element ${visible ? 'visible' : 'not visible'}`
        : `Assert failed: expected element ${visible ? 'visible' : 'not visible'}, actual ${actualVisible ? 'visible' : 'not visible'}`,
      actual: actualVisible,
      expected: visible,
      timestamp: Date.now()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Assert execution failed: ${errorMessage}`,
      actual: null,
      expected: visible,
      timestamp: Date.now()
    };
  }
}

/**
 * Assert element text content
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Assert options
 * @returns Assert result
 */
export async function assertElementText(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: ContentAssertOptions
): Promise<AssertResult> {
  const { uid, text, textContains, textMatches } = options;

  if (!text && !textContains && !textMatches) {
    throw new Error("Must specify one of text, textContains or textMatches parameter");
  }

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with uid ${uid}`,
        actual: null,
        expected: text || textContains || textMatches,
        timestamp: Date.now()
      };
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with selector ${mapInfo.selector}`,
        actual: null,
        expected: text || textContains || textMatches,
        timestamp: Date.now()
      };
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      return {
        passed: false,
        message: `Assert failed: element index ${mapInfo.index} out of range, found ${elements.length} elements`,
        actual: null,
        expected: text || textContains || textMatches,
        timestamp: Date.now()
      };
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      return {
        passed: false,
        message: `Assert failed: cannot get element at index ${mapInfo.index}`,
        actual: null,
        expected: text || textContains || textMatches,
        timestamp: Date.now()
      };
    }

    // Get element text
    const actualText = await element.text();
    let passed = false;
    let expectedValue = '';
    let message = '';

    if (text) {
      // Exact match
      passed = actualText === text;
      expectedValue = text;
      message = passed
        ? `Assert passed: text exact match`
        : `Assert failed: expected text "${text}", actual "${actualText}"`;
    } else if (textContains) {
      // Contains match
      passed = actualText.includes(textContains);
      expectedValue = textContains;
      message = passed
        ? `Assert passed: text contains "${textContains}"`
        : `Assert failed: expected contains "${textContains}", actual text "${actualText}"`;
    } else if (textMatches) {
      // Regex match
      const regex = new RegExp(textMatches);
      passed = regex.test(actualText);
      expectedValue = textMatches;
      message = passed
        ? `Assert passed: text matches regex ${textMatches}`
        : `Assert failed: expected match regex ${textMatches}, actual text "${actualText}"`;
    }

    return {
      passed,
      message,
      actual: actualText,
      expected: expectedValue,
      timestamp: Date.now()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Assert execution failed: ${errorMessage}`,
      actual: null,
      expected: text || textContains || textMatches,
      timestamp: Date.now()
    };
  }
}

/**
 * Assert element attribute
 *
 * @param page Page object
 * @param elementMap Element map
 * @param options Assert options
 * @returns Assert result
 */
export async function assertElementAttribute(
  page: any,
  elementMap: Map<string, ElementMapInfo>,
  options: ContentAssertOptions
): Promise<AssertResult> {
  const { uid, attribute } = options;

  if (!attribute) {
    throw new Error("Must specify attribute parameter");
  }

  if (!uid) {
    throw new Error("Element uid is required");
  }

  if (!page) {
    throw new Error("Page object is required");
  }

  try {
    // Find element map info by uid
    const mapInfo = elementMap.get(uid);
    if (!mapInfo) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with uid ${uid}`,
        actual: null,
        expected: attribute.value,
        timestamp: Date.now()
      };
    }

    // Get all matching elements using selector
    const elements = await page.$$(mapInfo.selector);
    if (!elements || elements.length === 0) {
      return {
        passed: false,
        message: `Assert failed: cannot find element with selector ${mapInfo.selector}`,
        actual: null,
        expected: attribute.value,
        timestamp: Date.now()
      };
    }

    // Check if index is valid
    if (mapInfo.index >= elements.length) {
      return {
        passed: false,
        message: `Assert failed: element index ${mapInfo.index} out of range, found ${elements.length} elements`,
        actual: null,
        expected: attribute.value,
        timestamp: Date.now()
      };
    }

    // Get target element by index
    const element = elements[mapInfo.index];
    if (!element) {
      return {
        passed: false,
        message: `Assert failed: cannot get element at index ${mapInfo.index}`,
        actual: null,
        expected: attribute.value,
        timestamp: Date.now()
      };
    }

    // Get attribute value
    const actualValue = await element.attribute(attribute.key);
    const passed = actualValue === attribute.value;

    return {
      passed,
      message: passed
        ? `Assert passed: attribute ${attribute.key} value is "${attribute.value}"`
        : `Assert failed: expected attribute ${attribute.key} value is "${attribute.value}", actual "${actualValue}"`,
      actual: actualValue,
      expected: attribute.value,
      timestamp: Date.now()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      message: `Assert execution failed: ${errorMessage}`,
      actual: null,
      expected: attribute.value,
      timestamp: Date.now()
    };
  }
}

/**
 * Page navigation options interface
 */
export interface NavigateOptions {
  url: string;
  params?: Record<string, any>;
  waitForLoad?: boolean;
  timeout?: number;
}

/**
 * Navigate back options interface
 */
export interface NavigateBackOptions {
  delta?: number;
  waitForLoad?: boolean;
  timeout?: number;
}

/**
 * Tab switch options interface
 */
export interface SwitchTabOptions {
  url: string;
  index?: number;
  waitForLoad?: boolean;
  timeout?: number;
}

/**
 * Page state interface
 */
export interface PageStateOptions {
  expectPath?: string;
  expectTitle?: string;
}

/**
 * Page info interface
 */
export interface PageInfo {
  path: string;
  title?: string;
  query?: Record<string, any>;
}

/**
 * Navigate to specified page
 *
 * @param miniProgram MiniProgram object
 * @param options Navigation options
 */
export async function navigateToPage(
  miniProgram: any,
  options: NavigateOptions
): Promise<void> {
  const { url, params, waitForLoad = true, timeout = 10000 } = options;

  if (!url) {
    throw new Error("Page URL is required");
  }

  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    // Build full URL
    let fullUrl = url;
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      fullUrl += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Execute page navigation
    await miniProgram.navigateTo(fullUrl);

    // Wait for page to load
    if (waitForLoad) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const currentPage = await miniProgram.currentPage();
          if (currentPage) {
            const currentPath = await currentPage.path;
            // Check if navigated to target page
            if (currentPath.includes(url.split('?')[0])) {
              break;
            }
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to navigate page: ${errorMessage}`);
  }
}

/**
 * Navigate back to previous page
 *
 * @param miniProgram MiniProgram object
 * @param options Navigate back options
 */
export async function navigateBack(
  miniProgram: any,
  options: NavigateBackOptions = {}
): Promise<void> {
  const { delta = 1, waitForLoad = true, timeout = 5000 } = options;

  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    // Get current page path (to verify successful navigation back)
    let currentPath = '';
    try {
      const currentPage = await miniProgram.currentPage();
      currentPath = await currentPage.path;
    } catch (error) {
      // Ignore error getting current path
    }

    // Execute navigate back
    await miniProgram.navigateBack(delta);

    // Wait for page to load
    if (waitForLoad) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const newPage = await miniProgram.currentPage();
          if (newPage) {
            const newPath = await newPage.path;
            // Check if successfully navigated back (path changed)
            if (newPath !== currentPath) {
              break;
            }
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to navigate back: ${errorMessage}`);
  }
}

/**
 * Switch to Tab page
 *
 * @param miniProgram MiniProgram object
 * @param options Tab switch options
 */
export async function switchTab(
  miniProgram: any,
  options: SwitchTabOptions
): Promise<void> {
  const { url, waitForLoad = true, timeout = 5000 } = options;

  if (!url) {
    throw new Error("Tab page URL is required");
  }

  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    // Execute Tab switch
    await miniProgram.switchTab(url);

    // Wait for page to load
    if (waitForLoad) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const currentPage = await miniProgram.currentPage();
          if (currentPage) {
            const currentPath = await currentPage.path;
            // Check if switched to target Tab page
            if (currentPath.includes(url.split('?')[0])) {
              break;
            }
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to switch Tab: ${errorMessage}`);
  }
}

/**
 * Get current page info
 *
 * @param miniProgram MiniProgram object
 * @returns Page info
 */
export async function getCurrentPageInfo(
  miniProgram: any
): Promise<PageInfo> {
  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    const currentPage = await miniProgram.currentPage();
    if (!currentPage) {
      throw new Error("Unable to get current page");
    }

    const path = await currentPage.path;

    // Try to get page title and query params
    let title: string | undefined;
    let query: Record<string, any> | undefined;

    try {
      // Get page data (if available)
      const data = await currentPage.data();
      if (data) {
        title = data.title || data.navigationBarTitleText;
        query = data.query || data.options;
      }
    } catch (error) {
      // If unable to get page data, ignore error
    }

    return {
      path,
      title,
      query
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get page info: ${errorMessage}`);
  }
}

/**
 * Re-launch to specified page
 *
 * @param miniProgram MiniProgram object
 * @param options Navigation options
 */
export async function reLaunch(
  miniProgram: any,
  options: NavigateOptions
): Promise<void> {
  const { url, params, waitForLoad = true, timeout = 10000 } = options;

  if (!url) {
    throw new Error("Page URL is required");
  }

  if (!miniProgram) {
    throw new Error("MiniProgram object is required");
  }

  try {
    // Build full URL
    let fullUrl = url;
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      fullUrl += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Execute re-launch
    await miniProgram.reLaunch(fullUrl);

    // Wait for page to load
    if (waitForLoad) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          const currentPage = await miniProgram.currentPage();
          if (currentPage) {
            const currentPath = await currentPage.path;
            // Check if re-launched to target page
            if (currentPath.includes(url.split('?')[0])) {
              break;
            }
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to re-launch: ${errorMessage}`);
  }
}
