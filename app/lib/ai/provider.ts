import OpenAI from 'openai';
import { ChatMessage, toChatCompletionMessage } from './types';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface AIProvider {
  chat(messages: ChatMessage[], image?: string): Promise<ChatMessage>;
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(messages: ChatMessage[], image?: string): Promise<ChatMessage> {
    logger.log('\n=== OpenAI Vision Chat Request (gpt-4o-mini) ===');
    logger.log('Messages:', messages);
    logger.log('Image provided:', !!image);

    const apiMessages = messages.map(toChatCompletionMessage);
    if (image) {
      apiMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: messages[messages.length - 1].content },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
        ]
      });
    }

    const response = await this.client.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: apiMessages,
      max_tokens: 1000
    });

    logger.log('\n=== OpenAI Vision Chat Response (gpt-4o-mini) ===');
    const reply = response.choices[0].message;
    logger.log('Response:', {
      role: reply.role,
      content: reply.content,
      refusal: null
    });

    return {
      role: reply.role as ChatMessage['role'],
      content: reply.content || ''
    };
  }
}

export class AIProviderFactory {
  static createProvider(config: { provider: string; apiKey: string }): AIProvider {
    switch (config.provider.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(config.apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
} 