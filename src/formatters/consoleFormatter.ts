/**
 * Console 消息格式化器
 * 参考 chrome-devtools-mcp 的设计模式
 */

/**
 * 可过滤的 Console 消息类型（扩展到15+种）
 */
export const FILTERABLE_MESSAGE_TYPES = [
  'log',
  'debug',
  'info',
  'error',
  'warn',
  'dir',
  'dirxml',
  'table',
  'trace',
  'clear',
  'group',
  'groupCollapsed',
  'groupEnd',
  'assert',
  'count',
  'timeEnd',
  'verbose',
] as const;

export type ConsoleMessageType = typeof FILTERABLE_MESSAGE_TYPES[number];

/**
 * Console 消息数据接口（用于格式化）
 */
export interface ConsoleMessageData {
  msgid: number;
  type: string;
  message?: string;
  args?: any[];
  timestamp?: string;
  source?: string;
}

/**
 * Exception 消息数据接口（用于格式化）
 */
export interface ExceptionMessageData {
  msgid: number;
  type: 'exception';
  message: string;
  stack?: string;
  timestamp?: string;
  source?: string;
}

/**
 * 格式化单个参数
 */
function formatArg(arg: unknown): string {
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * 格式化参数列表
 */
function formatArgs(data: ConsoleMessageData | ExceptionMessageData): string {
  if (data.type === 'exception') {
    return '';
  }

  // 类型收窄：此时 data 是 ConsoleMessageData
  const consoleData = data as ConsoleMessageData;
  if (!consoleData.args || consoleData.args.length === 0) {
    return '';
  }

  const result = ['### Arguments'];

  for (const [key, arg] of consoleData.args.entries()) {
    result.push(`Arg #${key}: ${formatArg(arg)}`);
  }

  return result.join('\n');
}

/**
 * 简短格式化 Console 消息（用于列表视图）
 * 格式：msgid=123 [error] Network timeout (2 args)
 */
export function formatConsoleEventShort(
  data: ConsoleMessageData | ExceptionMessageData
): string {
  const argsCount = data.type === 'exception' ? 0 : ((data as ConsoleMessageData).args?.length ?? 0);
  const message = data.message || '';
  return `msgid=${data.msgid} [${data.type}] ${message} (${argsCount} args)`;
}

/**
 * 详细格式化 Console 消息（用于详情视图）
 * 包含完整的参数信息和堆栈跟踪
 */
export function formatConsoleEventVerbose(
  data: ConsoleMessageData | ExceptionMessageData
): string {
  const lines: string[] = [
    `ID: ${data.msgid}`,
    `Type: ${data.type}`,
    `Timestamp: ${data.timestamp || 'N/A'}`,
  ];

  if (data.source) {
    lines.push(`Source: ${data.source}`);
  }

  if (data.message) {
    lines.push(`Message: ${data.message}`);
  }

  // Exception 专属：堆栈跟踪
  if (data.type === 'exception' && 'stack' in data && data.stack) {
    lines.push('### Stack Trace');
    lines.push(data.stack);
  }

  // Console 专属：参数列表
  const argsFormatted = formatArgs(data);
  if (argsFormatted) {
    lines.push(argsFormatted);
  }

  return lines.join('\n');
}

/**
 * 格式化分页信息
 */
export function formatPaginationInfo(
  total: number,
  pageSize: number,
  pageIdx: number
): {
  info: string[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const start = pageIdx * pageSize;
  const end = Math.min(start + pageSize, total);
  const hasNextPage = end < total;
  const hasPreviousPage = pageIdx > 0;

  const info: string[] = [
    `Total: ${total} messages`,
    `Showing: ${start + 1}-${end}`,
  ];

  if (hasNextPage) {
    info.push(`Next page: ${pageIdx + 1}`);
  }

  if (hasPreviousPage) {
    info.push(`Previous page: ${pageIdx - 1}`);
  }

  return { info, hasNextPage, hasPreviousPage };
}
