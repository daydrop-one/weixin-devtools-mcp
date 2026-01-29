/**
 * Input Interaction Tools
 * Handles page element click, fill and other interaction operations
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import {
  clickElement,
  inputText,
  getElementValue,
  setFormControl,
  type ClickOptions,
  type InputTextOptions,
  type GetValueOptions,
  type FormControlOptions
} from '../tools.js';

/**
 * Click page element
 */
export const clickTool = defineTool({
  name: 'click',
  description: 'Click page element by uid',
  schema: z.object({
    uid: z.string().describe('Unique identifier of element in page snapshot'),
    dblClick: z.boolean().optional().default(false).describe('Whether to double-click, default false'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, dblClick } = request.params;

    // Use unified element retrieval method
    const element = await context.getElementByUid(uid);

    // Record page path before click
    const beforePath = await context.currentPage.path;
    console.log(`[Click] Page before click: ${beforePath}`);

    // Execute click operation
    await element.tap();
    console.log(`[Click] Executed tap() operation`);

    // If double-click, click again
    if (dblClick) {
      await new Promise(resolve => setTimeout(resolve, 100));
      await element.tap();
      console.log(`[Click] Executed second tap() (double-click)`);
    }

    // Wait for page response
    await new Promise(resolve => setTimeout(resolve, 300));

    // Record page path after click
    try {
      const afterPath = await context.currentPage.path;
      console.log(`[Click] Page after click: ${afterPath}`);
      if (beforePath !== afterPath) {
        console.log(`[Click] ✅ Page switched: ${beforePath} → ${afterPath}`);
      }
    } catch (error) {
      console.warn(`[Click] Unable to get page path after click:`, error);
    }

    const action = dblClick ? 'Double-clicked' : 'Clicked';
    response.appendResponseLine(`${action} element successfully`);
    response.appendResponseLine(`UID: ${uid}`);

    // Page may have changed after click, suggest including snapshot
    response.setIncludeSnapshot(true);
  },
});

/**
 * Input text into element
 */
export const inputTextTool = defineTool({
  name: 'input_text',
  description: 'Input text into input/textarea element',
  schema: z.object({
    uid: z.string().describe('Unique identifier of element in page snapshot'),
    text: z.string().describe('Text content to input'),
    clear: z.boolean().optional().default(false).describe('Whether to clear element content first, default false'),
    append: z.boolean().optional().default(false).describe('Whether to append to existing content, default false'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, text, clear, append } = request.params;

    // Use unified element retrieval method
    const element = await context.getElementByUid(uid);

    // Handle input logic
    if (clear) {
      // Clear and input
      element.value = '';
      await element.input(text);
      console.log(`[InputText] Cleared and input: ${text}`);
    } else if (append) {
      // Append content
      const currentValue = element.value || '';
      await element.input(currentValue + text);
      console.log(`[InputText] Appended text: ${text}`);
    } else {
      // Direct input
      await element.input(text);
      console.log(`[InputText] Input text: ${text}`);
    }

    let action = 'Input text';
    if (clear) action = 'Cleared and input text';
    if (append) action = 'Appended text';

    response.appendResponseLine(`${action} successfully`);
    response.appendResponseLine(`UID: ${uid}`);
    response.appendResponseLine(`Content: ${text}`);

    // Page may have changed after input
    response.setIncludeSnapshot(true);
  },
});

/**
 * Get element value
 */
export const getValueTool = defineTool({
  name: 'get_value',
  description: 'Get element value or text content',
  schema: z.object({
    uid: z.string().describe('Unique identifier of element in page snapshot'),
    attribute: z.string().optional().describe('Attribute name to get, if not specified gets value or text'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, attribute } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: GetValueOptions = { uid, attribute };
      const value = await getElementValue(context.currentPage, context.elementMap, options);

      response.appendResponseLine(`Get element value successfully`);
      response.appendResponseLine(`UID: ${uid}`);
      if (attribute) {
        response.appendResponseLine(`Attribute: ${attribute}`);
      }
      response.appendResponseLine(`Value: ${value}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to get element value: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Set form control value
 */
export const setFormControlTool = defineTool({
  name: 'set_form_control',
  description: 'Set value of form controls (such as picker, switch, slider, etc.)',
  schema: z.object({
    uid: z.string().describe('Unique identifier of element in page snapshot'),
    value: z.any().describe('Value to set'),
    trigger: z.string().optional().default('change').describe('Event type to trigger, default is change'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, value, trigger } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: FormControlOptions = { uid, value, trigger };
      await setFormControl(context.currentPage, context.elementMap, options);

      response.appendResponseLine(`Set form control successfully`);
      response.appendResponseLine(`UID: ${uid}`);
      response.appendResponseLine(`Value: ${JSON.stringify(value)}`);
      response.appendResponseLine(`Event: ${trigger}`);

      // Page may have changed after setting
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to set form control: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Picker select option (picker-specific)
 */
export const selectPickerTool = defineTool({
  name: 'select_picker',
  description: 'Select option in picker control',
  schema: z.object({
    uid: z.string().describe('Unique identifier of picker element'),
    value: z.union([z.number(), z.string(), z.array(z.any())]).describe('Option value, can be index, text or multi-select array'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, value } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: FormControlOptions = { uid, value, trigger: 'change' };
      await setFormControl(context.currentPage, context.elementMap, options);

      response.appendResponseLine(`Selected picker option successfully`);
      response.appendResponseLine(`UID: ${uid}`);
      response.appendResponseLine(`Option: ${JSON.stringify(value)}`);

      // Page may have changed after selection
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to select picker option: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Toggle switch state (switch-specific)
 */
export const toggleSwitchTool = defineTool({
  name: 'toggle_switch',
  description: 'Toggle switch state',
  schema: z.object({
    uid: z.string().describe('Unique identifier of switch element'),
    checked: z.boolean().describe('Switch state, true for on, false for off'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, checked } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: FormControlOptions = { uid, value: checked, trigger: 'change' };
      await setFormControl(context.currentPage, context.elementMap, options);

      response.appendResponseLine(`Toggled switch state successfully`);
      response.appendResponseLine(`UID: ${uid}`);
      response.appendResponseLine(`State: ${checked ? 'On' : 'Off'}`);

      // Page may have changed after toggle
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to toggle switch state: ${errorMessage}`);
      throw error;
    }
  },
});

/**
 * Set slider value (slider-specific)
 */
export const setSliderTool = defineTool({
  name: 'set_slider',
  description: 'Set slider value',
  schema: z.object({
    uid: z.string().describe('Unique identifier of slider element'),
    value: z.number().describe('Slider value'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, value } = request.params;

    if (!context.currentPage) {
      throw new Error('Please get current page first');
    }

    try {
      const options: FormControlOptions = { uid, value, trigger: 'change' };
      await setFormControl(context.currentPage, context.elementMap, options);

      response.appendResponseLine(`Set slider value successfully`);
      response.appendResponseLine(`UID: ${uid}`);
      response.appendResponseLine(`Value: ${value}`);

      // Page may have changed after setting
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to set slider value: ${errorMessage}`);
      throw error;
    }
  },
});
