import { Action, BrowserState } from '../actions/types';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AIProviderFactory } from './provider';

// Initialize AI provider
const aiProvider = AIProviderFactory.createProvider(config.ai);

interface AgentContext {
  currentUrl: string;
  actionsCount: number;
  lastAction?: string;
  browserState?: BrowserState;
}

export async function getNextAction(
  goal: string,
  context: AgentContext
): Promise<Action> {
  logger.log('\n=== Getting Next Action ===');
  logger.log('Current State:', {
    goal,
    currentUrl: context.currentUrl,
    actionsCount: context.actionsCount,
    lastAction: context.lastAction
  });

  // Prepare system message with current state
  const systemMessage = `You are an AI web navigation expert. Given a user's goal and the current webpage view, determine the next action to take.
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
    Current URL: ${context.currentUrl}
    Actions taken: ${context.lastAction ? context.lastAction : 'None'}
    
    ${context.browserState ? `
    Current page state:
    Title: ${context.browserState.title}
    
    Available Elements:
    ${context.browserState.elements.map((e: { index: number; tag: string; attributes: Record<string, string>; text: string }) => 
      `[${e.index}] <${e.tag}${Object.entries(e.attributes).map(([k,v]) => ` ${k}="${v}"`).join('')}>${e.text}</${e.tag}>`
    ).join('\n')}
    
    Current scroll position: x=${context.browserState.scrollPosition.x}, y=${context.browserState.scrollPosition.y}
    ` : ''}
    `;

  logger.log('System prompt length:', systemMessage.length);
  logger.log('Has browser state:', !!context.browserState);

  // Request AI decision
  logger.log('\n=== Requesting AI Decision ===');
  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: 'Look at the current webpage view and available elements carefully. What should be the next action to achieve: ' + goal }
  ];

  const response = await aiProvider.chat(messages, context.browserState?.screenshot);
  logger.log('\n=== Processing AI Response ===');

  try {
    const action = JSON.parse(response.content) as Action;
    logger.log('Next action:', action);
    return action;
  } catch (error) {
    logger.error('Failed to parse AI response:', error);
    throw new Error('Invalid AI response format');
  }
} 