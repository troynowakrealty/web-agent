import { OpenAI } from 'openai';
import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  private visionModel: string;

  constructor(apiKey: string, model: string, visionModel: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.visionModel = visionModel;
    logger.log('Initialized OpenAI provider:', {
      model: this.model,
      visionModel: this.visionModel
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      logger.log(`\n=== OpenAI Chat Request (${this.model}) ===`);
      logger.log('Messages:', messages);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any, // Type assertion needed due to OpenAI types mismatch
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      logger.log(`\n=== OpenAI Chat Response (${this.model}) ===`);
      logger.log('Response:', response.choices[0].message);

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error(`OpenAI chat error (${this.model}):`, error);
      if (error instanceof Error && error.message.includes('maximum context length')) {
        throw new Error('Response too large. Try reducing the number of elements or simplifying the request.');
      }
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    try {
      logger.log(`\n=== OpenAI Vision Chat Request (${this.visionModel}) ===`);
      logger.log('Messages:', messages);
      logger.log('Image provided:', !!imageBase64);

      // Convert messages to include image for vision model
      const messagesWithImage = messages.map(msg => {
        if (msg.role === 'user') {
          return {
            ...msg,
            content: Array.isArray(msg.content) ? msg.content : [
              { type: 'text', text: msg.content },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          };
        }
        return msg;
      });

      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: messagesWithImage as any, // Type assertion needed due to OpenAI types mismatch
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      logger.log(`\n=== OpenAI Vision Chat Response (${this.visionModel}) ===`);
      logger.log('Response:', response.choices[0].message);

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error(`OpenAI vision chat error (${this.visionModel}):`, error);
      if (error instanceof Error && error.message.includes('maximum context length')) {
        throw new Error('Response too large. Try reducing the number of elements or simplifying the request.');
      }
      throw error;
    }
  }
} 