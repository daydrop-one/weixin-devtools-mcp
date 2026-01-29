/**
 * MCP Protocol Tests
 *
 * Test Objectives: Verify the correctness of MCP server protocol implementation
 * Features: Use StdioClientTransport to start server, test protocol layer functionality
 * Scope: Only test core protocol features, tool business logic tested in tests/tools/
 *
 * Reference: chrome-devtools-mcp/tests/index.test.ts
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper function: Create MCP client and execute callback
 */
async function withClient(cb: (client: Client) => Promise<void>) {
  const serverPath = path.join(__dirname, '../../build/server.js');

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
  });

  const client = new Client(
    {
      name: 'protocol-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    await cb(client);
  } finally {
    await client.close();
  }
}

describe('MCP Protocol Tests', () => {
  describe('Server Capabilities', () => {
    it('should successfully connect to MCP server', async () => {
      await withClient(async (client) => {
        // If we reach here, connection was successful
        expect(client).toBeDefined();
      });
    });

    it('should return correct server information', async () => {
      await withClient(async (client) => {
        // MCP SDK exchanges server information during connection
        const { tools } = await client.listTools();
        expect(tools).toBeDefined();
      });
    });
  });

  describe('Tools Registration', () => {
    it('should register all 40 tools', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();

        expect(tools).toHaveLength(40);

        // Verify tool name format (supports snake_case, camelCase, and special characters like $)
        tools.forEach(tool => {
          expect(tool.name).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/);
        });
      });
    });

    it('should include all core tools', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();
        const toolNames = tools.map(t => t.name);

        // Verify connection management tools
        expect(toolNames).toContain('connect_devtools');
        expect(toolNames).toContain('connect_devtools_enhanced');
        expect(toolNames).toContain('get_current_page');

        // Verify page query tools
        expect(toolNames).toContain('$');
        expect(toolNames).toContain('waitFor');
        expect(toolNames).toContain('get_page_snapshot');

        // Verify interaction operation tools
        expect(toolNames).toContain('click');
        expect(toolNames).toContain('input_text');

        // Verify assertion tools
        expect(toolNames).toContain('assert_exists');
        expect(toolNames).toContain('assert_text');

        // Verify navigation tools
        expect(toolNames).toContain('navigate_to');
        expect(toolNames).toContain('navigate_back');
      });
    });

    it('each tool should have complete definition', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();

        tools.forEach(tool => {
          // Verify required fields
          expect(tool.name).toBeDefined();
          expect(tool.description).toBeDefined();
          expect(tool.inputSchema).toBeDefined();

          // Verify description is not empty
          expect(tool.description.length).toBeGreaterThan(0);

          // Verify inputSchema is valid JSON Schema
          expect(tool.inputSchema.type).toBe('object');
          expect(tool.inputSchema.properties).toBeDefined();
        });
      });
    });
  });

  describe('Tool Schema Validation', () => {
    it('connect_devtools_enhanced should have correct schema', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();
        const tool = tools.find(t => t.name === 'connect_devtools_enhanced');

        expect(tool).toBeDefined();
        expect(tool!.inputSchema.properties.projectPath).toBeDefined();
        expect(tool!.inputSchema.properties.mode).toBeDefined();
        expect(tool!.inputSchema.required).toContain('projectPath');

        // Verify mode enum values
        const modeSchema = tool!.inputSchema.properties.mode;
        expect(modeSchema.enum).toEqual(['auto', 'launch', 'connect']);
      });
    });

    it('$ selector tool should have correct schema', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();
        const tool = tools.find(t => t.name === '$');

        expect(tool).toBeDefined();
        expect(tool!.inputSchema.properties.selector).toBeDefined();
        expect(tool!.inputSchema.required).toContain('selector');
      });
    });

    it('waitFor tool should have correct schema', async () => {
      await withClient(async (client) => {
        const { tools } = await client.listTools();
        const tool = tools.find(t => t.name === 'waitFor');

        expect(tool).toBeDefined();
        const props = tool!.inputSchema.properties;

        // Verify all optional parameters
        expect(props.selector).toBeDefined();
        expect(props.delay).toBeDefined();
        expect(props.timeout).toBeDefined();
        expect(props.disappear).toBeDefined();
        expect(props.text).toBeDefined();
      });
    });
  });

  describe('Tool Invocation', () => {
    it('should be able to call diagnose_connection tool (without connection)', async () => {
      await withClient(async (client) => {
        const result = await client.callTool({
          name: 'diagnose_connection',
          arguments: {
            projectPath: '/tmp/test-project',
            verbose: false
          }
        });

        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
      });
    });

    it('should be able to call check_environment tool', async () => {
      await withClient(async (client) => {
        const result = await client.callTool({
          name: 'check_environment',
          arguments: {}
        });

        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');

        const text = result.content[0].text;
        expect(text).toContain('Environment check');
      });
    });

    it('calling tools requiring connection should return error', async () => {
      await withClient(async (client) => {
        try {
          await client.callTool({
            name: 'get_page_snapshot',
            arguments: {}
          });
          // Should not reach here
          expect.fail('Should throw error');
        } catch (error) {
          // Expected error: not connected to WeChat DevTools
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('calling non-existent tool should return error', async () => {
      await withClient(async (client) => {
        try {
          await client.callTool({
            name: 'non_existent_tool',
            arguments: {}
          });
          expect.fail('Should throw error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('passing wrong parameter type should return error', async () => {
      await withClient(async (client) => {
        try {
          await client.callTool({
            name: 'connect_devtools_enhanced',
            arguments: {
              projectPath: 123, // Wrong type: should be string
              mode: 'auto'
            }
          });
          expect.fail('Should throw error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('missing required parameters should return error', async () => {
      await withClient(async (client) => {
        try {
          await client.callTool({
            name: 'click',
            arguments: {} // Missing required uid parameter
          });
          expect.fail('Should throw error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });
});
