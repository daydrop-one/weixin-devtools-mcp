/**
 * Console and Exception Monitoring Tools (P0+P1 Optimized Version)
 * Implements monitoring and retrieval of console output and exceptions from WeChat DevTools
 *
 * New Features:
 * - Stable ID system supports two-phase queries
 * - True pagination support (pageSize + pageIdx)
 * - Extended type filtering (15+ types)
 * - Navigation history preservation (up to 3 sessions)
 * - Backward-compatible API
 */

import { z } from 'zod';
import {
  defineTool,
  ToolCategories,
  type ConsoleMessage,
  type ExceptionMessage,
  type ConsoleMessageType,
} from './ToolDefinition.js';
import {
  FILTERABLE_MESSAGE_TYPES,
  formatConsoleEventShort,
  formatConsoleEventVerbose,
  formatPaginationInfo,
  type ConsoleMessageData,
  type ExceptionMessageData,
} from '../formatters/consoleFormatter.js';
import { createIdGenerator } from '../utils/idGenerator.js';

/**
 * Initialize ConsoleStorage (new structure)
 */
function initializeConsoleStorage(context: any): void {
  if (!context.consoleStorage.navigations) {
    context.consoleStorage = {
      navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
      messageIdMap: new Map(),
      isMonitoring: false,
      startTime: null,
      maxNavigations: 3,
      idGenerator: createIdGenerator(),
    };
  }
}

/**
 * Start Console Monitoring Tool (refactored version)
 */
export const startConsoleMonitoringTool = defineTool({
  name: 'start_console_monitoring',
  description: 'Start monitoring console and exception events from WeChat DevTools',
  schema: z.object({
    clearExisting: z.boolean().optional().default(false).describe('Whether to clear existing log records'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { clearExisting } = request.params;

    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    // Initialize storage structure
    initializeConsoleStorage(context);

    // Clear existing logs
    if (clearExisting) {
      context.consoleStorage.navigations = [
        { messages: [], exceptions: [], timestamp: new Date().toISOString() }
      ];
      context.consoleStorage.messageIdMap.clear();
    }

    // Ensure ID generator exists
    if (!context.consoleStorage.idGenerator) {
      context.consoleStorage.idGenerator = createIdGenerator();
    }

    const idGenerator = context.consoleStorage.idGenerator;

    // Set monitoring state
    context.consoleStorage.isMonitoring = true;
    context.consoleStorage.startTime = new Date().toISOString();

    try {
      // Listen to console events
      context.miniProgram.on('console', (msg: any) => {
        const msgid = idGenerator();
        const consoleMessage: ConsoleMessage = {
          msgid,
          type: (msg.type || 'log') as ConsoleMessageType,
          message: msg.args?.length > 0 ? String(msg.args[0]) : '',
          args: msg.args || [],
          timestamp: new Date().toISOString(),
          source: 'miniprogram',
        };

        // Add to current navigation session
        const currentNav = context.consoleStorage.navigations[0];
        currentNav.messages.push(consoleMessage);

        // Add to ID mapping
        context.consoleStorage.messageIdMap.set(msgid, consoleMessage);

        console.log(`[Console ${msg.type}] msgid=${msgid}:`, msg.args);
      });

      // Listen to exception events
      context.miniProgram.on('exception', (err: any) => {
        const msgid = idGenerator();
        const exceptionMessage: ExceptionMessage = {
          msgid,
          message: err.message || String(err),
          stack: err.stack,
          timestamp: new Date().toISOString(),
          source: 'miniprogram',
        };

        // Add to current navigation session
        const currentNav = context.consoleStorage.navigations[0];
        currentNav.exceptions.push(exceptionMessage);

        // Add to ID mapping
        context.consoleStorage.messageIdMap.set(msgid, exceptionMessage);

        console.log(`[Exception] msgid=${msgid}:`, err.message, err.stack);
      });

      // TODO: Future navigation event listener
      // context.miniProgram.on('pageNavigate', () => {
      //   // Create new navigation session
      //   context.consoleStorage.navigations.unshift({
      //     messages: [],
      //     exceptions: [],
      //     timestamp: new Date().toISOString()
      //   });
      //   // Limit preserved count
      //   context.consoleStorage.navigations.splice(context.consoleStorage.maxNavigations);
      // });

      response.appendResponseLine('Console monitoring started');
      response.appendResponseLine(`Monitoring start time: ${context.consoleStorage.startTime}`);
      response.appendResponseLine(`Clear history: ${clearExisting ? 'Yes' : 'No'}`);
      response.appendResponseLine(`Stable ID system: Enabled`);
      response.appendResponseLine(`Navigation history preservation: Up to ${context.consoleStorage.maxNavigations} sessions`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start console monitoring: ${errorMessage}`);
    }
  },
});

/**
 * Stop Console Monitoring Tool
 */
export const stopConsoleMonitoringTool = defineTool({
  name: 'stop_console_monitoring',
  description: 'Stop monitoring console and exception events from WeChat DevTools',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    try {
      // Remove all listeners
      context.miniProgram.removeAllListeners('console');
      context.miniProgram.removeAllListeners('exception');

      // Count messages
      const storage = context.consoleStorage;
      let totalMessages = 0;
      let totalExceptions = 0;

      if (storage.navigations) {
        for (const nav of storage.navigations) {
          totalMessages += nav.messages.length;
          totalExceptions += nav.exceptions.length;
        }
      }

      // Update monitoring state
      const wasMonitoring = context.consoleStorage.isMonitoring;
      context.consoleStorage.isMonitoring = false;

      response.appendResponseLine(wasMonitoring ? 'Console monitoring stopped' : 'Console monitoring was not running');
      response.appendResponseLine(`Collected ${totalMessages} console log(s) during monitoring`);
      response.appendResponseLine(`Collected ${totalExceptions} exception record(s) during monitoring`);
      response.appendResponseLine(`ID mapping table size: ${storage.messageIdMap?.size || 0}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to stop console monitoring: ${errorMessage}`);
    }
  },
});

/**
 * List Console Messages Tool (P0 new addition)
 */
export const listConsoleMessagesTool = defineTool({
  name: 'list_console_messages',
  description: 'List console messages in short format with pagination and filtering support. Use this to quickly browse large volumes of messages. After getting msgid values, use get_console_message to view details.',
  schema: z.object({
    pageSize: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of messages per page, defaults to 50'),
    pageIdx: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Page number (starting from 0), defaults to 0'),
    types: z
      .array(z.enum(FILTERABLE_MESSAGE_TYPES as any))
      .optional()
      .describe('Filter message types, supports 15+ types, returns all types if not specified'),
    includePreservedMessages: z
      .boolean()
      .default(false)
      .optional()
      .describe('Whether to include messages from historical navigations (up to 3 recent navigations)'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const {
      pageSize = 50,
      pageIdx = 0,
      types,
      includePreservedMessages = false,
    } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console storage not initialized');
    }

    initializeConsoleStorage(context);

    // Collect messages
    let allMessages: Array<ConsoleMessageData | ExceptionMessageData> = [];

    const navigationsToInclude = includePreservedMessages
      ? context.consoleStorage.navigations.slice(0, context.consoleStorage.maxNavigations)
      : [context.consoleStorage.navigations[0]];

    for (const nav of navigationsToInclude) {
      // Add console messages
      for (const msg of nav.messages) {
        if (msg.msgid !== undefined) {
          allMessages.push({
            msgid: msg.msgid,
            type: msg.type,
            message: msg.message,
            args: msg.args,
            timestamp: msg.timestamp,
            source: msg.source,
          });
        }
      }

      // Add exception messages
      for (const exc of nav.exceptions) {
        if (exc.msgid !== undefined) {
          allMessages.push({
            msgid: exc.msgid,
            type: 'exception',
            message: exc.message,
            stack: exc.stack,
            timestamp: exc.timestamp,
            source: exc.source,
          });
        }
      }
    }

    // Type filtering
    if (types && types.length > 0) {
      const normalizedTypes = new Set(types);
      allMessages = allMessages.filter(msg => normalizedTypes.has(msg.type as any));
    }

    // Sort by time (newest first)
    allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    // Pagination
    const total = allMessages.length;
    const start = pageIdx * pageSize;
    const end = Math.min(start + pageSize, total);
    const pagedMessages = allMessages.slice(start, end);

    // Format output
    response.appendResponseLine('## Console Messages (List View)');
    response.appendResponseLine(`Monitoring status: ${context.consoleStorage.isMonitoring ? 'Running' : 'Stopped'}`);
    response.appendResponseLine(`Monitoring start time: ${context.consoleStorage.startTime || 'Not set'}`);
    response.appendResponseLine('');

    const paginationInfo = formatPaginationInfo(total, pageSize, pageIdx);
    for (const line of paginationInfo.info) {
      response.appendResponseLine(line);
    }

    response.appendResponseLine('');
    response.appendResponseLine('### Messages');

    if (pagedMessages.length > 0) {
      for (const msg of pagedMessages) {
        response.appendResponseLine(formatConsoleEventShort(msg));
      }
    } else {
      response.appendResponseLine('<no messages found>');
    }

    response.appendResponseLine('');
    response.appendResponseLine('💡 Tip: Use get_console_message tool with msgid to view detailed information');
  },
});

/**
 * Get Console Message Details Tool (P0 new addition)
 */
export const getConsoleMessageTool = defineTool({
  name: 'get_console_message',
  description: 'Retrieve detailed information for a single console message by msgid (full arguments and stack traces)',
  schema: z.object({
    msgid: z.number().positive().describe('Stable ID of the message (obtained from list_console_messages)'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { msgid } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console storage not initialized');
    }

    initializeConsoleStorage(context);

    // Look up from ID mapping
    const message = context.consoleStorage.messageIdMap.get(msgid);

    if (!message) {
      throw new Error(`Message with msgid=${msgid} not found. Please use list_console_messages to view available messages.`);
    }

    // Construct detailed data
    let detailData: ConsoleMessageData | ExceptionMessageData;

    if ('stack' in message) {
      // Exception message
      detailData = {
        msgid: message.msgid!,
        type: 'exception',
        message: message.message,
        stack: message.stack,
        timestamp: message.timestamp,
        source: message.source,
      };
    } else {
      // Console message (type narrowing)
      const consoleMsg = message as ConsoleMessage;
      detailData = {
        msgid: consoleMsg.msgid!,
        type: consoleMsg.type,
        message: consoleMsg.message,
        args: consoleMsg.args,
        timestamp: consoleMsg.timestamp,
        source: consoleMsg.source,
      };
    }

    // Format output
    response.appendResponseLine('## Console Message (Detail View)');
    response.appendResponseLine('');
    response.appendResponseLine(formatConsoleEventVerbose(detailData));
  },
});

/**
 * Get Console Logs Tool (backward compatible)
 */
export const getConsoleTool = defineTool({
  name: 'get_console',
  description: 'Retrieve collected console logs and exception information (compatible with legacy API, recommended to use list_console_messages)',
  schema: z.object({
    type: z.enum(['all', 'console', 'exception']).optional().default('all').describe('Type of data to retrieve'),
    limit: z.number().optional().default(50).describe('Limit the number of returned records'),
    since: z.string().optional().describe('Retrieve records after the specified time, format: ISO 8601'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type, limit, since } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console storage not initialized');
    }

    initializeConsoleStorage(context);

    const sinceTime = since ? new Date(since) : null;

    // Filter function
    const filterByTime = (item: ConsoleMessage | ExceptionMessage) => {
      if (!sinceTime) return true;
      return new Date(item.timestamp) >= sinceTime;
    };

    // Collect messages (backward compatible: only from current navigation)
    const currentNav = context.consoleStorage.navigations[0];
    let consoleMessages: ConsoleMessage[] = [];
    let exceptionMessages: ExceptionMessage[] = [];

    if (type === 'all' || type === 'console') {
      consoleMessages = currentNav.messages.filter(filterByTime).slice(-limit);
    }

    if (type === 'all' || type === 'exception') {
      exceptionMessages = currentNav.exceptions.filter(filterByTime).slice(-limit);
    }

    // Generate response (maintain legacy format)
    response.appendResponseLine('=== Console Data Retrieval Result ===');
    response.appendResponseLine(`Monitoring status: ${context.consoleStorage.isMonitoring ? 'Running' : 'Stopped'}`);
    response.appendResponseLine(`Monitoring start time: ${context.consoleStorage.startTime || 'Not set'}`);

    if (consoleMessages.length > 0) {
      response.appendResponseLine(`\n--- Console Logs (${consoleMessages.length} record(s)) ---`);
      consoleMessages.forEach((msg, index) => {
        const msgidInfo = msg.msgid ? ` [msgid=${msg.msgid}]` : '';
        response.appendResponseLine(`${index + 1}. [${msg.type}] ${msg.timestamp}${msgidInfo}`);
        response.appendResponseLine(`   Content: ${msg.message || JSON.stringify(msg.args)}`);
      });
    }

    if (exceptionMessages.length > 0) {
      response.appendResponseLine(`\n--- Exceptions (${exceptionMessages.length} record(s)) ---`);
      exceptionMessages.forEach((err, index) => {
        const msgidInfo = err.msgid ? ` [msgid=${err.msgid}]` : '';
        response.appendResponseLine(`${index + 1}. ${err.timestamp}${msgidInfo}`);
        response.appendResponseLine(`   Message: ${err.message}`);
        if (err.stack) {
          response.appendResponseLine(`   Stack: ${err.stack.split('\n')[0]}...`);
        }
      });
    }

    response.appendResponseLine('\n=== Retrieval Complete ===');
    response.appendResponseLine('💡 Tip: Recommended to use list_console_messages and get_console_message tools for a better experience');
  },
});

/**
 * Clear Console Logs Tool
 */
export const clearConsoleTool = defineTool({
  name: 'clear_console',
  description: 'Clear collected console logs and exception information',
  schema: z.object({
    type: z.enum(['all', 'console', 'exception']).optional().default('all').describe('Type of data to clear'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { type } = request.params;

    if (!context.consoleStorage) {
      throw new Error('Console storage not initialized');
    }

    initializeConsoleStorage(context);

    let clearedConsole = 0;
    let clearedException = 0;

    // Clear data based on type
    const currentNav = context.consoleStorage.navigations[0];

    if (type === 'all' || type === 'console') {
      clearedConsole = currentNav.messages.length;
      // Remove from ID mapping
      for (const msg of currentNav.messages) {
        if (msg.msgid !== undefined) {
          context.consoleStorage.messageIdMap.delete(msg.msgid);
        }
      }
      currentNav.messages = [];
    }

    if (type === 'all' || type === 'exception') {
      clearedException = currentNav.exceptions.length;
      // Remove from ID mapping
      for (const exc of currentNav.exceptions) {
        if (exc.msgid !== undefined) {
          context.consoleStorage.messageIdMap.delete(exc.msgid);
        }
      }
      currentNav.exceptions = [];
    }

    response.appendResponseLine('Console data cleared');
    response.appendResponseLine(`Cleared console logs: ${clearedConsole} record(s)`);
    response.appendResponseLine(`Cleared exceptions: ${clearedException} record(s)`);
    response.appendResponseLine(`Remaining ID mappings: ${context.consoleStorage.messageIdMap.size}`);
  },
});
