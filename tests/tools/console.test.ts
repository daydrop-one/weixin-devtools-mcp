/**
 * Console Tool Unit Tests
 * Verify console tool code structure and type definitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startConsoleMonitoringTool,
  stopConsoleMonitoringTool,
  listConsoleMessagesTool,
  getConsoleMessageTool,
  getConsoleTool,
  clearConsoleTool
} from '../../src/tools/console.js';
import {
  ToolContext,
  ConsoleMessage,
  ExceptionMessage,
  ConsoleStorage,
  SimpleToolResponse
} from '../../src/tools/ToolDefinition.js';
import { createIdGenerator } from '../../src/utils/idGenerator.js';

describe('Console Tools Unit Tests', () => {
  // Create mock tool context (using new navigations structure)
  const createMockContext = (): ToolContext => ({
    miniProgram: {
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn(() => 0),
      removeListener: vi.fn(),
    },
    currentPage: null,
    elementMap: new Map(),
    consoleStorage: {
      navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
      messageIdMap: new Map(),
      isMonitoring: false,
      startTime: null,
      maxNavigations: 3,
      idGenerator: createIdGenerator(),
    },
    getElementByUid: vi.fn(),
  });

  it('should correctly define all console tools (including new tools)', () => {
    // Verify basic properties of tool definitions
    expect(startConsoleMonitoringTool.name).toBe('start_console_monitoring');
    expect(stopConsoleMonitoringTool.name).toBe('stop_console_monitoring');
    expect(listConsoleMessagesTool.name).toBe('list_console_messages');
    expect(getConsoleMessageTool.name).toBe('get_console_message');
    expect(getConsoleTool.name).toBe('get_console');
    expect(clearConsoleTool.name).toBe('clear_console');

    // Verify tools have descriptions
    expect(startConsoleMonitoringTool.description).toBeTruthy();
    expect(stopConsoleMonitoringTool.description).toBeTruthy();
    expect(listConsoleMessagesTool.description).toBeTruthy();
    expect(getConsoleMessageTool.description).toBeTruthy();
    expect(getConsoleTool.description).toBeTruthy();
    expect(clearConsoleTool.description).toBeTruthy();

    // Verify tools have schemas
    expect(startConsoleMonitoringTool.schema).toBeTruthy();
    expect(stopConsoleMonitoringTool.schema).toBeTruthy();
    expect(listConsoleMessagesTool.schema).toBeTruthy();
    expect(getConsoleMessageTool.schema).toBeTruthy();
    expect(getConsoleTool.schema).toBeTruthy();
    expect(clearConsoleTool.schema).toBeTruthy();

    // Verify tools have handlers
    expect(typeof startConsoleMonitoringTool.handler).toBe('function');
    expect(typeof stopConsoleMonitoringTool.handler).toBe('function');
    expect(typeof listConsoleMessagesTool.handler).toBe('function');
    expect(typeof getConsoleMessageTool.handler).toBe('function');
    expect(typeof getConsoleTool.handler).toBe('function');
    expect(typeof clearConsoleTool.handler).toBe('function');
  });

  it('should correctly define Console-related types', () => {
    // Create test ConsoleMessage
    const consoleMessage: ConsoleMessage = {
      type: 'log',
      args: ['test message'],
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };

    expect(consoleMessage.type).toBe('log');
    expect(consoleMessage.args).toEqual(['test message']);
    expect(consoleMessage.timestamp).toBeTruthy();
    expect(consoleMessage.source).toBe('miniprogram');

    // Create test ExceptionMessage
    const exceptionMessage: ExceptionMessage = {
      message: 'Test error',
      stack: 'Error stack trace',
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };

    expect(exceptionMessage.message).toBe('Test error');
    expect(exceptionMessage.stack).toBe('Error stack trace');
    expect(exceptionMessage.timestamp).toBeTruthy();
    expect(exceptionMessage.source).toBe('miniprogram');

    // Create test ConsoleStorage (using new navigations structure)
    const consoleStorage: ConsoleStorage = {
      navigations: [{
        messages: [consoleMessage],
        exceptions: [exceptionMessage],
        timestamp: new Date().toISOString()
      }],
      messageIdMap: new Map(),
      isMonitoring: true,
      startTime: new Date().toISOString(),
      maxNavigations: 3,
    };

    expect(consoleStorage.navigations).toHaveLength(1);
    expect(consoleStorage.navigations[0].messages).toHaveLength(1);
    expect(consoleStorage.navigations[0].exceptions).toHaveLength(1);
    expect(consoleStorage.isMonitoring).toBe(true);
    expect(consoleStorage.startTime).toBeTruthy();
  });

  it('should correctly handle schema validation (including new tools)', () => {
    // Test startConsoleMonitoringTool schema
    const startSchema = startConsoleMonitoringTool.schema;
    const validStartParams = { clearExisting: true };
    const startResult = startSchema.safeParse(validStartParams);
    expect(startResult.success).toBe(true);

    // Test listConsoleMessagesTool schema
    const listSchema = listConsoleMessagesTool.schema;
    const validListParams = {
      pageSize: 20,
      pageIdx: 0,
      types: ['log', 'error'],
      includePreservedMessages: false
    };
    const listResult = listSchema.safeParse(validListParams);
    expect(listResult.success).toBe(true);

    // Test getConsoleMessageTool schema
    const getMessageSchema = getConsoleMessageTool.schema;
    const validGetMessageParams = { msgid: 1 };
    const getMessageResult = getMessageSchema.safeParse(validGetMessageParams);
    expect(getMessageResult.success).toBe(true);

    // Test getConsoleTool schema
    const getSchema = getConsoleTool.schema;
    const validGetParams = {
      type: 'all' as const,
      limit: 50,
      since: '2023-01-01T00:00:00.000Z'
    };
    const getResult = getSchema.safeParse(validGetParams);
    expect(getResult.success).toBe(true);

    // Test clearConsoleTool schema
    const clearSchema = clearConsoleTool.schema;
    const validClearParams = { type: 'console' as const };
    const clearResult = clearSchema.safeParse(validClearParams);
    expect(clearResult.success).toBe(true);
  });

  it('should correctly create mock tool context (using new storage structure)', () => {
    const context = createMockContext();

    expect(context.miniProgram).toBeTruthy();
    expect(context.currentPage).toBeNull();
    expect(context.elementMap).toBeInstanceOf(Map);
    expect(context.consoleStorage).toBeTruthy();
    expect(context.consoleStorage.navigations).toHaveLength(1);
    expect(context.consoleStorage.navigations[0].messages).toEqual([]);
    expect(context.consoleStorage.navigations[0].exceptions).toEqual([]);
    expect(context.consoleStorage.messageIdMap).toBeInstanceOf(Map);
    expect(context.consoleStorage.isMonitoring).toBe(false);
    expect(context.consoleStorage.startTime).toBeNull();
    expect(context.consoleStorage.maxNavigations).toBe(3);
    expect(typeof context.consoleStorage.idGenerator).toBe('function');
  });

  it('should verify console message data structure', () => {
    const sampleConsoleMessage: ConsoleMessage = {
      type: 'error',
      args: ['Error occurred', { details: 'some details' }],
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'miniprogram'
    };

    // Verify type enum values
    const validTypes: ConsoleMessage['type'][] = ['log', 'warn', 'error', 'info', 'debug'];
    expect(validTypes).toContain(sampleConsoleMessage.type);

    // Verify args can contain various types
    expect(Array.isArray(sampleConsoleMessage.args)).toBe(true);
    expect(sampleConsoleMessage.args[0]).toBe('Error occurred');
    expect(typeof sampleConsoleMessage.args[1]).toBe('object');
  });

  it('should verify exception message data structure', () => {
    const sampleExceptionMessage: ExceptionMessage = {
      message: 'ReferenceError: undefined is not defined',
      stack: 'ReferenceError: undefined is not defined\n    at test.js:1:1',
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'miniprogram'
    };

    expect(typeof sampleExceptionMessage.message).toBe('string');
    expect(typeof sampleExceptionMessage.stack).toBe('string');
    expect(typeof sampleExceptionMessage.timestamp).toBe('string');
    expect(sampleExceptionMessage.source).toBe('miniprogram');
  });
});

describe('New Console Tools - list_console_messages', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      miniProgram: {} as any,
      currentPage: null,
      elementMap: new Map(),
      consoleStorage: {
        navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
        messageIdMap: new Map(),
        isMonitoring: true,
        startTime: new Date().toISOString(),
        maxNavigations: 3,
        idGenerator: createIdGenerator(),
      },
      getElementByUid: vi.fn(),
    };
  });

  it('should support pagination parameters', () => {
    const schema = listConsoleMessagesTool.schema;

    // Test valid pagination parameters
    const validParams = { pageSize: 20, pageIdx: 0 };
    const result = schema.safeParse(validParams);
    expect(result.success).toBe(true);

    // Test invalid pagination parameters (negative)
    const invalidParams = { pageSize: -1, pageIdx: 0 };
    const invalidResult = schema.safeParse(invalidParams);
    expect(invalidResult.success).toBe(false);
  });

  it('should support extended type filtering (17 types)', () => {
    const schema = listConsoleMessagesTool.schema;

    // Test all supported types
    const validTypes = ['log', 'debug', 'info', 'error', 'warn', 'dir', 'dirxml',
                        'table', 'trace', 'clear', 'group', 'groupCollapsed',
                        'groupEnd', 'assert', 'count', 'timeEnd', 'verbose'];

    const params = { types: validTypes };
    const result = schema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should correctly return message list in short format', async () => {
    // Add test messages
    const msg1: ConsoleMessage = {
      msgid: 1,
      type: 'log',
      message: 'Test log',
      args: ['Test', 'log'],
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };
    const msg2: ConsoleMessage = {
      msgid: 2,
      type: 'error',
      message: 'Test error',
      args: ['Test', 'error'],
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };

    context.consoleStorage.navigations[0].messages.push(msg1, msg2);
    context.consoleStorage.messageIdMap.set(1, msg1);
    context.consoleStorage.messageIdMap.set(2, msg2);

    const request = { params: {} };
    const response = new SimpleToolResponse();

    await listConsoleMessagesTool.handler(request, response, context);

    const output = response.getResponseText();

    // Verify output contains short format
    expect(output).toContain('msgid=1');
    expect(output).toContain('msgid=2');
    expect(output).toContain('[log]');
    expect(output).toContain('[error]');
    expect(output).toContain('(2 args)');
  });

  it('should correctly handle pagination', async () => {
    // Add 25 messages
    for (let i = 1; i <= 25; i++) {
      const msg: ConsoleMessage = {
        msgid: i,
        type: 'log',
        message: `Message ${i}`,
        args: [`Message ${i}`],
        timestamp: new Date().toISOString(),
        source: 'miniprogram'
      };
      context.consoleStorage.navigations[0].messages.push(msg);
      context.consoleStorage.messageIdMap.set(i, msg);
    }

    // First page (0-19)
    const request1 = { params: { pageSize: 20, pageIdx: 0 } };
    const response1 = new SimpleToolResponse();
    await listConsoleMessagesTool.handler(request1, response1, context);
    const output1 = response1.getResponseText();

    expect(output1).toContain('Total: 25 messages');
    expect(output1).toContain('Showing: 1-20');
    expect(output1).toContain('Next page: 1');

    // Second page (20-24)
    const request2 = { params: { pageSize: 20, pageIdx: 1 } };
    const response2 = new SimpleToolResponse();
    await listConsoleMessagesTool.handler(request2, response2, context);
    const output2 = response2.getResponseText();

    expect(output2).toContain('Total: 25 messages');
    expect(output2).toContain('Showing: 21-25');
    expect(output2).toContain('Previous page: 0');
  });

  it('should support type filtering', async () => {
    // Add messages of different types
    const logMsg: ConsoleMessage = {
      msgid: 1,
      type: 'log',
      message: 'Log message',
      args: ['Log'],
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };
    const errorMsg: ConsoleMessage = {
      msgid: 2,
      type: 'error',
      message: 'Error message',
      args: ['Error'],
      timestamp: new Date().toISOString(),
      source: 'miniprogram'
    };

    context.consoleStorage.navigations[0].messages.push(logMsg, errorMsg);
    context.consoleStorage.messageIdMap.set(1, logMsg);
    context.consoleStorage.messageIdMap.set(2, errorMsg);

    // Get only error type
    const request = { params: { types: ['error'] } };
    const response = new SimpleToolResponse();
    await listConsoleMessagesTool.handler(request, response, context);
    const output = response.getResponseText();

    expect(output).toContain('msgid=2');
    expect(output).toContain('[error]');
    expect(output).not.toContain('msgid=1');
    expect(output).not.toContain('[log]');
  });
});

describe('New Console Tools - get_console_message', () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      miniProgram: {} as any,
      currentPage: null,
      elementMap: new Map(),
      consoleStorage: {
        navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
        messageIdMap: new Map(),
        isMonitoring: true,
        startTime: new Date().toISOString(),
        maxNavigations: 3,
        idGenerator: createIdGenerator(),
      },
      getElementByUid: vi.fn(),
    };
  });

  it('should get detailed message by msgid', async () => {
    const msg: ConsoleMessage = {
      msgid: 1,
      type: 'error',
      message: 'Detailed error',
      args: ['arg1', { key: 'value' }],
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'miniprogram'
    };

    context.consoleStorage.navigations[0].messages.push(msg);
    context.consoleStorage.messageIdMap.set(1, msg);

    const request = { params: { msgid: 1 } };
    const response = new SimpleToolResponse();

    await getConsoleMessageTool.handler(request, response, context);

    const output = response.getResponseText();

    // Verify detailed format
    expect(output).toContain('ID: 1');
    expect(output).toContain('Type: error');
    expect(output).toContain('Message: Detailed error');
    expect(output).toContain('Timestamp: 2023-12-01T10:00:00.000Z');
    expect(output).toContain('### Arguments');
    expect(output).toContain('Arg #0: arg1');
    expect(output).toContain('Arg #1:');
  });

  it('should correctly handle Exception messages', async () => {
    const exception: ExceptionMessage = {
      msgid: 2,
      message: 'ReferenceError: x is not defined',
      stack: 'ReferenceError: x is not defined\\n    at test.js:1:1',
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'miniprogram'
    };

    context.consoleStorage.navigations[0].exceptions.push(exception);
    context.consoleStorage.messageIdMap.set(2, exception);

    const request = { params: { msgid: 2 } };
    const response = new SimpleToolResponse();

    await getConsoleMessageTool.handler(request, response, context);

    const output = response.getResponseText();

    // Verify exception-specific fields
    expect(output).toContain('ID: 2');
    expect(output).toContain('Type: exception');
    expect(output).toContain('Message: ReferenceError: x is not defined');
    expect(output).toContain('### Stack Trace');
  });

  it('should throw error when msgid not found', async () => {
    const request = { params: { msgid: 999 } };
    const response = new SimpleToolResponse();

    await expect(
      getConsoleMessageTool.handler(request, response, context)
    ).rejects.toThrow('Message with msgid=999 not found');
  });

  it('should validate msgid parameter', () => {
    const schema = getConsoleMessageTool.schema;

    // Valid parameters
    expect(schema.safeParse({ msgid: 1 }).success).toBe(true);
    expect(schema.safeParse({ msgid: 100 }).success).toBe(true);

    // Invalid parameters
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ msgid: 'invalid' }).success).toBe(false);
    expect(schema.safeParse({ msgid: -1 }).success).toBe(false);
  });
});