import OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  private visionModel: string;

  constructor(apiKey: string, model: string, visionModel: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.visionModel = visionModel;
    logger.log('info', { 
      message: 'Initialized OpenAI provider',
      data: {
        model: this.model,
        visionModel: this.visionModel
      }
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      logger.log('info', { message: `=== OpenAI Chat Request (${this.model}) ===` });
      logger.log('info', { message: 'Messages', data: messages });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })) as ChatCompletionMessageParam[],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      logger.log('info', { message: `=== OpenAI Chat Response (${this.model}) ===` });
      logger.log('info', { message: 'Response', data: response.choices[0].message });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error({ 
        message: `OpenAI chat error (${this.model})`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      if (error instanceof Error && error.message.includes('maximum context length')) {
        throw new Error('Response too large. Try reducing the number of elements or simplifying the request.');
      }
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    try {
      logger.log('info', { message: `=== OpenAI Vision Chat Request (${this.visionModel}) ===` });
      logger.log('info', { message: 'Messages', data: messages });
      logger.log('info', { message: 'Image provided', data: { hasImage: !!imageBase64 } });

      // Convert messages to include image for vision model
      const messagesWithImage = messages.map(msg => {
        if (msg.role === 'user') {
          const content: ChatCompletionContentPart[] = [
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : '' },
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

      logger.log('info', { message: `=== OpenAI Vision Chat Response (${this.visionModel}) ===` });
      logger.log('info', { message: 'Response', data: response.choices[0].message });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error({ 
        message: `OpenAI vision chat error (${this.visionModel})`,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      if (error instanceof Error && error.message.includes('maximum context length')) {
        throw new Error('Response too large. Try reducing the number of elements or simplifying the request.');
      }
      throw error;
    }
  }

  async streamResponse(prompt: string): Promise<Response> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      });

      if (!response.ok) {
        const error: OpenAIError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error.message}`);
      }

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to stream response: ${error.message}`);
      }
      throw new Error('Failed to stream response');
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error: OpenAIError = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${error.error.message}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate response: ${error.message}`);
      }
      throw new Error('Failed to generate response');
    }
  }
} 