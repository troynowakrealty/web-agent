# AIRAS Agent

<img width="1894" alt="Flight booking interface displaying departure city_ destination_ dates_ regional settings_ and search options for Skyscanner__2025-02-22" src="https://github.com/user-attachments/assets/0d3d8d12-97ba-4625-9d02-2897319e765e" />

> **Note**: This project is for research and non-commercial use only.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A web automation system that uses AI with vision capabilities and Playwright to achieve user-defined goals through autonomous web navigation. Supports both OpenAI and Ollama as AI providers.

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/GPT-Protocol/airas-agent.git
   cd airas-agent
   npm install
   ```

2. **Configure**
   Create a `.env` file in the root directory:
   ```bash
   # Choose your AI provider
   AI_PROVIDER=openai  # or 'ollama'

   # If using OpenAI
   OPENAI_API_KEY=your-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_VISION_MODEL=gpt-4-vision-preview

   # If using Ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.1
   OLLAMA_VISION_MODEL=llava
   ```

3. **Run**
   ```bash
   npm run dev
   ```

4. **Use**
   - Open http://localhost:3000 in your browser
   - Enter a goal in the mission parameters (e.g., "Find me a good NFT from Rarible")
   - Click "INITIALIZE MISSION"

## Features

- **Multiple AI Providers**: 
  - OpenAI (GPT-4V)
  - Ollama (Local models with vision capabilities)
- **Vision-Enhanced Navigation**: Uses AI vision to analyze and interact with web pages
- **Autonomous Decision Making**: Makes intelligent decisions based on visual and textual context
- **Real-Time Feedback**: Shows current status, steps, and visual feedback
- **Multi-Tab Support**: Handles new tab navigation and dynamic content
- **Smart Element Detection**: Improved DOM selection and interaction

## Architecture

### Core Components

1. **Frontend (`app/components/Agent.tsx`)**
   - Main interface for user interaction
   - Displays current status, steps taken, and execution timeline
   - Shows visual feedback of current webpage state
   - Displays active AI provider and model information
   - Uses the `useAgent` hook for state management and API interactions

2. **Browser Service (`app/lib/browser/playwright-service.ts`)**
   - Manages browser automation using Playwright
   - Handles multi-tab navigation and synchronization
   - Provides high-level browser control methods
   - Manages page lifecycle and cleanup
   - Features:
     - Automatic new tab detection and switching
     - Improved element interaction stability
     - Better handling of dynamic content
     - Robust error recovery

3. **DOM Service (`app/lib/browser/dom-service.ts`)**
   - Smart element detection and interaction
   - Maintains element state across page changes
   - Features:
     - Dynamic element highlighting
     - Automatic tab synchronization
     - Improved element visibility detection
     - Better handling of overlays and modals

4. **Action Executor (`app/lib/actions/executor.ts`)**
   - Executes navigation actions
   - Coordinates between browser and DOM services
   - Handles action validation and error recovery
   - Features:
     - Improved action validation
     - Better error handling
     - State preservation across actions

5. **AI Providers**
   - Modular provider system supporting multiple AI backends
   - Each provider implements a common interface:
     ```typescript
     interface AIProvider {
       chat(messages: ChatMessage[]): Promise<string>;
       chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string>;
     }
     ```
   - Supported providers:
     - **OpenAI Provider**: Uses GPT-4V for vision tasks
     - **Ollama Provider**: Uses local models with vision capabilities

### Navigation Flow

1. **Initialization**
   ```typescript
   // Initialize browser
   await playwrightService.initialize();
   
   // Create browser context for tab management
   const context = await browser.newContext();
   
   // Set up new tab handling
   context.on('page', async (page) => {
     // Handle new tab
     await page.waitForLoadState();
     // Update current page
   });
   ```

2. **Element Interaction**
   ```typescript
   // Smart element detection
   const element = await page.waitForSelector(selector, {
     state: 'visible',
     timeout: 10000
   });
   
   // Stable clicking with retry
   try {
     await element.click({ timeout: 10000, force: false });
   } catch {
     // Fall back to JavaScript click
     await page.evaluate((sel) => {
       document.querySelector(sel)?.click();
     }, selector);
   }
   ```

3. **State Management**
   ```typescript
   // Get current page state
   const state = await domService.getPageState();
   
   // Format elements for AI
   const elements = await domService.getFormattedElements();
   
   // Take screenshot
   const screenshot = await page.screenshot();
   ```

### Error Handling

1. **Browser Level**
   - Automatic recovery from crashes
   - Tab synchronization maintenance
   - Resource cleanup
   - Session state preservation

2. **DOM Level**
   - Element validation before interaction
   - Visibility and interactivity checks
   - Dynamic content handling
   - Modal and overlay detection

3. **Action Level**
   - Pre-action validation
   - Post-action verification
   - Error recovery strategies
   - State rollback capabilities

## Configuration

### Browser Configuration
```bash
# Browser viewport settings
BROWSER_WIDTH=1280
BROWSER_HEIGHT=800

# Navigation timeouts (in milliseconds)
NAVIGATION_TIMEOUT=30000
NETWORK_IDLE_TIMEOUT=10000

# Element interaction settings
CLICK_TIMEOUT=10000
ELEMENT_WAIT_TIMEOUT=10000
```

### Development Features
```bash
# Enable detailed logging
ENABLE_LOGGING=true

# Save screenshots to disk
ENABLE_SCREENSHOTS=true

# Directory paths
SCREENSHOT_DIR=screenshots
LOG_DIR=logs
```

## Contributing

This project welcomes contributions! Some areas for improvement:

1. **Enhanced Navigation**
   - Better dynamic content handling
   - Improved modal interaction
   - Smarter tab management
   - Form handling improvements

2. **AI Integration**
   - Better context preservation
   - Improved decision making
   - Enhanced visual understanding
   - More efficient prompting

3. **Error Handling**
   - Better recovery strategies
   - Improved state preservation
   - More robust cleanup
   - Better error reporting

4. **Performance**
   - Faster element detection
   - Better resource management
   - Reduced memory usage
   - Improved screenshot handling

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE.txt](LICENSE.txt) file for details.

This means you are free to:
- Use the software for any purpose
- Change the software to suit your needs
- Share the software with your friends and neighbors
- Share the changes you make

Under the following terms:
- If you distribute the software, you must also distribute:
  - The complete source code or make it freely available
  - The same license terms to recipients
  - Any modifications under the same license
- Include copyright and license notices
- State significant changes made to the software
- Disclose source code of your version

The GPL-3.0 license ensures that all versions of the software remain free and open source.

## Development Mode

When developing or debugging, you can enable additional features:

1. Set `ENABLE_LOGGING=true` to:
   - Write detailed logs to the `logs` directory
   - Each session gets its own log file with timestamp
   - Includes step execution details, navigation status, and errors

2. Set `ENABLE_SCREENSHOTS=true` to:
   - Save screenshots to disk in the `screenshots` directory
   - Each screenshot is saved with a timestamp
   - Useful for debugging navigation issues

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Enter a goal in the interface (e.g., "Find me a good NFT from Rarible")

3. The system will:
   - Break down the goal into steps
   - Take screenshots of each state
   - Use AI vision to analyze the page
   - Execute each step autonomously
   - Display progress in real-time
   - Handle errors gracefully
   - Complete when the goal is achieved

## Error Handling

1. **API Level**
   - Graceful cleanup of browser resources
   - Detailed error messages
   - Status code handling
   - Screenshot verification

2. **Frontend Level**
   - Visual error feedback
   - Retry capabilities
   - State recovery
   - Screenshot display

## Logging

Comprehensive logging at each step:
- Step execution details
- Element finding attempts
- Navigation status
- Network request completion
- Screenshot captures
- Error details

This system is designed to be extensible, with the ability to add new step types and element finding strategies as needed. The vision capabilities ensure more accurate navigation by making decisions based on what is actually visible on the page.

## Contributing

This project is currently in its early stages and we welcome contributions from the community! While the current implementation is barebones, with enough interest and contributions, we aim to expand its capabilities significantly.

### Areas for Improvement

1. **Enhanced Navigation Strategies**
   - Better handling of dynamic content
   - Support for more complex interaction patterns
   - Improved SPA navigation detection

2. **Vision Capabilities**
   - Better element recognition
   - Support for more complex visual patterns
   - Improved decision making based on visual context

3. **Error Handling**
   - More robust recovery strategies
   - Better handling of timeouts and failures
   - Improved logging and debugging capabilities

4. **Performance Optimization**
   - Reduce memory usage
   - Improve screenshot handling
   - Better resource cleanup

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/GPT-Protocol/airas-agent.git
   cd airas-agent
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```
   If you encounter peer dependency issues during installation, you can use the legacy peer deps flag:
   ```bash
   npm install --legacy-peer-deps
   ```
   This may be necessary due to some packages having strict peer dependency requirements.

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**
   - Write clean, commented code
   - Follow existing code style
   - Add tests if possible
   - Update documentation as needed

5. **Test Your Changes**
   ```bash
   npm run dev
   ```

6. **Submit a Pull Request**
   - Provide a clear description of your changes
   - Link any related issues
   - Include screenshots if relevant

### Development Guidelines

1. **Code Style**
   - Use TypeScript
   - Follow existing patterns
   - Add appropriate comments
   - Use meaningful variable names

2. **Testing**
   - Test with different websites
   - Verify error handling
   - Check edge cases
   - Document any limitations

3. **Documentation**
   - Update README if needed
   - Document new features
   - Add inline comments
   - Update configuration examples

### Project Status

This is an experimental project in its early stages. The current implementation provides basic autonomous web navigation capabilities, but there's significant room for improvement. We're releasing it in this state to:

1. Gather community feedback
2. Identify key areas for improvement
3. Allow early adopters to experiment and contribute
4. Build a foundation for more advanced features

If you're interested in contributing or have ideas for improvements, please:
- Open an issue to discuss your ideas
- Submit pull requests with improvements
- Share your use cases and feedback
- Join the discussion in GitHub issues

### Future Plans

With sufficient community interest, we plan to add:
- More sophisticated navigation strategies
- Better visual understanding capabilities
- Additional browser automation features
- Improved error recovery
- Better performance and reliability
- Extended documentation and examples

Your contributions and feedback are welcome and appreciated!
