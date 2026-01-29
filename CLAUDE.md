# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat DevTools Automation MCP Server, providing 40 tools for WeChat Mini Program automation testing. Built with TypeScript and `miniprogram-automator` SDK.

## Common Commands

### Development and Build
```bash
# Build project (TypeScript → JavaScript + set executable permissions)
npm run build

# Development mode (watch file changes and auto-rebuild)
npm run watch

# Debug with MCP Inspector
npm run inspector
```

### Testing

The project uses a layered testing architecture, following the chrome-devtools-mcp pattern:

```
tests/
├── protocol/          # Protocol layer tests (requires MCP server)
│   ├── server.test.ts
│   └── index.test.ts
├── tools/            # Tool logic tests (direct handler calls, no server needed)
│   ├── connection.test.ts
│   ├── console.test.ts
│   ├── navigate.test.ts
│   ├── network.test.ts
│   ├── page.test.ts
│   └── screenshot.test.ts
├── integration/      # Integration tests (requires real environment)
│   ├── connect-devtools.integration.test.ts
│   ├── console.integration.test.ts
│   ├── enhanced-connection.integration.test.ts
│   ├── navigation.integration.test.ts
│   ├── network.integration.test.ts
│   └── network-auto-start.integration.test.ts
└── utils/            # Test utilities
    └── test-utils.ts
```

**Test Commands**:

```bash
# Unit tests (protocol + tools + utilities, 224 tests)
npm test

# Run unit tests by category
npm run test:protocol      # Protocol layer tests (19 tests)
npm run test:tools         # Tool logic tests (196 tests)

# Integration tests (requires WeChat DevTools + playground/wx/)
npm run test:integration   # 46 integration tests

# All tests (unit + integration)
npm run test:all

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch                # Unit tests watch
npm run test:integration:watch    # Integration tests watch
```

**Integration Test Requirements**:
- WeChat DevTools installed with automation features enabled
- Test project located at `playground/wx/`
- Controlled by `RUN_INTEGRATION_TESTS=true` environment variable
- Integration tests automatically skipped when variable not set

### Running Individual Tests

```bash
# Protocol tests
npx vitest tests/protocol/server.test.ts

# Tool tests
npx vitest tests/tools/console.test.ts

# Integration tests
RUN_INTEGRATION_TESTS=true npx vitest tests/integration/console.integration.test.ts

# Specify test case
npm test -- tests/tools/console.test.ts -t "test case name"
```

## Architecture

### Dual Entry Point Design

The project maintains two independent MCP server entry points:

**1. `build/index.js` (Legacy Server)**
- Source file: `src/index.ts`
- Features: Contains inline implementation of all tools + modular tool adapter layer
- Code size: ~650 lines
- Purpose: Backward compatibility, supports gradual migration
- Tool handling: Some tools directly implemented (connect_devtools, get_current_page, get_page_snapshot, click, screenshot), others call modular implementation via adapter

**2. `build/server.js` (Modern Server - Recommended)**
- Source file: `src/server.ts`
- Features: Fully relies on modular tool system, clean code
- Code size: ~245 lines
- Purpose: All new projects and configurations
- Tool handling: All 40 tools uniformly handled via `allTools` array and `ToolDefinition` framework

**Selection Guide**:
- `npm install -g weixin-devtools-mcp` defaults to `server.js` (package.json bin configuration)
- New users and projects: Use `build/server.js`
- Backward compatibility needed: Use `build/index.js`

### Modular Tool System

Core design pattern inspired by chrome-devtools-mcp:

```
src/tools/
├── ToolDefinition.ts    # Core framework
│   ├── defineTool()     # Tool definition helper function
│   ├── ToolContext      # Shared state interface (5 fields)
│   ├── ToolHandler      # Tool handler type
│   └── ToolResponse     # Response builder interface
│
├── index.ts             # Unified export allTools[] (40 tools)
│
└── [8 feature modules]
    ├── connection.ts    # Connection management (3 tools)
    ├── page.ts          # Page query (2 tools: $, waitFor)
    ├── snapshot.ts      # Page snapshot (1 tool)
    ├── input.ts         # Interaction operations (7 tools)
    ├── assert.ts        # Assertion validation (5 tools)
    ├── navigate.ts      # Page navigation (6 tools)
    ├── console.ts       # Console monitoring (6 tools: includes two-phase query)
    ├── network.ts       # Network monitoring (5 tools)
    ├── screenshot.ts    # Screenshot tool (1 tool)
    └── diagnose.ts      # Diagnostic tools (5 tools)
```

**Tool Definition Pattern**:
```typescript
// Each tool follows the same definition pattern
export const exampleTool = defineTool({
  name: "tool_name",
  description: "Tool description",
  schema: z.object({ /* Zod schema */ }),
  handler: async (request, response, context) => {
    // 1. Get shared state from context
    // 2. Execute business logic
    // 3. Return results via response.appendResponseLine()
    // 4. Update context state (automatically synced to global)
  }
});
```

### State Management (ToolContext)

All tools share 5 key states through `ToolContext`:

1. **`miniProgram`**: MiniProgram instance (from miniprogram-automator)
2. **`currentPage`**: Current active page instance
3. **`elementMap`**: Map<uid, ElementMapInfo> - Element UID to selector mapping
4. **`consoleStorage`**: Console messages and exception storage (monitoring state + message array)
5. **`networkStorage`**: Network request interception data (monitoring state + request array + original methods)

**Key Design**:
- Tools pass state via context, no global variable pollution
- `elementMap` supports UID reference mechanism (`get_page_snapshot` generates UIDs, `click` and other tools use UIDs to operate elements)
- Network monitoring auto-starts on `connect_devtools_enhanced` connection

### UID Reference Mechanism

Supports cross-tool element references:

```typescript
// 1. Get page snapshot (generates UIDs for all elements)
get_page_snapshot()
// Output: { uid: "button.submit", tagName: "button", ... }

// 2. Use UID to operate elements
click({ uid: "button.submit" })
input_text({ uid: "input#username", text: "user" })
assert_text({ uid: ".message", text: "Success" })
```

UID generation rules: Prioritize id > class > nth-child to build stable CSS selector paths.

## Technical Details

### Key Dependencies
- `@modelcontextprotocol/sdk` (v0.6.0) - MCP protocol implementation
- `miniprogram-automator` (^0.12.1) - WeChat Mini Program automation SDK
- `zod` + `zod-to-json-schema` - Parameter validation and schema conversion
- `vitest` - Testing framework

### TypeScript Configuration
- Target: ES2022, Module: Node16 (ESM)
- `"type": "module"` in package.json
- Strict mode enabled
- Output directory: `./build`

### Build Process
1. TypeScript compilation (`tsc`)
2. Auto-set executable permissions (`build/index.js` and `build/server.js`)
3. prepare hook ensures build before publish

### MCP Server Configuration

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "weixin-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "weixin-devtools-mcp"]
    }
  }
}
```

Or use local path (for developers):
```json
{
  "mcpServers": {
    "weixin-devtools-mcp": {
      "command": "/path/to/weixin-devtools-mcp/build/server.js"
    }
  }
}
```

## Development Notes

### Adding New Tools

1. Select or create appropriate feature module in `src/tools/`
2. Define tool using `defineTool()`, including:
   - name: Tool name (follow snake_case)
   - description: Clear functional description
   - schema: Zod schema defining parameters
   - handler: Implement business logic
3. Add export to `allTools` array in `src/tools/index.ts`
4. Write unit tests (`tests/*.test.ts`)
5. Write integration tests (`tests/*.integration.test.ts`)
6. Update documentation

### Testing Strategy

The project uses a three-layer testing architecture (inspired by chrome-devtools-mcp):

**1. Protocol Layer Tests** (`tests/protocol/`)
- Test complete MCP server protocol implementation
- Requires starting real MCP server process (StdioServerTransport)
- Validates tool list, schema, request-response flow
- **19 tests**, covering server.ts and index.ts

**2. Tool Logic Tests** (`tests/tools/`)
- Directly call tool handlers, no MCP server needed
- Use mock objects to simulate miniProgram, page, and other dependencies
- Fast execution, focused on tool business logic testing
- **196 tests**, covering core logic of all 40 tools

**3. Integration Tests** (`tests/integration/`)
- Test end-to-end flows in real environment
- Requires running WeChat DevTools and test project
- Controlled by `RUN_INTEGRATION_TESTS=true` environment variable
- **45 tests**, validating connection, navigation, network monitoring, and complete flows

**Test Coverage**:
- Target: >80% code coverage
- Current: 224 unit tests + 46 integration tests
- Run `npm run test:coverage` to view detailed report

### Important Implementation Details

1. **Auto-start Network Monitoring**: `connect_devtools_enhanced` automatically calls `start_network_monitoring` after successful connection
2. **Navigation API Fix** (v0.3.3): All navigation tools changed from `await page.navigateTo()` pattern to `await miniProgram.navigateTo(page, ...)`
3. **Error Handling**: All tools perform connection state checks and element existence validation
4. **Response Building**: Build multi-line responses via `response.appendResponseLine()`, supports `attachImage()` to add images

### Version Notes

**Code Version**: v0.3.3 (src/index.ts and src/server.ts)
**package.json Version**: v0.0.1 (release version)

This discrepancy is normal: Code version tracks feature iterations, package.json version updates on release.

## Prerequisites

- **Node.js** >= 16.0.0
- **WeChat DevTools**: Installed with following settings enabled
  - Settings → Security → Service Port: Enabled
  - Settings → Security → CLI/HTTP Call Function: Enabled
- **Test Project**: Integration tests require valid Mini Program project in `playground/wx/` directory

## Quick Reference

### Tool Categories Overview

| Category | Count | Core Tools |
|------|------|----------|
| Connection Management | 3 | connect_devtools_enhanced (recommended) |
| Page Query | 3 | $ (selector search), waitFor (conditional wait) |
| Interaction Operations | 7 | click, input_text, select_picker, toggle_switch |
| Assertion Validation | 5 | assert_exists, assert_visible, assert_text |
| Page Navigation | 6 | navigate_to, navigate_back, switch_tab, relaunch |
| Console Monitoring | 6 | start/stop_console_monitoring, list_console_messages, get_console_message |
| Network Monitoring | 5 | Auto-start, get_network_requests (filtered query) |
| Diagnostic Tools | 5 | diagnose_connection, check_environment, diagnose_interceptor |

### Typical Workflow

```typescript
// 1. Smart connection (auto port detection)
connect_devtools_enhanced({ projectPath: "/path/to/project", mode: "auto" })

// 2. Page query and wait
$({ selector: "button.login" })
waitFor({ selector: ".success", timeout: 5000 })

// 3. Interaction operations
click({ uid: "button.login" })
input_text({ uid: "input#username", text: "user" })

// 4. Assertion validation
assert_text({ uid: ".message", text: "Success" })
assert_visible({ uid: ".modal", visible: true })

// 5. Console monitoring (two-phase query optimization)
start_console_monitoring()  // Start listening to console messages

// Phase 1: List query (short format, saves tokens)
const messages = list_console_messages({
  types: ["error", "warn"],  // Filter types
  pageSize: 20               // Limit quantity
})
// Returns: [{ msgid: 1, type: "error", preview: "Error: ..." }, ...]

// Phase 2: Get details (only for messages of interest)
const detail = get_console_message({ msgid: 1 })
// Returns full info: { msgid, type, args: [...], timestamp, ... }

// 6. Network monitoring and screenshot
screenshot({ path: "/tmp/result.png" })
get_network_requests({ urlPattern: "/api/", successOnly: true })
```

## Documentation

Complete documentation in `docs/` directory:
- `integration-guide.md` - Detailed installation and configuration guide
- `page-tools.md` - $ and waitFor API documentation
- `best-practices.md` - Best practices for test scripts
- `testing-guide.md` - Testing strategy and coverage
- `examples/` - Examples for login, shopping, and other scenarios
