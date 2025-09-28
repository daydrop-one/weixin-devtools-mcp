/**
 * 连接管理工具
 * 负责微信开发者工具的连接和断开
 */

import { z } from 'zod';
import { defineTool, ToolCategories, ConsoleMessage, ExceptionMessage } from './ToolDefinition.js';
import { connectDevtools, type ConnectOptions } from '../tools.js';

/**
 * 连接到微信开发者工具
 */
export const connectDevtoolsTool = defineTool({
  name: 'connect_devtools',
  description: '连接到微信开发者工具',
  schema: z.object({
    projectPath: z.string().describe('小程序项目的绝对路径'),
    cliPath: z.string().optional().describe('微信开发者工具CLI的绝对路径（可选，默认会自动查找）'),
    port: z.number().optional().describe('WebSocket端口号（可选，默认自动分配）'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { projectPath, cliPath, port } = request.params;

    try {
      const options: ConnectOptions = { projectPath };
      if (cliPath) options.cliPath = cliPath;
      if (port) options.port = port;

      const result = await connectDevtools(options);

      // 更新上下文
      context.miniProgram = result.miniProgram;
      context.currentPage = result.currentPage;
      context.elementMap.clear();

      // 自动启动console监听
      try {
        // 清除之前的监听器（如果有的话）
        context.miniProgram.removeAllListeners('console');
        context.miniProgram.removeAllListeners('exception');

        // 启动console监听
        context.consoleStorage.isMonitoring = true;
        context.consoleStorage.startTime = new Date().toISOString();

        context.miniProgram.on('console', (msg: any) => {
          const consoleMessage: ConsoleMessage = {
            type: msg.type || 'log',
            args: msg.args || [],
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          context.consoleStorage.consoleMessages.push(consoleMessage);
          console.log(`[Console ${msg.type}]:`, msg.args);
        });

        context.miniProgram.on('exception', (err: any) => {
          const exceptionMessage: ExceptionMessage = {
            message: err.message || String(err),
            stack: err.stack,
            timestamp: new Date().toISOString(),
            source: 'miniprogram'
          };
          context.consoleStorage.exceptionMessages.push(exceptionMessage);
          console.log(`[Exception]:`, err.message, err.stack);
        });

        response.appendResponseLine(`成功连接到微信开发者工具`);
        response.appendResponseLine(`项目路径: ${projectPath}`);
        response.appendResponseLine(`当前页面: ${result.pagePath}`);
        response.appendResponseLine(`Console监听已自动启动`);

      } catch (consoleError) {
        response.appendResponseLine(`成功连接到微信开发者工具`);
        response.appendResponseLine(`项目路径: ${projectPath}`);
        response.appendResponseLine(`当前页面: ${result.pagePath}`);
        response.appendResponseLine(`警告: Console监听启动失败 - ${consoleError instanceof Error ? consoleError.message : String(consoleError)}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`连接失败: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * 获取当前页面信息
 */
export const getCurrentPageTool = defineTool({
  name: 'get_current_page',
  description: '获取当前页面信息并设置为活动页面',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('请先连接到微信开发者工具');
    }

    try {
      context.currentPage = await context.miniProgram.currentPage();
      const pagePath = await context.currentPage.path;

      response.appendResponseLine(`当前页面: ${pagePath}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`获取当前页面失败: ${errorMessage}`);
      throw error;
    }
  },
});