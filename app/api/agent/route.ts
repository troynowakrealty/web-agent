import { NextResponse } from 'next/server';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from '../../lib/ai/provider-factory';
import { playwrightService } from '../../lib/browser/playwright-service';
import { actionExecutor } from '../../lib/actions/executor';
import { DOMService } from '../../lib/browser/dom-service';
import type { ChatMessage, ChatMessageRole } from '../../lib/ai/types';
import type { Action, BrowserState } from '../../lib/actions/types';

// Initialize AI provider
const aiProvider = AIProviderFactory.createProvider(config.ai);

// Initialize services
let domService: DOMService;

async function getNextAction(
  goal: string,
  currentUrl: string | null,
  actions: Action[],
  browserState?: BrowserState
): Promise<Action> {
  logger.log('\n=== Getting Next Action ===');
  logger.log('Current State:', {
    goal,
    currentUrl,
    actionsCount: actions.length,
    lastAction: actions[actions.length - 1]?.description || 'No previous actions'
  });

  const systemMessage: ChatMessage = {
    role: 'system' as ChatMessageRole,
    content: `You are an AI web navigation expert. Given a user's goal and the current webpage view, determine the next action to take.
    You must return a JSON object with one of these formats:
    
    For initial navigation:
    {
      "type": "goto",
      "url": "full URL to navigate to",
      "description": "why we're going to this URL"
    }
    
    For clicking elements:
    {
      "type": "click",
      "index": 123,
      "description": "why we're clicking this element"
    }
    
    For typing:
    {
      "type": "type",
      "index": 123,
      "text": "text to type",
      "description": "why we're typing this text"
    }
    
    For scrolling:
    {
      "type": "scroll",
      "index": 123,
      "description": "why we're scrolling to this element"
    }
    
    For completion:
    {
      "type": "complete",
      "description": "why we're done",
      "summary": "detailed summary of what was found",
      "evaluation": "success" | "failed" | "partial"
    }

    CRITICAL INSTRUCTIONS FOR TASK COMPLETION:
    1. For flight searches:
       - Mark as complete when flight options are clearly displayed
       - Include available flight details in the completion summary
       - Don't continue clicking if valid flight results are shown
      
    2. General completion criteria:
       - If the current view shows the information needed to satisfy the goal
       - If further actions would not provide additional relevant information
       - When the core objective has been achieved
       - When search results or options are clearly displayed

    CRITICAL INSTRUCTIONS FOR ELEMENT INTERACTION:
    1. Elements are indexed starting from 1 and are shown with [index] in the page state
    2. Each element entry shows:
       - Index number in brackets [1]
       - Full HTML tag with attributes
       - Element content/text
       - Visual highlight color on the page
    
    3. Before interacting with any element:
       - Verify the element exists in the current page state
       - Check if the element is visible (shown in page state)
       - Ensure the element is interactive (links, buttons, inputs, etc.)
       - Use the exact index number shown in brackets
    
    4. For clicking:
       - Only click elements that are actually clickable
       - Verify the element's purpose matches your intent
       - If element is not in view, use scroll action first
    
    5. For typing:
       - Only type in input fields, textareas, or contenteditable elements
       - Verify the input field is visible and enabled
       - Keep input text relevant and concise
    
    6. For scrolling:
       - Use when elements are out of the viewport
       - Scroll to elements before interacting with them
       - Check element visibility after scrolling

    7. Page State Understanding:
       - Review the full element list before deciding actions
       - Consider element hierarchy and relationships
       - Pay attention to element attributes and roles
       - Use element text content to confirm correct targets

    CRITICAL RULES:
    1. ALWAYS use real, legitimate websites - never use example.com or placeholder URLs
    2. Choose well-known, reputable websites appropriate for the task
    3. Use the most direct and reliable path to achieve the goal
    4. ANALYZE THE CURRENT VIEW FIRST - if you see enough information to satisfy the goal, complete the mission
    5. Only navigate further if the current view doesn't contain enough information
    
    Current goal: ${goal}
    Current URL: ${currentUrl}
    Actions taken: ${actions.map(a => a.description).join(', ')}

    ${browserState ? `
    Current page state:
    Title: ${browserState.title}
    
    Available Elements:
    ${browserState.elements}
    
    Current scroll position: x=${browserState.scrollPosition.x}, y=${browserState.scrollPosition.y}
    ` : ''}
    `
  };

  const userMessage: ChatMessage = {
    role: 'user' as ChatMessageRole,
    content: `Look at the current webpage view and available elements carefully. What should be the next action to achieve: ${goal}`
  };

  logger.log('\n=== Requesting AI Decision ===');
  logger.log('System prompt length:', systemMessage.content.length);
  logger.log('Has browser state:', !!browserState);

  const response = browserState?.screenshot 
    ? await aiProvider.chatWithVision([systemMessage, userMessage], browserState.screenshot)
    : await aiProvider.chat([systemMessage, userMessage]);

  logger.log('\n=== Processing AI Response ===');
  
  try {
    const nextAction = JSON.parse(response);
    logger.log('Next action:', nextAction);
    return nextAction;
  } catch (error) {
    logger.error('Failed to parse AI response:', error);
    logger.error('Raw response:', response);
    throw new Error('Failed to parse AI response as JSON');
  }
}

export async function POST(req: Request) {
  logger.log('\n=== New Agent Request ===');

  try {
    const { goal, currentUrl, actions = [] } = await req.json();
    logger.log('Request payload:', { goal, currentUrl, actionsCount: actions.length });

    // Initialize browser and wait for it to be ready
    await playwrightService.initialize();
    
    // Get the page after initialization
    const page = await playwrightService.getPage();
    if (!page) {
      throw new Error('Failed to initialize browser page');
    }

    // If this is a new session with a current URL, navigate to it first
    if (currentUrl && actions.length === 0) {
      logger.log('Performing initial navigation to:', currentUrl);
      await playwrightService.goto(currentUrl);
    }

    // Get the current browser state
    let browserState: BrowserState | undefined;
    try {
      const domService = new DOMService();
      const pageState = await domService.getPageState(true);
      const formattedElements = await domService.getFormattedElements();
      
      browserState = {
        url: await playwrightService.getCurrentUrl(),
        title: pageState.title,
        elements: formattedElements,
        scrollPosition: pageState.scrollPosition,
        screenshot: await playwrightService.takeScreenshot()
      };

      logger.log('Browser state captured:', {
        url: browserState.url,
        title: browserState.title,
        elementCount: browserState.elements.split('\n').length
      });
    } catch (error) {
      logger.error('Failed to get initial browser state:', error);
      // Continue without browser state for initial navigation
    }

    // Get the next action from the AI
    const nextAction = await getNextAction(goal, currentUrl, actions, browserState);
    logger.log('\n=== Processing AI Response ===');
    logger.log('Next action:', nextAction);

    // Execute the action
    try {
      const result = await actionExecutor.execute(nextAction);
      
      logger.log('\n=== Returning Response ===');
      return NextResponse.json({
        actionType: nextAction.type,
        currentUrl: result.currentUrl,
        isComplete: nextAction.type === 'complete',
        nextAction,
        screenshot: result.screenshot,
        pageState: result.pageState
      });
    } catch (error) {
      logger.error('Action execution failed:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        currentUrl: await playwrightService.getCurrentUrl()
      });
    }
  } catch (error) {
    logger.error('\n=== Error in Agent Endpoint ===');
    logger.error('Error details:', error);
    
    // Attempt cleanup even if there's an error
    try {
      await actionExecutor.cleanup();
    } catch (cleanupError) {
      logger.error('Cleanup error:', cleanupError);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}