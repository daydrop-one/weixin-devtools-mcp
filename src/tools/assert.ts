/**
 * Assertion Validation Tools
 * Provides various assertion validation functions for element states and content
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import {
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertElementAttribute,
  type ExistenceAssertOptions,
  type StateAssertOptions,
  type ContentAssertOptions,
  type AssertResult
} from '../tools.js';

/**
 * Assert element exists
 */
export const assertExistsTool = defineTool({
  name: 'assert_exists',
  description: 'Assert element exists or does not exist',
  schema: z.object({
    selector: z.string().optional().describe('CSS selector'),
    uid: z.string().optional().describe('Element UID'),
    shouldExist: z.boolean().describe('Expected existence state, true for exists, false for does not exist'),
    timeout: z.number().optional().default(5000).describe('Wait timeout in milliseconds, default 5000ms'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { selector, uid, shouldExist, timeout } = request.params;

    if (!selector && !uid) {
      throw new Error('Must provide selector or uid parameter');
    }

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: ExistenceAssertOptions = {
        selector,
        uid,
        shouldExist,
        timeout
      };

      const result: AssertResult = await assertElementExists(context.currentPage, options);

      // Return information based on assertion result
      response.appendResponseLine(`Assertion result: ${result.passed ? 'Passed' : 'Failed'}`);
      response.appendResponseLine(`Message: ${result.message}`);
      response.appendResponseLine(`Expected: ${result.expected}`);
      response.appendResponseLine(`Actual: ${result.actual}`);
      response.appendResponseLine(`Timestamp: ${new Date(result.timestamp).toISOString()}`);

      if (!result.passed) {
        throw new Error(`Assertion failed: ${result.message}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Assertion execution failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Assert element visibility
 */
export const assertVisibleTool = defineTool({
  name: 'assert_visible',
  description: 'Assert element is visible or not visible',
  schema: z.object({
    uid: z.string().describe('Element UID'),
    visible: z.boolean().describe('Expected visibility state, true for visible, false for not visible'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, visible } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: StateAssertOptions = { uid, visible };
      const result: AssertResult = await assertElementVisible(
        context.currentPage,
        context.elementMap,
        options
      );

      // Return information based on assertion result
      response.appendResponseLine(`Assertion result: ${result.passed ? 'Passed' : 'Failed'}`);
      response.appendResponseLine(`Message: ${result.message}`);
      response.appendResponseLine(`Expected: ${result.expected ? 'Visible' : 'Not visible'}`);
      response.appendResponseLine(`Actual: ${result.actual ? 'Visible' : 'Not visible'}`);
      response.appendResponseLine(`Timestamp: ${new Date(result.timestamp).toISOString()}`);

      if (!result.passed) {
        throw new Error(`Assertion failed: ${result.message}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Assertion execution failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Assert element text content
 */
export const assertTextTool = defineTool({
  name: 'assert_text',
  description: 'Assert element text content',
  schema: z.object({
    uid: z.string().describe('Element UID'),
    text: z.string().optional().describe('Exact match text'),
    textContains: z.string().optional().describe('Text to contain'),
    textMatches: z.string().optional().describe('Regular expression match'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, text, textContains, textMatches } = request.params;

    if (!text && !textContains && !textMatches) {
      throw new Error('Must specify one of text, textContains or textMatches parameters');
    }

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: ContentAssertOptions = {
        uid,
        text,
        textContains,
        textMatches
      };

      const result: AssertResult = await assertElementText(
        context.currentPage,
        context.elementMap,
        options
      );

      // Return information based on assertion result
      response.appendResponseLine(`Assertion result: ${result.passed ? 'Passed' : 'Failed'}`);
      response.appendResponseLine(`Message: ${result.message}`);
      response.appendResponseLine(`Expected: ${result.expected}`);
      response.appendResponseLine(`Actual: ${result.actual}`);
      response.appendResponseLine(`Timestamp: ${new Date(result.timestamp).toISOString()}`);

      if (!result.passed) {
        throw new Error(`Assertion failed: ${result.message}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Assertion execution failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Assert element attribute
 */
export const assertAttributeTool = defineTool({
  name: 'assert_attribute',
  description: 'Assert element attribute value',
  schema: z.object({
    uid: z.string().describe('Element UID'),
    attributeKey: z.string().describe('Attribute name'),
    attributeValue: z.string().describe('Expected attribute value'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, attributeKey, attributeValue } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: ContentAssertOptions = {
        uid,
        attribute: {
          key: attributeKey,
          value: attributeValue
        }
      };

      const result: AssertResult = await assertElementAttribute(
        context.currentPage,
        context.elementMap,
        options
      );

      // Return information based on assertion result
      response.appendResponseLine(`Assertion result: ${result.passed ? 'Passed' : 'Failed'}`);
      response.appendResponseLine(`Message: ${result.message}`);
      response.appendResponseLine(`Expected: ${result.expected}`);
      response.appendResponseLine(`Actual: ${result.actual}`);
      response.appendResponseLine(`Timestamp: ${new Date(result.timestamp).toISOString()}`);

      if (!result.passed) {
        throw new Error(`Assertion failed: ${result.message}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Assertion execution failed: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Assert element state (general)
 */
export const assertStateTool = defineTool({
  name: 'assert_state',
  description: 'Assert various states of element',
  schema: z.object({
    uid: z.string().describe('Element UID'),
    visible: z.boolean().optional().describe('Expected visibility state'),
    enabled: z.boolean().optional().describe('Expected enabled state'),
    checked: z.boolean().optional().describe('Expected checked state (checkbox/radio)'),
    focused: z.boolean().optional().describe('Expected focus state'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, visible, enabled, checked, focused } = request.params;

    if (visible === undefined && enabled === undefined && checked === undefined && focused === undefined) {
      throw new Error('Must specify at least one state parameter');
    }

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const results: AssertResult[] = [];

      // Visibility assertion
      if (visible !== undefined) {
        const options: StateAssertOptions = { uid, visible };
        const result = await assertElementVisible(
          context.currentPage,
          context.elementMap,
          options
        );
        results.push(result);
      }

      // TODO: Add more state assertions here, such as enabled, checked, focused
      // Currently only visible is implemented, other states need to extend underlying functions

      // Summarize results
      const allPassed = results.every(r => r.passed);
      const failedResults = results.filter(r => !r.passed);

      response.appendResponseLine(`Assertion result: ${allPassed ? 'All passed' : 'Partially failed'}`);
      response.appendResponseLine(`Check items: ${results.length}`);
      response.appendResponseLine(`Passed items: ${results.filter(r => r.passed).length}`);
      response.appendResponseLine(`Failed items: ${failedResults.length}`);

      if (failedResults.length > 0) {
        response.appendResponseLine('');
        response.appendResponseLine('Failure details:');
        failedResults.forEach((result, index) => {
          response.appendResponseLine(`${index + 1}. ${result.message}`);
        });
      }

      if (!allPassed) {
        throw new Error(`State assertion failed: ${failedResults.length}/${results.length} items failed`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Assertion execution failed: ${errorMessage}`);
      throw error;
    }
  },
});
