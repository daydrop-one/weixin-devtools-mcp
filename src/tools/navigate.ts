/**
 * Page Navigation Tools
 * Provides Mini Program page navigation, back, tab switching and other navigation functions
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import {
  navigateToPage,
  navigateBack,
  switchTab,
  getCurrentPageInfo,
  reLaunch,
  type NavigateOptions,
  type NavigateBackOptions,
  type SwitchTabOptions,
  type PageInfo
} from '../tools.js';

/**
 * Navigate to specified page
 */
export const navigateToTool = defineTool({
  name: 'navigate_to',
  description: 'Navigate to specified page',
  schema: z.object({
    url: z.string().describe('Target page path'),
    params: z.record(z.string(), z.any()).optional().describe('Page parameters (query parameters)'),
    waitForLoad: z.boolean().optional().default(true).describe('Whether to wait for page load completion, default true'),
    timeout: z.number().optional().default(10000).describe('Wait timeout in milliseconds, default 10000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { url, params, waitForLoad, timeout } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const options: NavigateOptions = {
        url,
        params,
        waitForLoad,
        timeout
      };

      await navigateToPage(context.miniProgram, options);

      response.appendResponseLine(`Page navigation successful`);
      response.appendResponseLine(`Target page: ${url}`);
      if (params && Object.keys(params).length > 0) {
        response.appendResponseLine(`Parameters: ${JSON.stringify(params)}`);
      }

      // After page navigation, update current page info
      try {
        context.currentPage = await context.miniProgram.currentPage();
        response.appendResponseLine(`Current page updated`);
      } catch (error) {
        response.appendResponseLine(`Warning: Unable to update current page info`);
      }

      // Suggest getting new snapshot after page navigation
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Page navigation failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Go back to previous page or specified number of levels
 */
export const navigateBackTool = defineTool({
  name: 'navigate_back',
  description: 'Go back to previous page or specified number of levels',
  schema: z.object({
    delta: z.number().optional().default(1).describe('Number of levels to go back, default 1'),
    waitForLoad: z.boolean().optional().default(true).describe('Whether to wait for page load completion, default true'),
    timeout: z.number().optional().default(5000).describe('Wait timeout in milliseconds, default 5000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { delta, waitForLoad, timeout } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const options: NavigateBackOptions = {
        delta,
        waitForLoad,
        timeout
      };

      await navigateBack(context.miniProgram, options);

      response.appendResponseLine(`Page back successful`);
      response.appendResponseLine(`Back levels: ${delta}`);

      // After going back, update current page info
      try {
        context.currentPage = await context.miniProgram.currentPage();
        response.appendResponseLine(`Current page updated`);
      } catch (error) {
        response.appendResponseLine(`Warning: Unable to update current page info`);
      }

      // Suggest getting new snapshot after going back
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Page back failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Switch to specified tab page
 */
export const switchTabTool = defineTool({
  name: 'switch_tab',
  description: 'Switch to specified tab page',
  schema: z.object({
    url: z.string().describe('Tab page path'),
    waitForLoad: z.boolean().optional().default(true).describe('Whether to wait for page load completion, default true'),
    timeout: z.number().optional().default(5000).describe('Wait timeout in milliseconds, default 5000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { url, waitForLoad, timeout } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const options: SwitchTabOptions = {
        url,
        waitForLoad,
        timeout
      };

      await switchTab(context.miniProgram, options);

      response.appendResponseLine(`Tab switch successful`);
      response.appendResponseLine(`Target tab: ${url}`);

      // After tab switch, update current page info
      try {
        context.currentPage = await context.miniProgram.currentPage();
        response.appendResponseLine(`Current page updated`);
      } catch (error) {
        response.appendResponseLine(`Warning: Unable to update current page info`);
      }

      // Suggest getting new snapshot after tab switch
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Tab switch failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Relaunch to specified page
 */
export const reLaunchTool = defineTool({
  name: 'relaunch',
  description: 'Relaunch mini program and navigate to specified page',
  schema: z.object({
    url: z.string().describe('Target page path'),
    params: z.record(z.string(), z.any()).optional().describe('Page parameters (query parameters)'),
    waitForLoad: z.boolean().optional().default(true).describe('Whether to wait for page load completion, default true'),
    timeout: z.number().optional().default(10000).describe('Wait timeout in milliseconds, default 10000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { url, params, waitForLoad, timeout } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const options: NavigateOptions = {
        url,
        params,
        waitForLoad,
        timeout
      };

      await reLaunch(context.miniProgram, options);

      response.appendResponseLine(`Relaunch successful`);
      response.appendResponseLine(`Target page: ${url}`);
      if (params && Object.keys(params).length > 0) {
        response.appendResponseLine(`Parameters: ${JSON.stringify(params)}`);
      }

      // After relaunch, update current page info
      try {
        context.currentPage = await context.miniProgram.currentPage();
        response.appendResponseLine(`Current page updated`);
      } catch (error) {
        response.appendResponseLine(`Warning: Unable to update current page info`);
      }

      // Suggest getting new snapshot after relaunch
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Relaunch failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Get current page information
 */
export const getPageInfoTool = defineTool({
  name: 'get_page_info',
  description: 'Get detailed information of current page',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      const pageInfo: PageInfo = await getCurrentPageInfo(context.miniProgram);

      response.appendResponseLine(`Page info retrieved successfully`);
      response.appendResponseLine(`Path: ${pageInfo.path}`);

      if (pageInfo.title) {
        response.appendResponseLine(`Title: ${pageInfo.title}`);
      }

      if (pageInfo.query && Object.keys(pageInfo.query).length > 0) {
        response.appendResponseLine(`Query parameters: ${JSON.stringify(pageInfo.query)}`);
      }

      response.appendResponseLine('');
      response.appendResponseLine('Complete info:');
      response.appendResponseLine(JSON.stringify(pageInfo, null, 2));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to get page info: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Redirect to specified page (replace current page)
 */
export const redirectToTool = defineTool({
  name: 'redirect_to',
  description: 'Redirect to specified page (close current page and navigate)',
  schema: z.object({
    url: z.string().describe('Target page path'),
    params: z.record(z.string(), z.any()).optional().describe('Page parameters (query parameters)'),
    waitForLoad: z.boolean().optional().default(true).describe('Whether to wait for page load completion, default true'),
    timeout: z.number().optional().default(10000).describe('Wait timeout in milliseconds, default 10000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { url, params, waitForLoad, timeout } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      // Build full URL
      let fullUrl = url;
      if (params && Object.keys(params).length > 0) {
        const queryString = Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
        fullUrl += (url.includes('?') ? '&' : '?') + queryString;
      }

      // Execute redirect
      await context.miniProgram.redirectTo(fullUrl);

      // Wait for page load completion
      if (waitForLoad) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          try {
            const currentPage = await context.miniProgram.currentPage();
            if (currentPage) {
              const currentPath = await currentPage.path;
              // Check if already redirected to target page
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

      response.appendResponseLine(`Page redirect successful`);
      response.appendResponseLine(`Target page: ${url}`);
      if (params && Object.keys(params).length > 0) {
        response.appendResponseLine(`Parameters: ${JSON.stringify(params)}`);
      }

      // After redirect, update current page info
      try {
        context.currentPage = await context.miniProgram.currentPage();
        response.appendResponseLine(`Current page updated`);
      } catch (error) {
        response.appendResponseLine(`Warning: Unable to update current page info`);
      }

      // Suggest getting new snapshot after redirect
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Page redirect failed: ${errorMessage}`);
      throw error;
    }
  },
});
