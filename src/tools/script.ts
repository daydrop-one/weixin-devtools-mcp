/**
 * Script Execution Tool
 * Execute JavaScript code in Mini Program AppService context
 */

import { z } from 'zod';
import { defineTool } from './ToolDefinition.js';

export const evaluateScript = defineTool({
  name: 'evaluate_script',
  description: `Execute JavaScript code in Mini Program AppService context and return result.
Supports accessing wx API, getApp(), getCurrentPages() and other mini program global objects.
Return value must be JSON serializable type.`,

  schema: z.object({
    function: z.string().describe(
      `JavaScript function declaration to execute in Mini Program AppService context.
Supports both synchronous and asynchronous functions, can access wx API and getApp().

Note: Function will be serialized for transmission, cannot use closures to reference external variables.

No parameters example:
\`() => {
  return wx.getSystemInfoSync();
}\`

Or using string form:
\`"() => wx.getSystemInfoSync()"\`

Async example:
\`async () => {
  return new Promise(resolve => {
    wx.getSystemInfo({
      success: result => resolve(result)
    });
  });
}\`

With parameters example:
\`(key, value) => {
  wx.setStorageSync(key, value);
  return { success: true };
}\`

Accessing global data example:
\`() => {
  const app = getApp();
  return app.globalData;
}\`

Accessing current page example:
\`() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage.data;
}\``
    ),
    args: z.array(z.any()).optional().describe(
      `Optional array of arguments to pass to the function.
Arguments must be JSON serializable types (strings, numbers, booleans, objects, arrays, etc.).

Examples:
- Single argument: ["testKey"]
- Multiple arguments: ["key", 123, { foo: "bar" }]
- Complex object: [{ name: "test", data: [1, 2, 3] }]`
    )
  }),

  handler: async (request, response, context) => {
    // Check connection status
    if (!context.miniProgram) {
      throw new Error('Not connected to WeChat DevTools. Please use connect_devtools_enhanced to establish connection first.');
    }

    const { function: functionCode, args = [] } = request.params;

    try {
      // Execute script
      // miniProgram.evaluate will automatically handle function serialization and argument passing
      const result = await context.miniProgram.evaluate(functionCode, ...args);

      // Serialize result
      const serialized = JSON.stringify(result, null, 2);

      // Return response
      response.appendResponseLine('Script executed successfully in Mini Program AppService context');
      response.appendResponseLine('');
      response.appendResponseLine('Return result:');
      response.appendResponseLine('```json');
      response.appendResponseLine(serialized);
      response.appendResponseLine('```');

    } catch (error: any) {
      // Error handling
      const errorMessage = error.message || String(error);
      throw new Error(`Script execution failed: ${errorMessage}`);
    }
  }
});
