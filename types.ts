
export type ModuleType = 'READING' | 'STORY' | 'EXERCISE' | 'WRITING' | 'VOCABULARY' | 'EXTENDED_READING';

export type GradeLevel = 1 | 2 | 3 | 4 | 5;

export interface DefinitionData {
  word: string;
  definition: string;
  exampleSentence: string;
  imagePrompt?: string;
  cachedImage?: string | null; // Optimization: Cache the image URL
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

export interface ExtendedReadingData {
  title: string;
  content: string;
  images: { url: string; type: 'real' | 'ai'; caption: string }[];
  source?: string;
}

// --- SAVED DATA TYPES ---

export interface SavedStory {
  id: string;
  title: string;
  content: string;
  date: number;
  image?: string | null; // Base64 or URL
}

export interface SavedQuiz {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: number;
  questions: QuizQuestion[]; // Save questions to review later
  userAnswers: {[key:number]: number}; // Save user choices
}

export interface SavedWriting {
  id: string;
  topic: string;
  type: string;
  mode: 'paragraph' | 'outline' | 'essay';
  content: WritingGuide;
  date: number;
}

export interface SavedExtendedReading {
  id: string;
  request: string;
  data: ExtendedReadingData;
  date: number;
}

export enum AppState {
  IDLE,
  PROCESSING,
  READY,
  ERROR
}
