import { NextResponse } from 'next/server';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from '../../lib/ai/provider-factory';
import { playwrightService } from '../../lib/browser/playwright-service';
import { actionExecutor } from '../../lib/actions/executor';
import type { ChatMessage } from '../../lib/ai/types';
import type { Action } from '../../lib/actions/types';

// Initialize AI provider
const aiProvider = AIProviderFactory.createProvider(config.ai);

async function getNextAction(goal: string, currentUrl: string | null, actions: Action[], screenshot?: string): Promise<Action> {
  logger.log('\n=== Getting Next Action ===');
  logger.log('Current State:', {
    goal,
    currentUrl,
    actionsCount: actions.length,
    lastAction: actions[actions.length - 1]?.description || 'No previous actions'
  });

  const systemMessage: ChatMessage = {
    role: 'system',
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
      "text": "exact text of element to click",
      "selector": "CSS selector (optional)",
      "description": "why we're clicking this element"
    }
    
    For typing:
    {
      "type": "type",
      "selector": "input field selector",
      "text": "text to type",
      "description": "why we're typing this text"
    }
    
    For completion:
    {
      "type": "complete",
      "description": "A detailed explanation of what we found and why the goal is complete"
    }

    CRITICAL INSTRUCTIONS:
    1. ALWAYS use real, legitimate websites - never use example.com or placeholder URLs
    2. Choose well-known, reputable websites appropriate for the task
    3. Use the most direct and reliable path to achieve the goal
    4. ANALYZE THE CURRENT VIEW FIRST - if you see enough information to satisfy the goal, complete the mission
    5. Only navigate further if the current view doesn't contain enough information
    
    6. For ANY click action:
       - Use EXACTLY matching text you see on the page
       - Only try to click actual clickable elements (links, buttons)
       - Do not try to click static text or labels
    
    7. For type actions:
       - Ensure the input field exists and is visible
       - Use clear and specific selectors
       - Keep input text concise and relevant
    
    Current goal: ${goal}
    Current URL: ${currentUrl}
    Actions taken: ${actions.map(a => a.description).join(', ')}`
  };

  const userMessage: ChatMessage = {
    role: 'user',
    content: `Look at the current webpage view carefully. What elements do you see that are actually clickable or interactive? Based on these visible elements, what should be the next action to achieve: ${goal}`
  };

  logger.log('\n=== Requesting AI Decision ===');
  logger.log('System prompt length:', systemMessage.content.length);
  logger.log('Has screenshot:', !!screenshot);

  const response = screenshot 
    ? await aiProvider.chatWithVision([systemMessage, userMessage], screenshot)
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

    // Initialize browser if needed
    await playwrightService.initialize();

    // If we have a current URL but haven't navigated yet, go there first
    let screenshot = '';
    if (currentUrl && actions.length === 0) {
      const result = await actionExecutor.execute({
        type: 'goto',
        url: currentUrl,
        description: 'Returning to current page'
      });
      screenshot = result.screenshot;
    }

    // Get next action from AI
    const nextAction = await getNextAction(goal, currentUrl, actions, screenshot);

    // If the action is 'complete', return immediately
    if (nextAction.type === 'complete') {
      logger.log('\n=== Mission Complete ===');
      await playwrightService.cleanup();
      return NextResponse.json({
        nextAction,
        currentUrl,
        isComplete: true,
        screenshot: screenshot || await playwrightService.takeScreenshot()
      });
    }

    // Execute the action
    logger.log('\n=== Executing Action ===');
    const result = await actionExecutor.execute(nextAction);

    // Handle action failure
    if (!result.success) {
      logger.error('Action failed:', result.error);
      await playwrightService.cleanup();
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const response = {
      nextAction,
      currentUrl: result.currentUrl,
      screenshot: result.screenshot,
      isComplete: false
    };

    logger.log('\n=== Returning Response ===');
    logger.log('Response:', {
      actionType: response.nextAction.type,
      currentUrl: response.currentUrl,
      isComplete: response.isComplete
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('\n=== Error in Agent Endpoint ===');
    logger.error('Error details:', error);
    await playwrightService.cleanup();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}