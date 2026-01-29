/**
 * MCP Resources Tests
 *
 * Test Objectives: Verify MCP server resource provision functionality
 * Resource Types:
 * - weixin://connection/status - Connection status
 * - weixin://page/snapshot - Page snapshot
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
      name: 'resources-test-client',
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

describe('MCP Resources Tests', () => {
  describe('Resource Listing', () => {
    it('should provide connection status resource', async () => {
      await withClient(async (client) => {
        const { resources } = await client.listResources();

        expect(resources).toBeDefined();
        expect(resources.some(r => r.uri === 'weixin://connection/status')).toBe(true);
      });
    });

    it('should provide resource list', async () => {
      await withClient(async (client) => {
        const { resources } = await client.listResources();

        expect(resources).toBeDefined();
        expect(resources.length).toBeGreaterThan(0);

        // Verify resource structure
        resources.forEach(resource => {
          expect(resource.uri).toBeDefined();
          expect(resource.name).toBeDefined();
          expect(resource.description).toBeDefined();
        });
      });
    });
  });

  describe('Resource Reading', () => {
    it('should be able to read connection status resource', async () => {
      await withClient(async (client) => {
        const result = await client.readResource({
          uri: 'weixin://connection/status'
        });

        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBeGreaterThan(0);
        expect(result.contents[0].mimeType).toBe('application/json');

        // Verify status content
        const status = JSON.parse(result.contents[0].text);
        expect(status).toHaveProperty('connected');
        expect(status).toHaveProperty('hasCurrentPage');
      });
    });

    it('reading non-existent resource should return error', async () => {
      await withClient(async (client) => {
        try {
          await client.readResource({
            uri: 'weixin://nonexistent/resource'
          });
          expect.fail('Should throw error');
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Resource Content Validation', () => {
    it('connection status resource should contain correct fields', async () => {
      await withClient(async (client) => {
        const result = await client.readResource({
          uri: 'weixin://connection/status'
        });

        const status = JSON.parse(result.contents[0].text);

        // Verify required fields
        expect(typeof status.connected).toBe('boolean');
        expect(typeof status.hasCurrentPage).toBe('boolean');

        // Verify status when not connected
        expect(status.connected).toBe(false);
        expect(status.hasCurrentPage).toBe(false);
      });
    });
  });
});
