export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  useDefaultTemperature?: boolean;
}

export class OpenAIClient {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async createChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(options.useDefaultTemperature ? {} : { temperature: options.temperature ?? 0.2 }),
        max_completion_tokens: options.maxTokens ?? 512
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response missing content');
    }
    return content.trim();
  }
}
