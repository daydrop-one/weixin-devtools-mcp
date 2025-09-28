/**
 * 页面快照工具
 * 负责获取页面元素快照和UID映射
 */

import { z } from 'zod';
import { defineTool, ToolCategories } from './ToolDefinition.js';
import { getPageSnapshot, type PageSnapshot } from '../tools.js';

/**
 * 获取页面快照
 */
export const getPageSnapshotTool = defineTool({
  name: 'get_page_snapshot',
  description: '获取当前页面的元素快照，包含所有元素的uid信息',
  schema: z.object({}),
  annotations: {
    audience: ['developers'],
  },
  handler: async (request, response, context) => {
    if (!context.currentPage) {
      throw new Error('请先获取当前页面');
    }

    try {
      // 清空之前的元素映射
      context.elementMap.clear();

      // 获取页面快照
      const { snapshot, elementMap } = await getPageSnapshot(context.currentPage);

      // 更新上下文中的元素映射
      elementMap.forEach((value, key) => {
        context.elementMap.set(key, value);
      });

      response.appendResponseLine(`页面快照获取成功`);
      response.appendResponseLine(`页面路径: ${snapshot.path}`);
      response.appendResponseLine(`元素数量: ${snapshot.elements.length}`);
      response.appendResponseLine('');
      response.appendResponseLine(JSON.stringify(snapshot, null, 2));

      // 设置包含快照信息
      response.setIncludeSnapshot(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`获取页面快照失败: ${errorMessage}`);
      throw error;
    }
  },
});