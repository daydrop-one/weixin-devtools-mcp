#!/usr/bin/env node

/**
 * WeChat DevTools Automation MCP Server (Modular Version)
 * Refactored based on chrome-devtools-mcp architecture pattern
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  allTools,
  ToolContext,
  ToolRequest,
  SimpleToolResponse,
  ToolDefinition
} from './tools/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Get element by UID implementation
 */
async function getElementByUid(uid: string): Promise<any> {
  // 1. Check if page is connected
  if (!globalContext.currentPage) {
    throw new Error('Please connect to WeChat DevTools and get the current page first');
  }

  // 2. Check if UID exists in elementMap
  const mapInfo = globalContext.elementMap.get(uid);
  if (!mapInfo) {
    throw new Error(
      `UID not found: ${uid}\n` +
      `Please call get_page_snapshot tool to get page snapshot first`
    );
  }

  console.log(`[getElementByUid] UID: ${uid}, Selector: ${mapInfo.selector}, Index: ${mapInfo.index}`);

  // 3. Get all matching elements using selector
  const elements = await globalContext.currentPage.$$(mapInfo.selector);
  if (!elements || elements.length === 0) {
    throw new Error(
      `Selector "${mapInfo.selector}" found no elements\n` +
      `The page may have changed, please get the snapshot again`
    );
  }

  // 4. Check if index is valid
  if (mapInfo.index >= elements.length) {
    throw new Error(
      `Element index ${mapInfo.index} is out of range (selector "${mapInfo.selector}" found ${elements.length} elements)\n` +
      `The page may have changed, please get the snapshot again`
    );
  }

  // 5. Return target element
  const element = elements[mapInfo.index];
  if (!element) {
    throw new Error(`Unable to get element at index ${mapInfo.index}`);
  }

  return element;
}

/**
 * Global context state
 */
const globalContext: ToolContext = {
  miniProgram: null,
  currentPage: null,
  elementMap: new Map(),
  consoleStorage: {
    navigations: [{ messages: [], exceptions: [], timestamp: new Date().toISOString() }],
    messageIdMap: new Map(),
    isMonitoring: false,
    startTime: null,
    maxNavigations: 3,
  },
  networkStorage: {
    requests: [],
    isMonitoring: false,
    startTime: null,
    originalMethods: {},
  },
  getElementByUid,
};

/**
 * Create MCP server
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
 * Tool handler mapping
 */
const toolHandlers = new Map<string, ToolDefinition>();

/**
 * Register tool to MCP server
 */
function registerTool(tool: ToolDefinition): void {
  toolHandlers.set(tool.name, tool);
}

/**
 * Handle resource list request
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
  if (globalContext.miniProgram && globalContext.currentPage) {
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

  // For weixin://connection/status, url.host="connection", url.pathname="/status"
  // For weixin://page/snapshot, url.host="page", url.pathname="/snapshot"
  const resourcePath = `${url.host}${url.pathname}`;

  if (resourcePath === "connection/status") {
    const status = {
      connected: !!globalContext.miniProgram,
      hasCurrentPage: !!globalContext.currentPage,
      pagePath: globalContext.currentPage ? await globalContext.currentPage.path : null,
      elementCount: globalContext.elementMap.size
    };

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(status, null, 2)
      }]
    };
  }

  if (resourcePath === "page/snapshot") {
    if (!globalContext.currentPage) {
      throw new Error("No active page currently");
    }

    try {
      // Page snapshot retrieval logic can be implemented here
      const snapshot = {
        path: await globalContext.currentPage.path,
        elementCount: globalContext.elementMap.size,
        timestamp: new Date().toISOString()
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
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = allTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema, {
      strictUnions: true
    }),
    annotations: tool.annotations
  }));

  return { tools };
});

/**
 * Handle tool call request
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = toolHandlers.get(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    // Validate parameters
    const validatedParams = tool.schema.parse(request.params.arguments || {});

    // Create tool request and response objects
    const toolRequest: ToolRequest = { params: validatedParams };
    const toolResponse = new SimpleToolResponse();

    // Execute tool handler
    await tool.handler(toolRequest, toolResponse, globalContext);

    // Build response content
    const content: any[] = [];

    // Add text response
    const responseText = toolResponse.getResponseText();
    if (responseText) {
      content.push({
        type: "text",
        text: responseText
      });
    }

    // Add attached images
    const attachedImages = toolResponse.getAttachedImages();
    for (const image of attachedImages) {
      content.push({
        type: "image",
        data: image.data,
        mimeType: image.mimeType
      });
    }

    return { content };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Tool execution failed: ${errorMessage}`
      }],
      isError: true
    };
  }
});

/**
 * Register all tools
 */
for (const tool of allTools) {
  registerTool(tool);
}

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});