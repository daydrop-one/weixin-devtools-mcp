/**
 * Console和Exception监听工具
 * 实现对微信开发者工具console输出和异常的监听和获取
 */

import { z } from 'zod';
import { defineTool, ToolCategories, ConsoleMessage, ExceptionMessage } from './ToolDefinition.js';

/**
 * 启动Console监听工具
 */
export const startConsoleMonitoringTool = defineTool({
  name: 'start_console_monitoring',
  description: '启动对微信开发者工具console和exception的监听',
  schema: z.object({
    clearExisting: z.boolean().optional().default(false).describe('是否清除已有的日志记录'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { clearExisting } = request.params;

    if (!context.miniProgram) {
      throw new Error('请先连接到微信开发者工具');
    }

    // 清除现有日志
    if (clearExisting) {
      context.consoleStorage.consoleMessages = [];
      context.consoleStorage.exceptionMessages = [];
    }

    // 设置监听状态
    context.consoleStorage.isMonitoring = true;
    context.consoleStorage.startTime = new Date().toISOString();

    try {
      // 监听console事件
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

      // 监听exception事件
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

      response.appendResponseLine('Console监听已启动');
      response.appendResponseLine(`监听开始时间: ${context.consoleStorage.startTime}`);
      response.appendResponseLine(`清除历史记录: ${clearExisting ? '是' : '否'}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`启动Console监听失败: ${errorMessage}`);
    }
  },
});

/**
 * 停止Console监听工具
 */
export const stopConsoleMonitoringTool = defineTool({
  name: 'stop_console_monitoring',
  description: '停止对微信开发者工具console和exception的监听',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('请先连接到微信开发者工具');
    }

    try {
      // 移除所有监听器
      context.miniProgram.removeAllListeners('console');
      context.miniProgram.removeAllListeners('exception');

      // 更新监听状态
      const wasMonitoring = context.consoleStorage.isMonitoring;
      context.consoleStorage.isMonitoring = false;

      response.appendResponseLine(wasMonitoring ? 'Console监听已停止' : 'Console监听未在运行');
      response.appendResponseLine(`监听期间收集到 ${context.consoleStorage.consoleMessages.length} 条console日志`);
      response.appendResponseLine(`监听期间收集到 ${context.consoleStorage.exceptionMessages.length} 条exception记录`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`停止Console监听失败: ${errorMessage}`);
    }
  },
});

/**
 * 获取Console日志工具
 */
export const getConsoleTool = defineTool({
  name: 'get_console',
  description: '获取收集到的console日志和exception异常信息',
  schema: z.object({
    type: z.enum(['all', 'console', 'exception']).optional().default('all').describe('获取的数据类型'),
    limit: z.number().optional().default(50).describe('限制返回条数'),
    since: z.string().optional().describe('获取指定时间之后的记录，格式：ISO 8601'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type, limit, since } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console存储未初始化');
    }

    const sinceTime = since ? new Date(since) : null;

    // 过滤函数
    const filterByTime = (item: ConsoleMessage | ExceptionMessage) => {
      if (!sinceTime) return true;
      return new Date(item.timestamp) >= sinceTime;
    };

    let result: any = {};

    // 根据类型获取数据
    if (type === 'all' || type === 'console') {
      const consoleMessages = context.consoleStorage.consoleMessages
        .filter(filterByTime)
        .slice(-limit);
      result.consoleMessages = consoleMessages;
    }

    if (type === 'all' || type === 'exception') {
      const exceptionMessages = context.consoleStorage.exceptionMessages
        .filter(filterByTime)
        .slice(-limit);
      result.exceptionMessages = exceptionMessages;
    }

    // 生成响应
    response.appendResponseLine('=== Console数据获取结果 ===');
    response.appendResponseLine(`监听状态: ${context.consoleStorage.isMonitoring ? '运行中' : '已停止'}`);
    response.appendResponseLine(`监听开始时间: ${context.consoleStorage.startTime || '未设置'}`);

    if (result.consoleMessages) {
      response.appendResponseLine(`\n--- Console日志 (${result.consoleMessages.length} 条) ---`);
      result.consoleMessages.forEach((msg: ConsoleMessage, index: number) => {
        response.appendResponseLine(`${index + 1}. [${msg.type}] ${msg.timestamp}`);
        response.appendResponseLine(`   内容: ${JSON.stringify(msg.args)}`);
      });
    }

    if (result.exceptionMessages) {
      response.appendResponseLine(`\n--- Exception异常 (${result.exceptionMessages.length} 条) ---`);
      result.exceptionMessages.forEach((err: ExceptionMessage, index: number) => {
        response.appendResponseLine(`${index + 1}. ${err.timestamp}`);
        response.appendResponseLine(`   消息: ${err.message}`);
        if (err.stack) {
          response.appendResponseLine(`   堆栈: ${err.stack.split('\n')[0]}...`);
        }
      });
    }

    response.appendResponseLine('\n=== 获取完成 ===');
  },
});

/**
 * 清除Console日志工具
 */
export const clearConsoleTool = defineTool({
  name: 'clear_console',
  description: '清除已收集的console日志和exception异常信息',
  schema: z.object({
    type: z.enum(['all', 'console', 'exception']).optional().default('all').describe('清除的数据类型'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console存储未初始化');
    }

    let clearedConsole = 0;
    let clearedException = 0;

    // 根据类型清除数据
    if (type === 'all' || type === 'console') {
      clearedConsole = context.consoleStorage.consoleMessages.length;
      context.consoleStorage.consoleMessages = [];
    }

    if (type === 'all' || type === 'exception') {
      clearedException = context.consoleStorage.exceptionMessages.length;
      context.consoleStorage.exceptionMessages = [];
    }

    response.appendResponseLine('Console数据清除完成');
    response.appendResponseLine(`清除Console日志: ${clearedConsole} 条`);
    response.appendResponseLine(`清除Exception异常: ${clearedException} 条`);
  },
});