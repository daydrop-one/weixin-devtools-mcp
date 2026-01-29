/**
 * Tool Definition Framework
 * Based on chrome-devtools-mcp design pattern
 */

import { z } from 'zod'
import type { ElementMapInfo } from '../tools.js'

/**
 * Tool category enumeration
 */
export enum ToolCategories {
  CONNECTION = 'Connection',
  PAGE_INTERACTION = 'Page interaction',
  AUTOMATION = 'Automation',
  DEBUGGING = 'Debugging'
}

/**
 * Tool annotations interface
 */
export interface ToolAnnotations {
  audience?: string[];
  experimental?: boolean;
}

/**
 * Console log type (extended to 15+ types)
 */
export type ConsoleMessageType =
  | 'log'
  | 'debug'
  | 'info'
  | 'error'
  | 'warn'
  | 'dir'
  | 'dirxml'
  | 'table'
  | 'trace'
  | 'clear'
  | 'group'
  | 'groupCollapsed'
  | 'groupEnd'
  | 'assert'
  | 'count'
  | 'timeEnd'
  | 'verbose';

/**
 * Console message interface (with Stable ID)
 */
export interface ConsoleMessage {
  msgid?: number;  // Stable ID for two-phase query
  type: ConsoleMessageType;
  message?: string;  // Formatted message text
  args: any[];
  timestamp: string;
  source?: string;
}

/**
 * Exception information (with Stable ID)
 */
export interface ExceptionMessage {
  msgid?: number;  // Stable ID for two-phase query
  message: string;
  stack?: string;
  timestamp: string;
  source?: string;
}

/**
 * Navigation session data
 */
export interface NavigationSession {
  messages: ConsoleMessage[];
  exceptions: ExceptionMessage[];
  timestamp: string;
}

/**
 * Console data storage (supports navigation history)
 */
export interface ConsoleStorage {
  // Store by navigation groups (newest first)
  navigations: NavigationSession[];

  // ID mapping table (for quick lookup)
  messageIdMap: Map<number, ConsoleMessage | ExceptionMessage>;

  // Monitoring state
  isMonitoring: boolean;
  startTime: string | null;

  // Configuration
  maxNavigations: number;  // Maximum navigation sessions to keep, default 3

  // ID generator
  idGenerator?: () => number;
}

/**
 * Network request type
 */
export type NetworkRequestType = 'request' | 'uploadFile' | 'downloadFile';

/**
 * Network request information
 */
export interface NetworkRequest {
  id: string;
  type: NetworkRequestType;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: any;
  params?: any;  // Query parameters for Mpx framework
  statusCode?: number;
  response?: any;
  responseHeaders?: Record<string, string>;  // Response headers
  error?: string;
  duration?: number;
  timestamp: string;
  completedAt?: string;  // Completion time
  success: boolean;
  pending?: boolean;  // Whether waiting for response
  source?: string;  // Request source (wx.request, getApp().$xfetch, etc.)
}

/**
 * Network request data storage
 */
export interface NetworkStorage {
  requests: NetworkRequest[];
  isMonitoring: boolean;
  startTime: string | null;
  originalMethods: {
    request?: any;
    uploadFile?: any;
    downloadFile?: any;
  };
}

/**
 * Tool handler context
 */
export interface ToolContext {
  /**
   * Mini program instance (MiniProgram type from miniprogram-automator)
   * Obtained via automator.connect() or automator.launch()
   */
  miniProgram: any;

  /**
   * Current page instance (Page type from miniprogram-automator)
   * Obtained via miniProgram.currentPage()
   */
  currentPage: any;

  elementMap: Map<string, ElementMapInfo>;
  consoleStorage: ConsoleStorage;
  networkStorage: NetworkStorage;

  /**
   * Get element by UID
   * Unified handling: connection check, snapshot check, element lookup, index positioning
   * @param uid Element unique identifier
   * @returns Element object
   * @throws If page not connected, UID doesn't exist, element not found, etc.
   */
  getElementByUid(uid: string): Promise<any>;
}

/**
 * Tool request interface
 */
export interface ToolRequest<T = any> {
  params: T;
}

/**
 * Tool response interface
 */
export interface ToolResponse {
  appendResponseLine(text: string): void;
  setIncludeSnapshot(include: boolean): void;
  attachImage(data: string, mimeType: string): void;
}

/**
 * Tool handler function type
 */
export type ToolHandler<TParams> = (
  request: ToolRequest<TParams>,
  response: ToolResponse,
  context: ToolContext
) => Promise<void>;

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  annotations?: ToolAnnotations;
  handler: ToolHandler<any>;
}

/**
 * Helper function to define a tool
 */
export function defineTool<TSchema extends z.ZodTypeAny>(definition: {
  name: string;
  description: string;
  schema: TSchema;
  annotations?: ToolAnnotations;
  handler: ToolHandler<z.infer<TSchema>>;
}): ToolDefinition {
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    annotations: definition.annotations,
    handler: definition.handler,
  };
}

/**
 * Simple response implementation class
 */
export class SimpleToolResponse implements ToolResponse {
  private responseLines: string[] = [];
  private includeSnapshot = false;
  private attachedImages: Array<{ data: string; mimeType: string }> = [];

  appendResponseLine(text: string): void {
    this.responseLines.push(text);
  }

  setIncludeSnapshot(include: boolean): void {
    this.includeSnapshot = include;
  }

  attachImage(data: string, mimeType: string): void {
    this.attachedImages.push({ data, mimeType });
  }

  getResponseText(): string {
    return this.responseLines.join('\n');
  }

  shouldIncludeSnapshot(): boolean {
    return this.includeSnapshot;
  }

  getAttachedImages(): Array<{ data: string; mimeType: string }> {
    return this.attachedImages;
  }
}
