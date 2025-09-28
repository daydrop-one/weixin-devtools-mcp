/**
 * 微信开发者工具 MCP 工具函数
 * 提供可测试的纯函数实现
 */

import automator from "miniprogram-automator";
import path from "path";

/**
 * 连接选项接口
 */
export interface ConnectOptions {
  projectPath: string;
  cliPath?: string;
  port?: number;
}

/**
 * 连接结果接口
 */
export interface ConnectResult {
  miniProgram: any;
  currentPage: any;
  pagePath: string;
}

/**
 * 连接到微信开发者工具
 *
 * @param options 连接选项
 * @returns 连接结果
 * @throws 连接失败时抛出错误
 */
export async function connectDevtools(options: ConnectOptions): Promise<ConnectResult> {
  const { projectPath, cliPath, port } = options;

  if (!projectPath) {
    throw new Error("项目路径是必需的");
  }

  try {
    // 处理@playground/wx格式的路径，转换为绝对文件系统路径
    let resolvedProjectPath = projectPath;
    if (projectPath.startsWith('@playground/')) {
      // 转换为相对路径，然后解析为绝对路径
      const relativePath = projectPath.replace('@playground/', 'playground/');
      resolvedProjectPath = path.resolve(process.cwd(), relativePath);
    } else if (!path.isAbsolute(projectPath)) {
      // 如果不是绝对路径，转换为绝对路径
      resolvedProjectPath = path.resolve(process.cwd(), projectPath);
    }

    // 构建 automator.launch 的选项
    const launchOptions: any = { projectPath: resolvedProjectPath };
    if (cliPath) launchOptions.cliPath = cliPath;
    if (port) launchOptions.port = port;

    // 启动并连接微信开发者工具
    const miniProgram = await automator.launch(launchOptions).then(async (result) => {
      try {
        const screenshotResult = await result.screenshot({
          path: 'screenshot.png'
        })
        console.log('------> result', result)
        console.log('------> screenshotResult', screenshotResult)
        return result
      } catch (e) {
        console.log('------> e', e)
      }
    });




    // 获取当前页面
    const currentPage = await miniProgram!.currentPage();
    if (!currentPage) {
      throw new Error("无法获取当前页面");
    }
    const pagePath = await currentPage.path;

    return {
      miniProgram,
      currentPage,
      pagePath
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`连接微信开发者工具失败: ${errorMessage}`);
  }
}

/**
 * 元素快照接口
 */
export interface ElementSnapshot {
  uid: string;
  tagName: string;
  text?: string;
  attributes?: Record<string, string>;
  position?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * 页面快照接口
 */
export interface PageSnapshot {
  path: string;
  elements: ElementSnapshot[];
}

/**
 * 生成元素的唯一标识符 (uid)
 */
export async function generateElementUid(element: any, index: number): Promise<string> {
  try {
    const tagName = element.tagName;
    const className = await element.attribute('class').catch(() => '');
    const id = await element.attribute('id').catch(() => '');

    let selector = tagName;
    if (id) {
      selector += `#${id}`;
    } else if (className) {
      selector += `.${className.split(' ')[0]}`;
    } else {
      selector += `:nth-child(${index + 1})`;
    }

    return selector;
  } catch (error) {
    return `${element.tagName || 'unknown'}:nth-child(${index + 1})`;
  }
}

/**
 * 获取页面元素快照
 *
 * @param page 页面对象
 * @returns 页面快照和元素映射
 */
export async function getPageSnapshot(page: any): Promise<{
  snapshot: PageSnapshot;
  elementMap: Map<string, string>;
}> {
  if (!page) {
    throw new Error("页面对象是必需的");
  }

  try {
    const elements: ElementSnapshot[] = [];
    const elementMap = new Map<string, string>();

    // 获取所有子元素
    const childElements = await page.$$('*').catch(() => []);

    for (let i = 0; i < childElements.length; i++) {
      const element = childElements[i];
      try {
        const uid = await generateElementUid(element, i);

        const snapshot: ElementSnapshot = {
          uid,
          tagName: element.tagName || 'unknown',
        };

        // 获取元素文本
        try {
          const text = await element.text();
          if (text && text.trim()) {
            snapshot.text = text.trim();
          }
        } catch (error) {
          // 忽略无法获取文本的元素
        }

        // 获取元素位置信息
        try {
          const [size, offset] = await Promise.all([
            element.size(),
            element.offset()
          ]);

          snapshot.position = {
            left: offset.left,
            top: offset.top,
            width: size.width,
            height: size.height
          };
        } catch (error) {
          // 忽略无法获取位置的元素
        }

        // 获取常用属性
        try {
          const attributes: Record<string, string> = {};
          const commonAttrs = ['class', 'id', 'data-*'];
          for (const attr of commonAttrs) {
            try {
              const value = await element.attribute(attr);
              if (value) {
                attributes[attr] = value;
              }
            } catch (error) {
              // 忽略不存在的属性
            }
          }

          if (Object.keys(attributes).length > 0) {
            snapshot.attributes = attributes;
          }
        } catch (error) {
          // 忽略属性获取错误
        }

        elements.push(snapshot);
        elementMap.set(uid, uid);

      } catch (error) {
        console.warn(`Error processing element ${i}:`, error);
      }
    }

    const pagePath = await page.path;
    const snapshot: PageSnapshot = {
      path: pagePath,
      elements
    };

    return { snapshot, elementMap };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`获取页面快照失败: ${errorMessage}`);
  }
}

/**
 * 点击元素选项接口
 */
export interface ClickOptions {
  uid: string;
  dblClick?: boolean;
}

/**
 * 点击页面元素
 *
 * @param page 页面对象
 * @param elementMap 元素映射
 * @param options 点击选项
 */
export async function clickElement(
  page: any,
  elementMap: Map<string, string>,
  options: ClickOptions
): Promise<void> {
  const { uid, dblClick = false } = options;

  if (!uid) {
    throw new Error("元素uid是必需的");
  }

  if (!page) {
    throw new Error("页面对象是必需的");
  }

  try {
    // 通过uid查找元素
    const selector = elementMap.get(uid);
    if (!selector) {
      throw new Error(`找不到uid为 ${uid} 的元素，请先获取页面快照`);
    }

    // 获取元素并点击
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`无法找到选择器为 ${selector} 的元素`);
    }

    // 执行点击操作
    await element.tap();

    // 如果是双击，再点击一次
    if (dblClick) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟
      await element.tap();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`点击元素失败: ${errorMessage}`);
  }
}

/**
 * 截图选项接口
 */
export interface ScreenshotOptions {
  path?: string;
}

/**
 * 页面截图
 *
 * @param miniProgram MiniProgram 对象
 * @param options 截图选项
 * @returns 如果没有指定路径，返回base64数据；否则返回undefined
 */
export async function takeScreenshot(
  miniProgram: any,
  options: ScreenshotOptions = {}
): Promise<string | undefined> {
  if (!miniProgram) {
    throw new Error("MiniProgram对象是必需的");
  }

  try {
    const { path } = options;

    // 确保页面完全加载和稳定
    try {
      console.log('获取当前页面并等待稳定...')
      const currentPage = await miniProgram.currentPage();
      if (currentPage && typeof currentPage.waitFor === 'function') {
        // 等待页面稳定，增加等待时间
        await currentPage.waitFor(1000);
        console.log('页面等待完成')
      }
    } catch (waitError) {
      console.warn('页面等待失败，继续尝试截图:', waitError)
    }

    // 重试机制执行截图
    let result: string | undefined
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`截图尝试 ${attempt}/3`)
        if (path) {
          // 保存到指定路径
          await miniProgram.screenshot({ path });
          result = undefined
          console.log(`截图保存成功: ${path}`)
          break
        } else {
          // 返回base64数据
          const base64Data = await miniProgram.screenshot();
          console.log('截图API调用完成，检查返回数据...')
          if (base64Data && typeof base64Data === 'string' && base64Data.length > 0) {
            result = base64Data
            console.log(`截图成功，数据长度: ${base64Data.length}`)
            break
          } else {
            throw new Error(`截图返回无效数据: ${typeof base64Data}, 长度: ${base64Data ? base64Data.length : 'null'}`)
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`截图尝试 ${attempt} 失败:`, lastError.message)

        if (attempt < 3) {
          // 重试前等待更长时间，让页面稳定
          console.log(`等待 ${1000 + attempt * 500}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, 1000 + attempt * 500))
        }
      }
    }

    if (!result && !path) {
      throw new Error(`截图失败，已重试3次。最后错误: ${lastError?.message || '未知错误'}`)
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`截图失败: ${errorMessage}`);
  }
}

/**
 * 查询结果接口
 */
export interface QueryResult {
  uid: string;
  tagName: string;
  text?: string;
  attributes?: Record<string, string>;
  position?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 * 查询元素选项接口
 */
export interface QueryOptions {
  selector: string;
}

/**
 * 通过选择器查询页面元素
 *
 * @param page 页面对象
 * @param elementMap 元素映射
 * @param options 查询选项
 * @returns 匹配元素的信息数组
 */
export async function queryElements(
  page: any,
  elementMap: Map<string, string>,
  options: QueryOptions
): Promise<QueryResult[]> {
  const { selector } = options;

  if (!selector) {
    throw new Error("选择器是必需的");
  }

  if (!page) {
    throw new Error("页面对象是必需的");
  }

  try {
    // 通过选择器查找元素
    const elements = await page.$$(selector);
    const results: QueryResult[] = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      try {
        const uid = await generateElementUid(element, i);

        const result: QueryResult = {
          uid,
          tagName: element.tagName || 'unknown',
        };

        // 获取元素文本
        try {
          const text = await element.text();
          if (text && text.trim()) {
            result.text = text.trim();
          }
        } catch (error) {
          // 忽略无法获取文本的元素
        }

        // 获取元素位置信息
        try {
          const [size, offset] = await Promise.all([
            element.size(),
            element.offset()
          ]);

          result.position = {
            left: offset.left,
            top: offset.top,
            width: size.width,
            height: size.height
          };
        } catch (error) {
          // 忽略无法获取位置的元素
        }

        // 获取常用属性
        try {
          const attributes: Record<string, string> = {};
          const commonAttrs = ['class', 'id', 'data-testid'];
          for (const attr of commonAttrs) {
            try {
              const value = await element.attribute(attr);
              if (value) {
                attributes[attr] = value;
              }
            } catch (error) {
              // 忽略不存在的属性
            }
          }

          if (Object.keys(attributes).length > 0) {
            result.attributes = attributes;
          }
        } catch (error) {
          // 忽略属性获取错误
        }

        results.push(result);

        // 更新元素映射，使用实际的CSS选择器
        const actualSelector = `${selector}:nth-child(${i + 1})`;
        elementMap.set(uid, actualSelector);

      } catch (error) {
        console.warn(`Error processing element ${i}:`, error);
      }
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`查询元素失败: ${errorMessage}`);
  }
}

/**
 * 等待条件接口
 */
export interface WaitForOptions {
  selector?: string;     // 等待元素选择器
  timeout?: number;      // 超时时间(ms)，默认5000ms
  text?: string;         // 等待文本匹配
  visible?: boolean;     // 等待元素可见状态
  disappear?: boolean;   // 等待元素消失
}

/**
 * 等待条件满足
 *
 * @param page 页面对象
 * @param options 等待选项
 * @returns 等待结果
 */
export async function waitForCondition(
  page: any,
  options: WaitForOptions | number | string
): Promise<boolean> {
  if (!page) {
    throw new Error("页面对象是必需的");
  }

  try {
    // 处理简单的数字超时
    if (typeof options === 'number') {
      await page.waitFor(options);
      return true;
    }

    // 处理简单的选择器字符串
    if (typeof options === 'string') {
      const startTime = Date.now();
      const timeout = 5000; // 默认5秒超时

      while (Date.now() - startTime < timeout) {
        try {
          const element = await page.$(options);
          if (element) {
            return true;
          }
        } catch (error) {
          // 继续等待
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`等待元素 ${options} 超时`);
    }

    // 处理复杂的等待条件对象
    const {
      selector,
      timeout = 5000,
      text,
      visible,
      disappear = false
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        if (selector) {
          const element = await page.$(selector);

          if (disappear) {
            // 等待元素消失
            if (!element) {
              return true;
            }
          } else {
            // 等待元素出现
            if (element) {
              // 检查文本匹配
              if (text) {
                try {
                  const elementText = await element.text();
                  if (!elementText || !elementText.includes(text)) {
                    throw new Error('文本不匹配');
                  }
                } catch (error) {
                  throw new Error('文本不匹配');
                }
              }

              // 检查可见性
              if (visible !== undefined) {
                try {
                  const size = await element.size();
                  const isVisible = size.width > 0 && size.height > 0;
                  if (isVisible !== visible) {
                    throw new Error('可见性不匹配');
                  }
                } catch (error) {
                  throw new Error('可见性不匹配');
                }
              }

              return true;
            }
          }
        } else if (typeof timeout === 'number') {
          // 简单的时间等待
          await page.waitFor(timeout);
          return true;
        }
      } catch (error) {
        // 继续等待，直到超时
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 构建错误信息
    let errorMsg = '等待条件超时: ';
    if (selector) {
      errorMsg += `选择器 ${selector}`;
      if (disappear) errorMsg += ' 消失';
      if (text) errorMsg += ` 包含文本 "${text}"`;
      if (visible !== undefined) errorMsg += ` ${visible ? '可见' : '隐藏'}`;
    }
    throw new Error(errorMsg);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`等待条件失败: ${errorMessage}`);
  }
}
