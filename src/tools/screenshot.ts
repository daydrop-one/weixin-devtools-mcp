/**
 * Screenshot Tool
 * Handles page screenshot functionality, supports saving to file or returning base64 data
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import { takeScreenshot, type ScreenshotOptions } from '../tools.js';

/**
 * Page screenshot
 */
export const screenshotTool = defineTool({
  name: 'screenshot',
  description: 'Take screenshot of current page, supports returning base64 data or saving to file',
  schema: z.object({
    path: z.string().optional().describe('Image save path (optional), if not provided returns base64 encoded image data'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.miniProgram) {
      throw new Error('Please connect to WeChat DevTools first');
    }

    const { path } = request.params;

    try {
      const options: ScreenshotOptions = {};
      if (path) options.path = path;

      const result = await takeScreenshot(context.miniProgram, options);

      if (path) {
        response.appendResponseLine(`Screenshot saved to: ${path}`);
      } else if (result) {
        response.appendResponseLine(`Screenshot captured successfully`);
        response.appendResponseLine(`Base64 data length: ${result.length} characters`);
        response.appendResponseLine(`Format: ${result.startsWith('data:image') ? 'data URL' : 'base64'}`);

        // Attach image to response
        response.attachImage(result, 'image/png');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Screenshot failed: ${errorMessage}`);
      throw error;
    }
  },
});
