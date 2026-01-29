# WeChat DevTools Automation MCP Server

> Powerful WeChat Mini Program automation testing solution based on Model Context Protocol

[![Version](https://img.shields.io/badge/version-0.3.3-blue.svg)](https://github.com/yourusername/weixin-devtools-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## ✨ Key Features

- 🚀 **40 Professional Tools** - Comprehensive testing coverage for connection, query, interaction, assertion, navigation, debugging, and more
- 🤖 **Smart Connection** - Supports auto/launch/connect modes with automatic port detection, no manual configuration needed
- 🔍 **Automatic Network Monitoring** - Auto-starts on connection, real-time interception of wx.request/uploadFile/downloadFile
- ✅ **Complete Assertion System** - 5 types of assertion tools to verify element existence, visibility, text, attributes, and state
- 📸 **Rich Debugging Capabilities** - Page screenshots, Console monitoring, network request tracking, diagnostic tools
- 🏗️ **Modular Architecture** - Based on chrome-devtools-mcp architecture pattern, easy to extend and maintain
- 🧪 **Comprehensive Test Coverage** - Unit tests + integration tests, >80% test coverage

## 📦 Installation

### Method 1: Use npx (Recommended)

**No installation required, use directly** - npx will automatically download and run the latest version:

```bash
# No installation command needed
# Just use it directly in Claude Desktop configuration
```

### Method 2: Global Installation

If you need frequent or offline use, install globally:

```bash
npm install -g weixin-devtools-mcp
```

### Method 3: Developer Installation (From Source)

If you need to modify source code or contribute to development:

```bash
# Clone the project
git clone https://github.com/yourusername/weixin-devtools-mcp.git
cd weixin-devtools-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## ⚙️ Configuration

Add the MCP server to Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Configuration Method 1: Use npx (Recommended)

**Advantage**: No installation needed, automatically uses latest version

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

### Configuration Method 2: After Global Installation

If already globally installed, use the command name directly:

```json
{
  "mcpServers": {
    "weixin-devtools-mcp": {
      "command": "weixin-devtools-mcp"
    }
  }
}
```

### Configuration Method 3: Developer Local Path

If installed from source, use absolute path:

```json
{
  "mcpServers": {
    "weixin-devtools-mcp": {
      "command": "/path/to/weixin-devtools-mcp/build/server.js"
    }
  }
}
```

## 🚀 Quick Start

### Your First Automation Test

```typescript
// 1. Smart connection to WeChat DevTools (auto port detection)
connect_devtools_enhanced({
  projectPath: "/path/to/your/miniprogram",
  mode: "auto",
  verbose: true
})

// 2. Find login button
$({ selector: "button.login-btn" })

// 3. Click login button
click({ uid: "button.login-btn" })

// 4. Wait for successful login
waitFor({ selector: ".welcome-message", timeout: 5000 })

// 5. Verify login success
assert_text({ uid: ".welcome-message", text: "Welcome back" })

// 6. Take page screenshot
screenshot({ path: "/tmp/login-success.png" })
```

## 🛠️ Features Overview

The project provides **40 tools** organized into 8 major categories:

| Category | Tool Count | Main Functions |
|------|--------|----------|
| **Connection Management** | 3 tools | Smart connection, traditional connection, get current page |
| **Page Query** | 3 tools | CSS selector search, conditional wait, page snapshot |
| **Interaction Operations** | 7 tools | Click, input, get value, form controls, picker, switch, slider |
| **Assertion Validation** | 5 tools | Existence, visibility, text, attribute, state assertions |
| **Page Navigation** | 6 tools | Navigate, back, tab switch, relaunch, redirect, page info |
| **Console Monitoring** | 6 tools | Monitor control, two-phase query (list/get details), log retrieval, clear |
| **Network Monitoring** | 5 tools | Request interception, monitor control, request retrieval, clear records, interceptor diagnostics |
| **Diagnostic Tools** | 5 tools | Connection diagnosis, environment check, element debugging, interceptor diagnostics |

### Detailed Tool List

<details>
<summary><b>Connection Management (3 tools)</b></summary>

- `connect_devtools` - Traditional connection method (compatibility)
- `connect_devtools_enhanced` - Smart connection, supports three modes, auto port detection (recommended)
- `get_current_page` - Get current active page information

</details>

<details>
<summary><b>Page Query and Snapshot (3 tools)</b></summary>

- `$` - Find elements by CSS selector, return detailed information
- `waitFor` - Wait for conditions to be met (time/element appear/disappear/text match)
- `get_page_snapshot` - Get complete page snapshot and all element UIDs

</details>

<details>
<summary><b>Interaction Operations (7 tools)</b></summary>

- `click` - Click element (supports single/double click)
- `input_text` - Input text into input/textarea
- `get_value` - Get element's value or text content
- `set_form_control` - Set form control value
- `select_picker` - Select picker control option
- `toggle_switch` - Toggle switch state
- `set_slider` - Set slider value

</details>

<details>
<summary><b>Assertion Validation (5 tools)</b></summary>

- `assert_exists` - Assert element exists or does not exist
- `assert_visible` - Assert element is visible or not visible
- `assert_text` - Assert element text content (exact/contains/regex)
- `assert_attribute` - Assert element attribute value
- `assert_state` - Assert element state (checked/enabled/focused/visible)

</details>

<details>
<summary><b>Page Navigation (6 tools)</b></summary>

- `navigate_to` - Navigate to specified page
- `navigate_back` - Go back to previous page
- `switch_tab` - Switch to specified tab page
- `relaunch` - Restart mini program and navigate to specified page
- `redirect_to` - Close current page and navigate
- `get_page_info` - Get current page detailed information

</details>

<details>
<summary><b>Console Monitoring (6 tools)</b></summary>

- `start_console_monitoring` - Start monitoring console and exceptions
- `stop_console_monitoring` - Stop console monitoring
- `list_console_messages` - List console messages (short format, token optimized)
- `get_console_message` - Get message details by msgid (full format)
- `get_console` - Get collected console messages (traditional method)
- `clear_console` - Clear console cache

</details>

<details>
<summary><b>Debug Tools (1 tool)</b></summary>

- `screenshot` - Page screenshot (return base64 or save file)

</details>

<details>
<summary><b>Network Monitoring (5 tools)</b></summary>

- `start_network_monitoring` - Start monitoring network requests
- `stop_network_monitoring` - Stop network monitoring
- `get_network_requests` - Get intercepted network requests (supports filtering)
- `clear_network_requests` - Clear network request records
- `diagnose_interceptor` - Diagnose network interceptor status

</details>

<details>
<summary><b>Diagnostic Tools (3 tools)</b></summary>

- `diagnose_connection` - Diagnose connection issues, check configuration and environment
- `check_environment` - Check automation environment configuration
- `debug_page_elements` - Debug page element retrieval issues

</details>

## 💡 Usage Examples

### Example 1: User Login Flow

```typescript
// Connect to developer tools
connect_devtools_enhanced({
  projectPath: "/path/to/miniprogram",
  mode: "auto"
})

// Input username
$({ selector: "input#username" })
input_text({ uid: "input#username", text: "testuser" })

// Input password
$({ selector: "input#password" })
input_text({ uid: "input#password", text: "password123" })

// Click login button
$({ selector: "button.login" })
click({ uid: "button.login" })

// Wait for successful login
waitFor({ selector: ".welcome", timeout: 5000 })

// Verify welcome message
assert_text({ uid: ".welcome", textContains: "Welcome" })

// Check network requests
get_network_requests({ urlPattern: "/api/login", successOnly: true })
```

### Example 2: Form Filling and Submission

```typescript
// Fill text input fields
input_text({ uid: "input#name", text: "John Doe" })
input_text({ uid: "input#email", text: "john@example.com" })

// Select dropdown
select_picker({ uid: "picker#city", value: "New York" })

// Toggle switch
toggle_switch({ uid: "switch#agree", checked: true })

// Set slider
set_slider({ uid: "slider#age", value: 25 })

// Submit form
click({ uid: "button.submit" })

// Wait for successful submission
waitFor({ selector: ".success-toast", timeout: 3000 })

// Verify submission result
assert_visible({ uid: ".success-toast", visible: true })
assert_text({ uid: ".success-toast", text: "Submitted successfully" })

// Screenshot to save result
screenshot({ path: "/tmp/form-submit-success.png" })
```

## 📚 Documentation

- [📖 Complete Integration Guide](docs/integration-guide.md) - Detailed installation and configuration steps
- [🔧 Page Tools API](docs/page-tools.md) - Detailed documentation for page query and wait tools
- [✨ Best Practices](docs/best-practices.md) - Recommendations for writing high-quality automation tests
- [🧪 Testing Guide](docs/testing-guide.md) - Unit testing and integration testing instructions
- [🏗️ Modular Architecture](docs/modular-architecture.md) - Project architecture design documentation
- [📝 Usage Examples](docs/examples/) - More real-world usage scenario examples

## 🔧 Development Guide

### Build and Test

The project uses a layered testing architecture with protocol tests, tool tests, and integration tests:

```bash
# Development mode (watch for file changes)
npm run watch

# Run unit tests (224 tests: protocol + tools + utilities)
npm test

# Run unit tests by category
npm run test:protocol      # Protocol layer tests (19 tests)
npm run test:tools         # Tool logic tests (196 tests)

# Run integration tests (requires WeChat DevTools, 46 tests)
npm run test:integration

# Run all tests (unit + integration)
npm run test:all

# Generate test coverage report
npm run test:coverage

# Debug with MCP Inspector
npm run inspector
```

### Adding New Tools

1. Create or modify tool module in `src/tools/`
2. Define tool using `ToolDefinition` framework
3. Export tool in `src/tools/index.ts`
4. Write unit tests (`tests/tools/*.test.ts` or `tests/protocol/*.test.ts`)
5. Write integration tests (`tests/integration/*.integration.test.ts`)
6. Update documentation

For detailed development guide, see [CLAUDE.md](CLAUDE.md)

### Testing Architecture

The project uses a three-layer testing architecture (inspired by chrome-devtools-mcp):

- **Protocol Layer Tests** (`tests/protocol/`) - Test MCP server protocol implementation
- **Tool Logic Tests** (`tests/tools/`) - Test tool handlers directly, no server required
- **Integration Tests** (`tests/integration/`) - End-to-end tests, requires real environment

## 📋 System Requirements

- **Node.js** >= 16.0.0
- **WeChat DevTools** Installed with automation features enabled
- **Operating System** macOS / Windows
- **Claude Desktop** For running MCP server

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome!

1. Fork this project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) - MCP SDK
- [miniprogram-automator](https://www.npmjs.com/package/miniprogram-automator) - WeChat Mini Program automation SDK
- [chrome-devtools-mcp](https://github.com/tinybirdco/chrome-devtools-mcp) - Architecture reference

## 📞 Contact

- Issue Reports: [GitHub Issues](https://github.com/yourusername/weixin-devtools-mcp/issues)
- Documentation: [Project Docs](docs/)

---

⭐ If this project helps you, please give it a Star!
