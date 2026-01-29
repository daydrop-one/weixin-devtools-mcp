/**
 * Tool Module Exports
 * Unified export of all tool definitions
 */

import { ToolDefinition } from './ToolDefinition.js';

// Import tools from each module
import { connectDevtoolsTool, connectDevtoolsEnhancedTool, getCurrentPageTool } from './connection.js';
import { getPageSnapshotTool } from './snapshot.js';
import {
  clickTool,
  inputTextTool,
  getValueTool,
  setFormControlTool,
  selectPickerTool,
  toggleSwitchTool,
  setSliderTool
} from './input.js';
import { screenshotTool } from './screenshot.js';
import { querySelectorTool, waitForTool, findElementsTool } from './page.js';
import {
  assertExistsTool,
  assertVisibleTool,
  assertTextTool,
  assertAttributeTool,
  assertStateTool
} from './assert.js';
import {
  navigateToTool,
  navigateBackTool,
  switchTabTool,
  reLaunchTool,
  getPageInfoTool,
  redirectToTool
} from './navigate.js';
import {
  startConsoleMonitoringTool,
  stopConsoleMonitoringTool,
  listConsoleMessagesTool,
  getConsoleMessageTool,
  getConsoleTool,
  clearConsoleTool
} from './console.js';
import {
  startNetworkMonitoringTool,
  stopNetworkMonitoringTool,
  getNetworkRequestsTool,
  clearNetworkRequestsTool,
  diagnoseInterceptorTool
} from './network.js';
import {
  diagnoseConnectionTool,
  checkEnvironmentTool,
  debugPageElementsTool
} from './diagnose.js';
import { evaluateScript } from './script.js';

/**
 * List of all available tools
 */
export const allTools: ToolDefinition[] = [
  // Connection management tools
  connectDevtoolsTool,              // Traditional connection (compatibility)
  connectDevtoolsEnhancedTool,      // Smart connection (recommended)
  getCurrentPageTool,

  // Page snapshot tools
  getPageSnapshotTool,

  // Page query and wait tools
  querySelectorTool,
  findElementsTool,  // Alias for $ selector tool
  waitForTool,

  // Input interaction tools
  clickTool,
  inputTextTool,
  getValueTool,
  setFormControlTool,
  selectPickerTool,
  toggleSwitchTool,
  setSliderTool,

  // Assertion validation tools
  assertExistsTool,
  assertVisibleTool,
  assertTextTool,
  assertAttributeTool,
  assertStateTool,

  // Page navigation tools
  navigateToTool,
  navigateBackTool,
  switchTabTool,
  reLaunchTool,
  getPageInfoTool,
  redirectToTool,

  // Debug tools
  screenshotTool,
  evaluateScript,
  startConsoleMonitoringTool,
  stopConsoleMonitoringTool,
  listConsoleMessagesTool,
  getConsoleMessageTool,
  getConsoleTool,
  clearConsoleTool,

  // Network monitoring tools
  startNetworkMonitoringTool,
  stopNetworkMonitoringTool,
  getNetworkRequestsTool,
  clearNetworkRequestsTool,
  diagnoseInterceptorTool,

  // Diagnostic tools
  diagnoseConnectionTool,
  checkEnvironmentTool,
  debugPageElementsTool,
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find(tool => tool.name === name);
}

/**
 * Get all tool names
 */
export function getAllToolNames(): string[] {
  return allTools.map(tool => tool.name);
}

// Re-export tool definition related types and functions
export * from './ToolDefinition.js';
