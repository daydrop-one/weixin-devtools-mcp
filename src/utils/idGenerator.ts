/**
 * Stable ID 生成器
 * 参考 chrome-devtools-mcp 的设计模式
 */

/**
 * 创建一个自增 ID 生成器
 * @returns 返回一个函数，每次调用生成唯一的递增 ID
 */
export function createIdGenerator(): () => number {
  let i = 1;
  return () => {
    if (i === Number.MAX_SAFE_INTEGER) {
      i = 0;
    }
    return i++;
  };
}

/**
 * Symbol 用于标记对象的 stable ID
 * 使用 Symbol 避免与对象的其他属性冲突
 */
export const stableIdSymbol = Symbol('stableIdSymbol');

/**
 * 带 Stable ID 标记的类型
 */
export type WithStableId<T> = T & {
  [stableIdSymbol]?: number;
};
