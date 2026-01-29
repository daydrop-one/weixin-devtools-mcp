/**
 * Page Query and Wait Tools
 * Provides browser-like $ selector and waitFor wait functionality
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import {
  queryElements,
  waitForCondition,
  type QueryOptions,
  type WaitForOptions
} from '../tools.js';

/**
 * $ selector tool - Find page elements by CSS selector
 */
export const querySelectorTool = defineTool({
  name: '$',
  description: 'Find page elements by CSS selector, return detailed information of matching elements',
  schema: z.object({
    selector: z.string().min(1, 'Selector cannot be empty').describe('CSS selector, e.g.: view.container, #myId, .myClass, text=button'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { selector } = request.params;

    // Validate selector
    if (!selector || typeof selector !== 'string' || selector.trim() === '') {
      throw new Error('Selector cannot be empty');
    }

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: QueryOptions = { selector };
      const results = await queryElements(context.currentPage, context.elementMap, options);

      if (results.length === 0) {
        response.appendResponseLine(`No elements found matching selector "${selector}"`);
        return;
      }

      response.appendResponseLine(`Found ${results.length} matching element(s):`);
      response.appendResponseLine('');

      for (let i = 0; i < results.length; i++) {
        const element = results[i];
        response.appendResponseLine(`[${i + 1}] ${element.tagName} (uid: ${element.uid})`);

        if (element.text) {
          response.appendResponseLine(`    Text: ${element.text}`);
        }

        if (element.attributes) {
          const attrs = Object.entries(element.attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
          response.appendResponseLine(`    Attributes: ${attrs}`);
        }

        if (element.position) {
          const { left, top, width, height } = element.position;
          response.appendResponseLine(`    Position: (${left}, ${top}) Size: ${width}x${height}`);
        }

        response.appendResponseLine('');
      }

      // Query may discover new elements, include snapshot info
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Element query failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * waitFor wait tool - Wait for condition to be met
 */
export const waitForTool = defineTool({
  name: 'waitFor',
  description: 'Wait for conditions to be met, supports waiting for element appearance, disappearance, text matching, etc.',
  schema: z.object({
    // Supports three modes:
    // 1. Time wait: { delay: 1000 }
    // 2. Selector wait: { selector: ".button" }
    // 3. Complex condition: { selector: ".button", text: "Submit", timeout: 5000 }
    delay: z.number().optional().describe('Wait for specified milliseconds (time wait mode)'),
    selector: z.string().optional().describe('Wait for element selector (selector wait mode)'),
    timeout: z.number().optional().default(5000).describe('Timeout in milliseconds, default 5000ms'),
    text: z.string().optional().describe('Wait for element containing specified text'),
    visible: z.boolean().optional().describe('Wait for element visibility state, true for visible, false for hidden'),
    disappear: z.boolean().optional().default(false).describe('Wait for element to disappear, default false'),
  }).refine(
    (data) => data.delay !== undefined || data.selector !== undefined,
    { message: 'Must provide either delay (time wait) or selector (selector wait)' }
  ),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const options = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const startTime = Date.now();

      // Build wait description and actual wait parameters
      let waitDescription = '';
      let waitParam: number | string | WaitForOptions;

      if (options.delay !== undefined) {
        // Time wait mode
        waitDescription = `Wait ${options.delay}ms`;
        waitParam = options.delay;
      } else if (options.selector) {
        // Selector wait mode
        const parts = [];
        parts.push(`selector "${options.selector}"`);
        if (options.disappear) parts.push('to disappear');
        else parts.push('to appear');
        if (options.text) parts.push(`with text "${options.text}"`);
        if (options.visible !== undefined) {
          parts.push(options.visible ? 'visible' : 'hidden');
        }
        waitDescription = `Wait for ${parts.join(' and ')}`;
        if (options.timeout) {
          waitDescription += ` (timeout: ${options.timeout}ms)`;
        }

        // Build WaitForOptions parameters
        waitParam = {
          selector: options.selector,
          timeout: options.timeout,
          ...(options.text && { text: options.text }),
          ...(options.visible !== undefined && { visible: options.visible }),
          ...(options.disappear !== undefined && { disappear: options.disappear }),
        };
      } else {
        throw new Error('Must provide delay or selector parameter');
      }

      response.appendResponseLine(`Starting ${waitDescription}...`);

      const result = await waitForCondition(context.currentPage, waitParam);

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (result) {
        response.appendResponseLine(`Wait successful, took ${duration}ms`);

        // After wait completes, page may have changed
        response.setIncludeSnapshot(true);
      } else {
        response.appendResponseLine(`Wait failed, took ${duration}ms`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Wait failed: ${errorMessage}`);
      throw error;
    }
  },
});
