# 007 Agent

<img width="1425" alt="screenshot" src="https://github.com/user-attachments/assets/f78754d5-1bd1-489b-9720-9d5867abd6d4" />

> **Note**: This project is for research and non-commercial use only.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A web automation system that uses AI with vision capabilities and Puppeteer to achieve user-defined goals through autonomous web navigation. Supports both OpenAI and Ollama as AI providers.

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/GPT-Protocol/007-agent.git
   cd 007-agent
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

Detailed documentation, architecture, and advanced configuration options are available below.

## Features

- **Multiple AI Providers**: 
  - OpenAI (GPT-4V)
  - Ollama (Local models with vision capabilities)
- **Vision-Enhanced Navigation**: Uses AI vision to analyze and interact with web pages
- **Autonomous Decision Making**: Makes intelligent decisions based on visual and textual context
- **Real-Time Feedback**: Shows current status, steps, and visual feedback
- **Configurable Models**: Choose between different models for both chat and vision tasks

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

## Architecture

### Core Components

1. **Frontend (`app/components/Agent.tsx`)**
   - Main interface for user interaction
   - Displays current status, steps taken, and execution timeline
   - Shows visual feedback of current webpage state
   - Displays active AI provider and model information
   - Uses the `useAgent` hook for state management and API interactions

2. **Agent Hook (`app/hooks/useAgent.ts`)**
   - Central state management for the agent
   - Manages:
     - Current goal
     - Navigation steps
     - Processing status
     - Error handling
     - Completion state
     - Screenshot data
   - Provides:
     - `startMission`: Initiates a new goal
     - `reset`: Clears current state

3. **AI Providers**
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

4. **API Endpoint (`app/api/agent/route.ts`)**
   - Handles step execution and decision making
   - Three-phase process:
     1. **Vision Phase**: Takes screenshots of current page state
     2. **Decision Phase**: Uses AI with vision to analyze and determine next step
     3. **Execution Phase**: Uses Puppeteer to execute the step

### Step Execution Flow

1. **Step Types**
   ```typescript
   interface Step {
     type: 'goto' | 'click' | 'complete';
     url?: string;
     elementText?: string;
     description: string;
     selector?: string;
   }
   ```

2. **Vision-Enhanced Navigation**
   - Takes full-page screenshots after each step
   - Sends screenshots to AI for visual analysis
   - Makes decisions based on actual visible elements
   - Ensures accurate element selection and interaction

3. **Element Finding Strategy**
   - Vision-based verification of element existence
   - Primary: Exact text match on clickable elements
   - Secondary: Selector-based finding
   - Fallback: Partial text match
   - Ensures elements are:
     - Visible in the current view
     - Actually clickable
     - Not container elements

4. **Navigation Handling**
   - Supports both direct URL navigation and SPA routing
   - Waits for network requests to complete
   - Verifies navigation success through URL changes
   - Takes screenshots to confirm page state

## Technical Details

### GPT-4 Vision Integration

1. **System Message**
   - Provides context about current state
   - Includes screenshot of current page
   - Defines strict JSON response format
   - Includes guidelines for element selection

2. **Screenshot Processing**
   - Takes full-page screenshots
   - Converts to base64 for API transmission
   - Stores locally for verification
   - Ensures page is fully loaded before capture

3. **Response Format**
   ```json
   // For navigation
   {
     "type": "goto",
     "url": "full URL",
     "description": "reason"
   }

   // For clicking
   {
     "type": "click",
     "elementText": "exact text",
     "selector": "CSS selector",
     "description": "reason"
   }

   // For completion
   {
     "type": "complete",
     "description": "reason"
   }
   ```

### Puppeteer Implementation

1. **Browser Setup**
   - Headless mode
   - 1280x800 viewport
   - Network request monitoring
   - Screenshot capabilities

2. **Element Interaction**
   ```typescript
   // Element finding logic
   const elements = document.querySelectorAll('a, button, [role="button"]');
   const element = elements.find(el => 
     el.textContent?.trim() === text && 
     window.getComputedStyle(el).display !== 'none'
   );
   ```

3. **Navigation Handling**
   ```typescript
   // Wait for navigation
   await page.waitForNetworkIdle({ timeout: 10000 });
   
   // Take screenshot after navigation
   const screenshot = await takeScreenshot(page);
   ```

## State Management

1. **Agent State Interface**
   ```typescript
   interface AgentState {
     goal: string | null;
     currentUrl: string | null;
     steps: Step[];
     isProcessing: boolean;
     error: string | null;
     isComplete: boolean;
     screenshot: string | null;
   }
   ```

2. **Response Interface**
   ```typescript
   interface AgentResponse {
     nextStep: Step;
     currentUrl: string;
     error?: string;
     isComplete: boolean;
     screenshot: string;
   }
   ```

## Configuration

The system can be configured using environment variables. Copy `.env.example` to `.env` and adjust the values:

### AI Provider Configuration
```bash
# Choose AI provider: 'openai' or 'ollama'
AI_PROVIDER=openai

# OpenAI Configuration (if using OpenAI provider)
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4-vision-preview

# Ollama Configuration (if using Ollama provider)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llava
```

### Development Features
```bash
# Enable detailed logging (default: false)
ENABLE_LOGGING=false
# Enable saving screenshots to disk (default: false)
ENABLE_SCREENSHOTS=false
# Directory for saving screenshots (default: screenshots)
SCREENSHOT_DIR=screenshots
# Directory for saving logs (default: logs)
LOG_DIR=logs
```

### Browser Configuration
```bash
# Browser viewport settings
BROWSER_WIDTH=1280
BROWSER_HEIGHT=800
# Navigation timeouts (in milliseconds)
NAVIGATION_TIMEOUT=30000
NETWORK_IDLE_TIMEOUT=10000
```

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
   git clone https://github.com/GPT-Protocol/007-agent.git
   cd 007-agent
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
