export type MathspaceQuestionType = 'short_answer' | 'multiple_choice' | 'steps' | 'other';

export interface MathspaceQuestionContext {
  id?: string;
  type: MathspaceQuestionType;
  questionText: string;
  options?: string[];
  previousSteps?: string[];
  feedback?: string | null;
}

export interface MathspaceFeedback {
  wasCorrect: boolean;
  correctAnswer?: string;
  feedbackText?: string;
}

export interface MathspaceAnswer {
  raw: string;
  confidence: number;
}
