export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  useDefaultTemperature?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export class OpenAIClient {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async createChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<ChatCompletionResult> {
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
      choices: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string; content?: string }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const rawContent = payload.choices[0]?.message?.content;
    let textResult: string | null = null;
    if (typeof rawContent === 'string') {
      textResult = rawContent;
    } else if (Array.isArray(rawContent)) {
      textResult = rawContent
        .map((entry) => {
          if (!entry) return '';
          if (typeof entry === 'string') return entry;
          return entry.text || entry.content || '';
        })
        .join('')
        .trim();
    }

    if (!textResult) {
      throw new Error('OpenAI response missing content');
    }
    return {
      content: textResult.trim(),
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens
    };
  }
}
