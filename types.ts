export type ModuleType = 'READING' | 'STORY' | 'EXERCISE' | 'WRITING';

export type GradeLevel = 1 | 2 | 3 | 4 | 5;

export interface DefinitionData {
  word: string;
  definition: string;
  exampleSentence: string;
  imagePrompt?: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-3)
  explanation: string;
}

export interface WritingGuide {
  outline: string;
  sampleText?: string;
  tips: string;
}

export interface SearchResult {
  title: string;
  uri: string;
}

export enum AppState {
  IDLE,
  PROCESSING,
  READY,
  ERROR
}