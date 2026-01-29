/**
 * Diagnostic tools
 * Help users debug connection and configuration issues
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import { existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Connection diagnostic tool
 */
export const diagnoseConnectionTool = defineTool({
  name: 'diagnose_connection',
  description: 'Diagnose WeChat DevTools connection issues, check configuration and environment',
  schema: z.object({
    projectPath: z.string().describe('Mini program project path to check'),
    verbose: z.boolean().optional().default(false).describe('Whether to output detailed diagnostic information'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { projectPath, verbose } = request.params;

    response.appendResponseLine('🔍 Starting WeChat DevTools connection diagnostics...');
    response.appendResponseLine('');

    // 1. Check parameter validity
    response.appendResponseLine('📋 1. Parameter Check');
    if (!projectPath || typeof projectPath !== 'string') {
      response.appendResponseLine('❌ projectPath parameter is invalid or missing');
      response.appendResponseLine('   Fix suggestion: Ensure a valid string path is passed');
      return;
    }
    response.appendResponseLine(`✅ projectPath parameter is valid: ${projectPath}`);

    // 2. Path resolution check
    response.appendResponseLine('');
    response.appendResponseLine('📁 2. Path Resolution Check');

    let resolvedPath = projectPath;
    if (projectPath.startsWith('@playground/')) {
      const relativePath = projectPath.replace('@playground/', 'playground/');
      resolvedPath = resolve(process.cwd(), relativePath);
      response.appendResponseLine(`🔄 Detected @playground/ format path`);
      response.appendResponseLine(`   Original path: ${projectPath}`);
      response.appendResponseLine(`   Resolved path: ${resolvedPath}`);
    } else if (!isAbsolute(projectPath)) {
      resolvedPath = resolve(process.cwd(), projectPath);
      response.appendResponseLine(`🔄 Detected relative path, converting to absolute path`);
      response.appendResponseLine(`   Original path: ${projectPath}`);
      response.appendResponseLine(`   Resolved path: ${resolvedPath}`);
    } else {
      response.appendResponseLine(`✅ Already an absolute path: ${resolvedPath}`);
    }

    // 3. Path existence check
    response.appendResponseLine('');
    response.appendResponseLine('🗂️ 3. Path Existence Check');
    if (!existsSync(resolvedPath)) {
      response.appendResponseLine(`❌ Project path does not exist: ${resolvedPath}`);
      response.appendResponseLine('   Fix suggestions:');
      response.appendResponseLine('   - Check if the path is spelled correctly');
      response.appendResponseLine('   - Ensure the project directory has been created');
      response.appendResponseLine('   - Use absolute paths to avoid relative path issues');
      return;
    }
    response.appendResponseLine(`✅ Project path exists: ${resolvedPath}`);

    // 4. Mini program project structure check
    response.appendResponseLine('');
    response.appendResponseLine('📦 4. Mini Program Project Structure Check');

    const appJsonPath = resolve(resolvedPath, 'app.json');
    const projectConfigPath = resolve(resolvedPath, 'project.config.json');

    const hasAppJson = existsSync(appJsonPath);
    const hasProjectConfig = existsSync(projectConfigPath);

    if (!hasAppJson) {
      response.appendResponseLine(`❌ Missing app.json file: ${appJsonPath}`);
    } else {
      response.appendResponseLine(`✅ Found app.json file: ${appJsonPath}`);
    }

    if (!hasProjectConfig) {
      response.appendResponseLine(`⚠️ Missing project.config.json file: ${projectConfigPath}`);
      response.appendResponseLine('   This may not affect automation, but it is recommended to configure this file');
    } else {
      response.appendResponseLine(`✅ Found project.config.json file: ${projectConfigPath}`);
    }

    if (!hasAppJson) {
      response.appendResponseLine('');
      response.appendResponseLine('❌ Project structure is incomplete, this is not a valid mini program project');
      response.appendResponseLine('   Fix suggestions:');
      response.appendResponseLine('   - Ensure you are pointing to the correct mini program project root directory');
      response.appendResponseLine('   - Mini program projects must contain an app.json file');
      return;
    }

    // 5. Connection status check
    response.appendResponseLine('');
    response.appendResponseLine('🔗 5. Current Connection Status Check');
    if (context.miniProgram) {
      response.appendResponseLine('✅ Connected to WeChat DevTools');
      if (context.currentPage) {
        try {
          const pagePath = await context.currentPage.path;
          response.appendResponseLine(`   Current page: ${pagePath}`);
        } catch (error) {
          response.appendResponseLine('⚠️ Failed to get current page information');
        }
      } else {
        response.appendResponseLine('⚠️ Connected but no current page information');
      }
    } else {
      response.appendResponseLine('❌ Not connected to WeChat DevTools');
    }

    // 6. Detailed information output (if verbose is enabled)
    if (verbose) {
      response.appendResponseLine('');
      response.appendResponseLine('🔧 6. Detailed Diagnostic Information');
      response.appendResponseLine(`   Current working directory: ${process.cwd()}`);
      response.appendResponseLine(`   Element map size: ${context.elementMap.size}`);
      response.appendResponseLine(`   Console monitoring status: ${context.consoleStorage.isMonitoring ? 'Active' : 'Inactive'}`);
      // Use new navigations structure to count messages
      const totalMessages = context.consoleStorage.navigations.reduce((sum, session) => sum + session.messages.length, 0);
      const totalExceptions = context.consoleStorage.navigations.reduce((sum, session) => sum + session.exceptions.length, 0);
      response.appendResponseLine(`   Console messages count: ${totalMessages}`);
      response.appendResponseLine(`   Exception messages count: ${totalExceptions}`);
    }

    // 7. Summary and suggestions
    response.appendResponseLine('');
    response.appendResponseLine('📝 Diagnostic Summary');
    if (hasAppJson && existsSync(resolvedPath)) {
      response.appendResponseLine('✅ Project configuration check passed, you can try to connect');
      response.appendResponseLine('');
      response.appendResponseLine('💡 Suggested connection command:');
      response.appendResponseLine(`connect_devtools(projectPath: "${resolvedPath}")`);
    } else {
      response.appendResponseLine('❌ Configuration issues found, please fix according to the above suggestions and try again');
    }

    // 8. Common issues and solutions
    response.appendResponseLine('');
    response.appendResponseLine('🛠️ Common Issues and Solutions');
    response.appendResponseLine('1. Path contains "undefined": Ensure you passed a valid projectPath parameter');
    response.appendResponseLine('2. Project path does not exist: Check path spelling and whether the directory has been created');
    response.appendResponseLine('3. Connection timeout: Ensure WeChat DevTools is open and automation is enabled');
    response.appendResponseLine('4. Permission issues: Enable CLI/HTTP call permissions in DevTools');
    response.appendResponseLine('5. Port conflicts: Try specifying a different port number');
  },
});

/**
 * Page element debugging tool
 */
export const debugPageElementsTool = defineTool({
  name: 'debug_page_elements',
  description: 'Debug page element retrieval issues, test different selector strategies',
  schema: z.object({
    testAllStrategies: z.boolean().optional().default(true).describe('Whether to test all selector strategies'),
    customSelector: z.string().optional().describe('Custom selector for testing'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { testAllStrategies, customSelector } = request.params;

    if (!context.currentPage) {
      throw new Error('Please connect to WeChat DevTools and get the current page first');
    }

    response.appendResponseLine('🔍 Starting page element debugging...');
    response.appendResponseLine('');

    const page = context.currentPage;

    try {
      // Get basic page information
      response.appendResponseLine('📱 Basic Page Information');
      try {
        const pagePath = await page.path;
        response.appendResponseLine(`   Page path: ${pagePath}`);
      } catch (error) {
        response.appendResponseLine(`   Failed to get page path: ${error}`);
      }

      // Wait for page load
      response.appendResponseLine('');
      response.appendResponseLine('⏱️ Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      response.appendResponseLine('   Page load wait completed');

      if (testAllStrategies) {
        response.appendResponseLine('');
        response.appendResponseLine('🧪 Testing Various Selector Strategies');

        // Strategy 1: Universal selectors
        response.appendResponseLine('');
        response.appendResponseLine('Strategy 1: Universal Selectors');
        const universalSelectors = ['*', 'body *', 'html *'];

        for (const selector of universalSelectors) {
          try {
            const elements = await page.$$(selector);
            response.appendResponseLine(`   ${selector}: ${elements.length} elements`);
          } catch (error) {
            response.appendResponseLine(`   ${selector}: Failed - ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Strategy 2: Mini program component selectors
        response.appendResponseLine('');
        response.appendResponseLine('Strategy 2: Mini Program Component Selectors');
        const miniProgramSelectors = [
          'view', 'text', 'button', 'image', 'input', 'textarea',
          'picker', 'switch', 'slider', 'scroll-view', 'swiper',
          'icon', 'rich-text', 'progress', 'navigator', 'form',
          'checkbox', 'radio', 'cover-view', 'cover-image'
        ];

        let totalElements = 0;
        for (const selector of miniProgramSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              response.appendResponseLine(`   ${selector}: ${elements.length} elements`);
              totalElements += elements.length;
            }
          } catch (error) {
            response.appendResponseLine(`   ${selector}: Failed - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        response.appendResponseLine(`   Total mini program components: ${totalElements} elements`);

        // Strategy 3: Hierarchy selectors
        response.appendResponseLine('');
        response.appendResponseLine('Strategy 3: Hierarchy Selectors');
        const hierarchySelectors = ['page > *', 'page view', 'page text', 'page button'];

        for (const selector of hierarchySelectors) {
          try {
            const elements = await page.$$(selector);
            response.appendResponseLine(`   ${selector}: ${elements.length} elements`);
          } catch (error) {
            response.appendResponseLine(`   ${selector}: Failed - ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Strategy 4: Attribute selectors
        response.appendResponseLine('');
        response.appendResponseLine('Strategy 4: Attribute Selectors');
        const attributeSelectors = ['[class]', '[id]', '[data-*]', '[wx:*]'];

        for (const selector of attributeSelectors) {
          try {
            const elements = await page.$$(selector);
            response.appendResponseLine(`   ${selector}: ${elements.length} elements`);
          } catch (error) {
            response.appendResponseLine(`   ${selector}: Failed - ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      // Custom selector test
      if (customSelector) {
        response.appendResponseLine('');
        response.appendResponseLine('🎯 Custom Selector Test');
        try {
          const elements = await page.$$(customSelector);
          response.appendResponseLine(`   ${customSelector}: ${elements.length} elements`);

          if (elements.length > 0 && elements.length <= 5) {
            response.appendResponseLine('   Element details:');
            for (let i = 0; i < elements.length; i++) {
              const element = elements[i];
              try {
                const tagName = element.tagName || 'unknown';
                const text = await element.text().catch(() => '');
                response.appendResponseLine(`     [${i}] ${tagName}${text ? ` - "${text.substring(0, 50)}"` : ''}`);
              } catch (error) {
                response.appendResponseLine(`     [${i}] Failed to get element information`);
              }
            }
          }
        } catch (error) {
          response.appendResponseLine(`   ${customSelector}: Failed - ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Diagnostic suggestions
      response.appendResponseLine('');
      response.appendResponseLine('💡 Diagnostic Suggestions');
      response.appendResponseLine('1. If all selectors return 0 elements, please check:');
      response.appendResponseLine('   - Whether the page has fully loaded');
      response.appendResponseLine('   - Whether you are on the correct page');
      response.appendResponseLine('   - Whether WeChat DevTools automation permissions are correctly configured');
      response.appendResponseLine('');
      response.appendResponseLine('2. If only specific components work, it is recommended to:');
      response.appendResponseLine('   - Use specific component selectors instead of universal selectors');
      response.appendResponseLine('   - Combine multiple selectors to get a complete list of elements');
      response.appendResponseLine('');
      response.appendResponseLine('3. Optimization suggestions:');
      response.appendResponseLine('   - Add class or id attributes to key elements');
      response.appendResponseLine('   - Use data-testid attributes to facilitate automated testing');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Error occurred during debugging: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Environment check tool
 */
export const checkEnvironmentTool = defineTool({
  name: 'check_environment',
  description: 'Check WeChat DevTools automation environment configuration',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    response.appendResponseLine('🌍 Checking WeChat DevTools automation environment...');
    response.appendResponseLine('');

    // Check dependencies
    response.appendResponseLine('📦 Dependency Check');
    try {
      const automator = await import('miniprogram-automator');
      response.appendResponseLine('✅ miniprogram-automator module loaded successfully');
    } catch (error) {
      response.appendResponseLine('❌ miniprogram-automator module failed to load');
      response.appendResponseLine(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      response.appendResponseLine('   Fix suggestion: npm install miniprogram-automator');
      return;
    }

    // Check MCP server configuration
    response.appendResponseLine('');
    response.appendResponseLine('⚙️ MCP Server Configuration Suggestions');
    response.appendResponseLine('1. Legacy server (compatibility):');
    response.appendResponseLine('   "command": "/path/to/weixin-devtools-mcp/build/index.js"');
    response.appendResponseLine('');
    response.appendResponseLine('2. New modular server (recommended):');
    response.appendResponseLine('   "command": "/path/to/weixin-devtools-mcp/build/server.js"');
    response.appendResponseLine('');
    response.appendResponseLine('💡 Configuration file location:');
    response.appendResponseLine('   macOS: ~/Library/Application Support/Claude/claude_desktop_config.json');
    response.appendResponseLine('   Windows: %APPDATA%/Claude/claude_desktop_config.json');

    // Check tool availability
    response.appendResponseLine('');
    response.appendResponseLine('🔧 Available Tools Statistics');
    response.appendResponseLine(`   Total number of tools: ${context ? 'MCP server initialized' : 'MCP server not initialized'}`);

    if (context.miniProgram) {
      response.appendResponseLine('   Connection status: Connected');
    } else {
      response.appendResponseLine('   Connection status: Not connected');
    }

    response.appendResponseLine('');
    response.appendResponseLine('✅ Environment check completed');
  },
});
