export interface DefinitionData {
  word: string;
  definition: string;
  exampleSentence: string;
  imagePrompt?: string; // Used internally to generate the image
}

export interface GeneratedContent {
  imageUrl: string | null;
}

export enum AppState {
  IDLE,
  PROCESSING_OCR,
  PROCESSING_DEFINITION,
  READY
}

export interface HistoryItem {
  id: string;
  word: string;
  definition: string;
  timestamp: number;
}
