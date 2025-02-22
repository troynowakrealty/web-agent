import { ChatMessage } from './types';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { OpenAI } from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class AIProvider {
  private client: OpenAI;
  private model: string;
  private visionModel: string;

  constructor() {
    if (!config.ai.openai?.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey: config.ai.openai.apiKey });
    this.model = config.ai.openai.model;
    this.visionModel = config.ai.openai.visionModel;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    logger.log('info', { message: '=== OpenAI Vision Chat Request (gpt-4o-mini) ===' });
    logger.log('info', { message: 'Messages', data: messages });

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })) as ChatCompletionMessageParam[],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      logger.log('info', { message: '=== OpenAI Chat Response ===', data: response.choices[0].message });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error({
        message: 'OpenAI chat error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    logger.log('info', { message: '=== OpenAI Vision Chat Request (gpt-4o-mini) ===' });
    logger.log('info', { message: 'Messages', data: messages });
    logger.log('info', { message: 'Image provided', data: !!imageBase64 });

    try {
      const messagesWithImage = messages.map(msg => {
        if (msg.role === 'user') {
          const content: ChatCompletionContentPart[] = [
            { type: 'text', text: msg.content },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'auto'
              }
            }
          ];
          return {
            role: msg.role,
            content
          } as ChatCompletionMessageParam;
        }
        return {
          role: msg.role,
          content: msg.content
        } as ChatCompletionMessageParam;
      });

      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: messagesWithImage,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      logger.log('info', { message: '=== OpenAI Vision Chat Response ===', data: response.choices[0].message });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error({
        message: 'OpenAI vision chat error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }
} 