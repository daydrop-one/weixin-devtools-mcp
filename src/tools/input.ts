/**
 * 输入交互工具
 * 负责页面元素的点击、填写等交互操作
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import { clickElement, type ClickOptions } from '../tools.js';

/**
 * 点击页面元素
 */
export const clickTool = defineTool({
  name: 'click',
  description: '点击指定uid的页面元素',
  schema: z.object({
    uid: z.string().describe('页面快照中元素的唯一标识符'),
    dblClick: z.boolean().optional().default(false).describe('是否为双击，默认false'),
  }),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    const { uid, dblClick } = request.params;

    if (!context.currentPage) {
      throw new Error('请先获取当前页面');
    }

    try {
      const options: ClickOptions = { uid, dblClick };
      await clickElement(context.currentPage, context.elementMap, options);

      const action = dblClick ? '双击' : '点击';
      response.appendResponseLine(`${action}元素成功`);
      response.appendResponseLine(`UID: ${uid}`);

      // 点击后可能页面发生变化，建议包含快照
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`点击元素失败: ${errorMessage}`);
      throw error;
    }
  },
});