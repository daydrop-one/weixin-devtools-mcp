#!/usr/bin/env node

/**
 * WeChat DevTools Automation MCP Server
 * Provides WeChat Mini Program automation testing features, including:
 * - Connect to WeChat DevTools
 * - Get page snapshots and element information
 * - Click page elements
 * - Other automation operations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import WeChat Mini Program automation SDK
import automator from "miniprogram-automator";
import path from "path";

// Import modular tool system
import {
  allTools,
  ToolDefinition,
  ToolContext,
  ToolRequest,
  ToolResponse,
  ConsoleStorage,
  NetworkStorage
} from './tools/index.js';

// Import ElementMapInfo type
import type { ElementMapInfo } from './tools.js';

// Import zod-to-json-schema for schema conversion
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Element snapshot interface
 */
interface ElementSnapshot {
  uid: string;           // Element unique identifier (using selector path)
  tagName: string;       // Tag name
  text?: string;         // Element text
  attributes?: Record<string, string>;   // Element attributes
  position?: {           // Element position info
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * Page snapshot interface
 */
interface PageSnapshot {
  path: string;          // Page path
  elements: ElementSnapshot[];  // All elements
}

/**
 * Global state management
 */
const state = {
  /** MiniProgram instance (from miniprogram-automator) */
  miniProgram: null as any,
  /** Current page instance (from miniprogram-automator's Page type) */
  currentPage: null as any,
  elementMap: new Map<string, ElementMapInfo>(), // uid -> ElementMapInfo mapping
  consoleStorage: {
    navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
    messageIdMap: new Map(),
    isMonitoring: false,
    startTime: null,
    maxNavigations: 3
  } as ConsoleStorage, // Console storage
  networkStorage: {
    requests: [],
    isMonitoring: false,
    startTime: null,
    originalMethods: {}
  } as NetworkStorage, // Network storage
};

/**
 * Modular tool adapter infrastructure
 */

// MockResponse adapter class - Adapts modular tool response interface
class MockResponse implements ToolResponse {
  private lines: string[] = [];
  private includeSnapshot = false;
  private attachedImages: Array<{ data: string; mimeType: string }> = [];

  appendResponseLine(line: string): void {
    this.lines.push(line);
  }

  setIncludeSnapshot(include: boolean): void {
    this.includeSnapshot = include;
  }

  attachImage(data: string, mimeType: string): void {
    this.attachedImages.push({ data, mimeType });
  }

  getLines(): string[] {
    return this.lines;
  }

  getAttachedImages(): Array<{ data: string; mimeType: string }> {
    return this.attachedImages;
  }
}

/**
 * Get element by UID implementation (index.ts version)
 */
async function getElementByUidForIndex(uid: string): Promise<any> {
  if (!state.currentPage) {
    throw new Error('Please connect to WeChat DevTools and get the current page first');
  }

  const mapInfo = state.elementMap.get(uid);
  if (!mapInfo) {
    throw new Error(
      `UID not found: ${uid}\n` +
      `Please call get_page_snapshot tool to get page snapshot first`
    );
  }

  console.log(`[getElementByUid] UID: ${uid}, Selector: ${mapInfo.selector}, Index: ${mapInfo.index}`);

  const elements = await state.currentPage.$$(mapInfo.selector);
  if (!elements || elements.length === 0) {
    throw new Error(
      `Selector "${mapInfo.selector}" found no elements\n` +
      `The page may have changed, please get the snapshot again`
    );
  }

  if (mapInfo.index >= elements.length) {
    throw new Error(
      `Element index ${mapInfo.index} is out of range (selector "${mapInfo.selector}" found ${elements.length} elements)\n` +
      `The page may have changed, please get the snapshot again`
    );
  }

  const element = elements[mapInfo.index];
  if (!element) {
    throw new Error(`Unable to get element at index ${mapInfo.index}`);
  }

  return element;
}

// State conversion function - Converts global state to ToolContext
function createToolContext(): ToolContext {
  return {
    miniProgram: state.miniProgram,
    currentPage: state.currentPage,
    elementMap: state.elementMap,
    consoleStorage: state.consoleStorage,
    networkStorage: state.networkStorage,
    getElementByUid: getElementByUidForIndex
  };
}

// Create tool handler mapping
const toolHandlers = new Map<string, ToolDefinition>();
allTools.forEach(tool => {
  toolHandlers.set(tool.name, tool);
});

// Tool definition conversion function - Converts modular tools to traditional MCP format
function convertToolDefinition(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema, {
      strictUnions: true
    }),
    annotations: tool.annotations
  };
}

/**
 * Create MCP server, providing WeChat DevTools automation features
 */
const server = new Server(
  {
    name: "weixin-devtools-mcp",
    version: "0.3.3",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Generate element unique identifier (uid)
 * Uses CSS selector path as uid
 */
async function generateElementUid(element: any, index: number): Promise<string> {
  try {
    const tagName = element.tagName;
    const className = await element.attribute('class').catch(() => '');
    const id = await element.attribute('id').catch(() => '');

    let selector = tagName;
    if (id) {
      selector += `#${id}`;
    } else if (className) {
      selector += `.${className.split(' ')[0]}`;
    } else {
      selector += `:nth-child(${index + 1})`;
    }

    return selector;
  } catch (error) {
    return `${element.tagName || 'unknown'}:nth-child(${index + 1})`;
  }
}

/**
 * Recursively get snapshots of all page elements
 */
async function getElementsSnapshot(container: any, prefix: string = ''): Promise<ElementSnapshot[]> {
  const elements: ElementSnapshot[] = [];

  try {
    // Get all child elements
    const childElements = await container.$$('*').catch(() => []);

    for (let i = 0; i < childElements.length; i++) {
      const element = childElements[i];
      try {
        const uid = await generateElementUid(element, i);
        const fullUid = prefix ? `${prefix} ${uid}` : uid;

        const snapshot: ElementSnapshot = {
          uid: fullUid,
          tagName: element.tagName || 'unknown',
        };

        // Get element text
        try {
          const text = await element.text();
          if (text && text.trim()) {
            snapshot.text = text.trim();
          }
        } catch (error) {
          // Ignore elements that cannot get text
        }

        // Get element position info
        try {
          const [size, offset] = await Promise.all([
            element.size(),
            element.offset()
          ]);

          snapshot.position = {
            left: offset.left,
            top: offset.top,
            width: size.width,
            height: size.height
          };
        } catch (error) {
          // Ignore elements that cannot get position
        }

        // Get common attributes
        try {
          const attributes: Record<string, string> = {};
          const commonAttrs = ['class', 'id', 'data-*'];
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
            snapshot.attributes = attributes;
          }
        } catch (error) {
          // Ignore attribute retrieval errors
        }

        elements.push(snapshot);

        // Store uid to ElementMapInfo mapping
        state.elementMap.set(fullUid, {
          selector: fullUid,
          index: 0
        });

      } catch (error) {
        console.warn(`Error processing element ${i}:`, error);
      }
    }
  } catch (error) {
    console.warn('Error getting elements snapshot:', error);
  }

  return elements;
}

/**
 * Handle resource list request
 * Provide available resources such as connection status and page snapshots
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  // Connection status resource
  resources.push({
    uri: "weixin://connection/status",
    mimeType: "application/json",
    name: "Connection Status",
    description: "WeChat DevTools connection status"
  });

  // If connected, provide page snapshot resource
  if (state.miniProgram && state.currentPage) {
    resources.push({
      uri: "weixin://page/snapshot",
      mimeType: "application/json",
      name: "Page Snapshot",
      description: "Current page element snapshot"
    });
  }

  return { resources };
});

/**
 * Handle resource read request
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);

  if (url.pathname === "/connection/status") {
    const status = {
      connected: !!state.miniProgram,
      hasCurrentPage: !!state.currentPage,
      pagePath: state.currentPage ? await state.currentPage.path : null
    };

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  if (url.pathname === "/page/snapshot") {
    if (!state.currentPage) {
      throw new Error("No active page currently");
    }

    try {
      const elements = await getElementsSnapshot(state.currentPage);
      const snapshot: PageSnapshot = {
        path: await state.currentPage.path,
        elements
      };

      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(snapshot, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get page snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Unknown resource: ${request.params.uri}`);
});

/**
 * Handle tool list request
 * Provide available WeChat automation tools (including all modular tools)
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Dynamically generate tool list, including all 29 tools
  const tools = allTools.map(tool => convertToolDefinition(tool));

  return { tools };
});

/**
 * Handle tool call request
 * Execute WeChat automation related operations
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "connect_devtools": {
      // Safely extract parameters, avoid converting undefined to string "undefined"
      const projectPathArg = request.params.arguments?.projectPath;
      if (!projectPathArg || typeof projectPathArg !== 'string') {
        throw new Error("Project path is required and must be a valid string path");
      }
      const projectPath = String(projectPathArg);

      const cliPath = request.params.arguments?.cliPath ? String(request.params.arguments.cliPath) : undefined;
      const port = request.params.arguments?.port ? Number(request.params.arguments.port) : undefined;

      try {
        // Handle @playground/wx format paths, convert to absolute filesystem path
        let resolvedProjectPath = projectPath;
        if (projectPath.startsWith('@playground/')) {
          // Convert to relative path, then resolve to absolute path
          const relativePath = projectPath.replace('@playground/', 'playground/');
          resolvedProjectPath = path.resolve(process.cwd(), relativePath);
        } else if (!path.isAbsolute(projectPath)) {
          // If not absolute path, convert to absolute path
          resolvedProjectPath = path.resolve(process.cwd(), projectPath);
        }

        const options: any = { projectPath: resolvedProjectPath };
        if (cliPath) options.cliPath = cliPath;
        if (port) options.port = port;

        // Launch and connect to WeChat DevTools
        state.miniProgram = await automator.launch(options);

        // Get current page
        state.currentPage = await state.miniProgram.currentPage();

        return {
          content: [{
            type: "text",
            text: `Successfully connected to WeChat DevTools\nProject path: ${resolvedProjectPath}\nCurrent page: ${state.currentPage ? await state.currentPage.path : 'Unknown'}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to connect to WeChat DevTools: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "get_current_page": {
      if (!state.miniProgram) {
        throw new Error("Please connect to WeChat DevTools first");
      }

      try {
        state.currentPage = await state.miniProgram.currentPage();
        const pagePath = await state.currentPage.path;

        return {
          content: [{
            type: "text",
            text: `Current page: ${pagePath}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get current page: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "get_page_snapshot": {
      if (!state.currentPage) {
        throw new Error("Please get the current page first");
      }

      try {
        // Clear previous element mapping
        state.elementMap.clear();

        // Get page snapshot
        const elements = await getElementsSnapshot(state.currentPage);
        const snapshot: PageSnapshot = {
          path: await state.currentPage.path,
          elements
        };

        return {
          content: [{
            type: "text",
            text: `Page snapshot obtained successfully\nPage path: ${snapshot.path}\nElement count: ${elements.length}\n\n${JSON.stringify(snapshot, null, 2)}`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to get page snapshot: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "click": {
      const uid = String(request.params.arguments?.uid);
      const dblClick = Boolean(request.params.arguments?.dblClick);

      if (!uid) {
        throw new Error("Element uid is required");
      }

      if (!state.currentPage) {
        throw new Error("Please get the current page first");
      }

      try {
        // Find element by uid
        const mapInfo = state.elementMap.get(uid);
        if (!mapInfo) {
          throw new Error(`Element with uid ${uid} not found, please get page snapshot first`);
        }

        // Get all matching elements
        const elements = await state.currentPage.$(mapInfo.selector);
        if (!elements || mapInfo.index >= elements.length) {
          throw new Error(`Cannot find element with selector ${mapInfo.selector}, index: ${mapInfo.index}`);
        }

        const element = elements[mapInfo.index];

        // Execute click operation
        await element.tap();

        // If double click, click again
        if (dblClick) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
          await element.tap();
        }

        return {
          content: [{
            type: "text",
            text: `${dblClick ? 'Double-clicked' : 'Clicked'} element successfully\nUID: ${uid}\nSelector: ${mapInfo.selector}[${mapInfo.index}]`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to click element: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    case "screenshot": {
      if (!state.miniProgram) {
        throw new Error("Please connect to WeChat DevTools first");
      }

      const path = request.params.arguments?.path ? String(request.params.arguments.path) : undefined;

      try {
        // Ensure page state is stable
        if (!state.currentPage) {
          state.currentPage = await state.miniProgram.currentPage();
        }

        // Ensure page is fully loaded and stable
        try {
          if (state.currentPage && typeof state.currentPage.waitFor === 'function') {
            // Wait for page to stabilize, increase wait time
            await state.currentPage.waitFor(1000);
          }
        } catch (waitError) {
          console.warn('Page wait failed, continue attempting screenshot:', waitError)
        }

        // Execute screenshot with retry mechanism
        let result: string | undefined = undefined
        let lastError: Error | undefined

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (path) {
              // Save to specified path
              await state.miniProgram.screenshot({ path });
              result = path
              break
            } else {
              // Return base64 data
              const base64Data = await state.miniProgram.screenshot();
              if (base64Data && typeof base64Data === 'string' && base64Data.length > 0) {
                result = base64Data
                break
              } else {
                throw new Error('Screenshot returned empty data')
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt < 3) {
              // Wait longer before retry to let page stabilize
              await new Promise(resolve => setTimeout(resolve, 1000 + attempt * 500))
            }
          }
        }

        if (!result && !path) {
          throw new Error(`Screenshot failed after 3 retries. Last error: ${lastError?.message || 'Unknown error'}`)
        }

        if (path) {
          return {
            content: [{
              type: "text",
              text: `Screenshot saved to: ${path}`
            }]
          };
        } else {
          const base64Data = result as string
          return {
            content: [{
              type: "text",
              text: `Screenshot obtained successfully\nBase64 data length: ${base64Data.length} characters\nFormat: ${base64Data.startsWith('data:image') ? 'data URL' : 'base64'}`
            }, {
              type: "image",
              data: base64Data,
              mimeType: "image/png"
            }]
          };
        }
      } catch (error) {
        throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    default: {
      // Use modular tool handler to handle new tools
      const toolHandler = toolHandlers.get(request.params.name);
      if (toolHandler) {
        try {
          const toolContext = createToolContext();
          const mockResponse = new MockResponse();

          // Create mock request object
          const toolRequest: ToolRequest = {
            params: request.params.arguments || {}
          };

          // Call modular tool handler
          await toolHandler.handler(toolRequest, mockResponse, toolContext);

          // Update global state (synchronized back from ToolContext)
          state.miniProgram = toolContext.miniProgram;
          state.currentPage = toolContext.currentPage;
          state.elementMap = toolContext.elementMap;
          state.consoleStorage = toolContext.consoleStorage;

          // Return response
          const responseLines = mockResponse.getLines();
          if (responseLines.length === 0) {
            responseLines.push(`Tool ${request.params.name} executed successfully`);
          }

          return {
            content: [{
              type: "text",
              text: responseLines.join('\n')
            }]
          };
        } catch (error) {
          throw new Error(`Tool ${request.params.name} execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    }
  }
});


/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
