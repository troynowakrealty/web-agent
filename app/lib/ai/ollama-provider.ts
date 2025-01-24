import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private visionModel: string;

  constructor(baseUrl: string, model: string, visionModel: string) {
    // Convert localhost to explicit IPv4 address
    this.baseUrl = baseUrl.replace('localhost', '127.0.0.1');
    this.baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    this.model = model;
    this.visionModel = visionModel;
    logger.log('Initialized Ollama provider:', {
      baseUrl: this.baseUrl,
      model: this.model,
      visionModel: this.visionModel
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      logger.log(`\n=== Ollama Chat Request (${this.model}) ===`);
      logger.log('Messages:', messages);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          format: 'json',
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      logger.log(`\n=== Ollama Chat Response (${this.model}) ===`);
      logger.log('Response:', data);
      
      return data.message?.content || '';
    } catch (error) {
      logger.error(`Ollama chat error (${this.model}):`, error);
      throw error;
    }
  }

  async chatWithVision(messages: ChatMessage[], imageBase64: string): Promise<string> {
    try {
      logger.log(`\n=== Ollama Vision Chat Request (${this.visionModel}) ===`);
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

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.visionModel,
          messages: messagesWithImage,
          format: 'json',
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const data = await response.json();
      logger.log(`\n=== Ollama Vision Chat Response (${this.visionModel}) ===`);
      logger.log('Response:', data);

      return data.message?.content || '';
    } catch (error) {
      logger.error(`Ollama vision chat error (${this.visionModel}):`, error);
      throw error;
    }
  }
} 