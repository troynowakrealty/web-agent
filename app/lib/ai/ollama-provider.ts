import { AIProvider, ChatMessage } from './types';
import { logger } from '../../utils/logger';
import { ollama } from 'ollama-ai-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private visionModel: string;

  constructor(baseUrl: string, model: string, visionModel: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
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

      const result = await generateText({
        model: ollama(this.model),
        messages: messages as any,
        temperature: 0.5,
        maxTokens: 1024,
        tools: {
          agentResponse: tool({
            parameters: z.object({
              type: z.string(),
              description: z.string(),
              url: z.string().optional(),
            }),
            execute: async (args) => args,
          }),
        },
      });

      logger.log(`\n=== Ollama Chat Response (${this.model}) ===`);
      logger.log('Response:', result);
      
      // Extract the tool result if available, otherwise use the raw text
      if (result.toolResults && result.toolResults.length > 0) {
        const toolResult = result.toolResults[0];
        return JSON.stringify(toolResult.result);
      }
      
      return result.text;
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
              { type: 'text', text: msg.content + '\nIMPORTANT: Respond ONLY with a JSON object in the format: { "type": string, "description": string, "url"?: string }' },
              { type: 'image', image: Buffer.from(imageBase64, 'base64') }
            ]
          };
        }
        return msg;
      });

      const result = await generateText({
        model: ollama(this.visionModel),
        messages: messagesWithImage as any,
        maxTokens: 1024,
        temperature: 0.5,
      });

      logger.log(`\n=== Ollama Vision Chat Response (${this.visionModel}) ===`);
      logger.log('Response:', result);

      try {
        // Try to parse the response as JSON
        const jsonResponse = JSON.parse(result.text);
        return JSON.stringify(jsonResponse);
      } catch (parseError) {
        // If parsing fails, try to extract JSON from the text
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return jsonMatch[0];
        }
        // If no JSON found, return a formatted error response
        return JSON.stringify({
          type: "error",
          description: "Failed to get structured response from vision model"
        });
      }
    } catch (error) {
      logger.error(`Ollama vision chat error (${this.visionModel}):`, error);
      throw error;
    }
  }
} 