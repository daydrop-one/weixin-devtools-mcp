/**
 * Page Snapshot Tool
 * Handles getting page element snapshots and UID mapping
 */

import { z } from 'zod';
import { writeFile } from 'fs/promises';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import { getPageSnapshot, type PageSnapshot } from '../tools.js';
import { formatSnapshot, estimateTokens, type SnapshotFormat } from '../formatters/snapshotFormatter.js';

/**
 * Get page snapshot
 */
export const getPageSnapshotTool = defineTool({
  name: 'get_page_snapshot',
  description: `Get snapshot of current page elements, including uid information for all elements

Output format options:
- compact: Compact text format (recommended, 60-70% token reduction)
- minimal: Minimal format (only uid, tagName, text)
- json: Full JSON format (maintains backward compatibility)

Examples:
compact format:
  uid=view.container view "Welcome" pos=[0,64] size=[375x667]
  uid=button.submit button "Submit" pos=[100,400] size=[175x44]

minimal format:
  view.container view "Welcome"
  button.submit button "Submit"`,
  schema: z.object({
    format: z.enum(['compact', 'minimal', 'json']).default('compact').describe('Output format'),
    includePosition: z.boolean().default(true).describe('Whether to include position information (valid for compact and json formats)'),
    includeAttributes: z.boolean().default(false).describe('Whether to include attribute information (valid for compact and json formats)'),
    maxElements: z.number().positive().optional().describe('Limit number of elements returned'),
    filePath: z.string().optional().describe('Path to save snapshot to file (optional)'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    const { format, includePosition, includeAttributes, maxElements, filePath } = request.params;

    try {
      // Clear previous element mapping
      context.elementMap.clear();

      // Get page snapshot
      const { snapshot, elementMap } = await getPageSnapshot(context.currentPage);

      // Apply maxElements limit (for display and token estimation)
      const limitedElements = maxElements
        ? snapshot.elements.slice(0, maxElements)
        : snapshot.elements;
      const limitedSnapshot = { ...snapshot, elements: limitedElements };

      // Update element mapping in context (apply maxElements limit)
      if (maxElements) {
        // Only keep mappings for first maxElements elements
        const limitedUids = new Set(limitedElements.map(el => el.uid));
        elementMap.forEach((value, key) => {
          if (limitedUids.has(key)) {
            context.elementMap.set(key, value);
          }
        });
      } else {
        // No limit, add all element mappings
        elementMap.forEach((value, key) => {
          context.elementMap.set(key, value);
        });
      }

      // Format snapshot (using limited snapshot)
      const formattedSnapshot = formatSnapshot(limitedSnapshot, {
        format: format as SnapshotFormat,
        includePosition,
        includeAttributes,
        maxElements,
      });

      // If file path specified, save to file
      if (filePath) {
        await writeFile(filePath, formattedSnapshot, 'utf-8');
        response.appendResponseLine(`✅ Page snapshot saved to: ${filePath}`);
      }

      // Token estimation info (only shown in non-file output mode)
      if (!filePath) {
        const estimates = estimateTokens(limitedSnapshot);
        response.appendResponseLine(`📊 Page snapshot retrieved successfully`);
        response.appendResponseLine(`   Page path: ${snapshot.path}`);
        response.appendResponseLine(`   Element count: ${limitedElements.length}`);
        response.appendResponseLine(`   Output format: ${format}`);
        response.appendResponseLine(`   Token estimate: ~${estimates[format as SnapshotFormat]} tokens`);
        response.appendResponseLine('');

        // Output formatted snapshot
        response.appendResponseLine(formattedSnapshot);
      } else {
        response.appendResponseLine(`   Page path: ${snapshot.path}`);
        response.appendResponseLine(`   Element count: ${limitedElements.length}`);
        response.appendResponseLine(`   Output format: ${format}`);
      }

      // Set include snapshot info
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`❌ Failed to get page snapshot: ${errorMessage}`);
      throw error;
    }
  },
});
