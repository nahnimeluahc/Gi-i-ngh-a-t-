import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DefinitionData, QuizQuestion, WritingGuide, SearchResult, ExtendedReadingData } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

//HELPER: Clean JSON string from Markdown code blocks
const cleanAndParseJSON = (text: string | undefined): any => {
  if (!text) return {};
  let cleanText = text.trim();
  // Remove markdown wrapping if present
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error:", e, "Original text:", text);
    throw new Error("Lỗi định dạng dữ liệu từ AI.");
  }
};

// --- MODULE TTS ---

export const generateSpeech = async (text: string, voice: 'Kore' | 'Puck', region: 'Bắc' | 'Nam'): Promise<string> => {
  const ai = getAiClient();
  // Limit text length for TTS to avoid timeout or errors
  const safeText = text.slice(0, 1000); 
  const prompt = `Hãy đọc diễn cảm câu chuyện sau bằng giọng ${region} bộ: ${safeText}`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Không nhận được dữ liệu âm thanh.");
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};

// --- MODULE SEARCH ---

export const searchStoryVideos = async (topic: string): Promise<SearchResult[]> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tìm 5 video kể chuyện hoặc phim hoạt hình trên YouTube về chủ đề: "${topic}". Trả về danh sách tiêu đề và link video.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      return chunks
        .filter(chunk => chunk.web && chunk.web.uri.includes('youtube.com'))
        .map(chunk => ({
          title: chunk.web?.title || "Video kể chuyện",
          uri: chunk.web?.uri || "",
        }));
    }
    return [];
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
};

// Updated: Use generation for "Real" images to ensure reliability (avoid broken URLs)
export const searchRealImage = async (keyword: string): Promise<string | null> => {
  // We utilize the generation model but ask for "Photorealistic" style to simulate a real image search.
  // This prevents CORS issues and 404s common with direct image searching.
  return await generateIllustration(`A highly detailed, photorealistic photograph of ${keyword}. Educational textbook style, 4k resolution, clear lighting, no text.`);
};

// --- MODULE EXTENDED READING ---

export const generateExtendedReading = async (topic: string, grade: number): Promise<ExtendedReadingData> => {
  const ai = getAiClient();
  
  // 1. Generate Text Content and Image Keywords
  const prompt = `Bạn là chuyên gia giáo dục tiểu học. Hãy tìm hoặc viết một bài đọc mở rộng (khoảng 200-300 chữ) về chủ đề "${topic}" cho học sinh Lớp ${grade}.
  Nội dung cần chính xác, giáo dục, hấp dẫn và phù hợp lứa tuổi.
  Đồng thời, hãy liệt kê từ 1 đến 4 từ khóa (tiếng Việt hoặc Anh) để tìm hình ảnh minh họa thực tế cho bài đọc này.
  
  Trả về JSON:
  {
    "title": "Tên bài đọc",
    "content": "Nội dung bài đọc (dùng Markdown, KHÔNG dùng code block)",
    "imageKeywords": ["từ khóa 1", "từ khóa 2", ...],
    "source": "Nguồn thông tin (nếu có)"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Enable grounding to get facts
        responseMimeType: "application/json",
      },
    });

    const result = cleanAndParseJSON(response.text);
    
    // Validate result structure
    if (!result.title || !result.content) {
        throw new Error("Invalid response structure");
    }

    const keywords: string[] = result.imageKeywords || [];
    
    // 2. Parallel Process for Images
    const imagePromises = keywords.slice(0, 4).map(async (kw) => {
        try {
            // Try "Real" style generation first
            const realUrl = await searchRealImage(kw);
            if (realUrl) return { url: realUrl, type: 'real' as const, caption: kw };
            
            // Fallback to Cartoon style if real fails (unlikely with generation)
            const aiUrl = await generateIllustration(`Cute colorful illustration for children education: ${kw}`);
            if (aiUrl) return { url: aiUrl, type: 'ai' as const, caption: kw };
        } catch (e) {
            return null;
        }
        return null;
    });

    const images = (await Promise.all(imagePromises)).filter(img => img !== null) as { url: string; type: 'real' | 'ai'; caption: string }[];

    return {
        title: result.title,
        content: result.content,
        images: images,
        source: result.source
    };

  } catch (error) {
    console.error("Extended Reading Error", error);
    throw new Error("Lỗi tìm kiếm thông tin.");
  }
};

// --- MODULE A & E: READING & DEFINITIONS ---

export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Bạn là chuyên gia OCR. Hãy trích xuất toàn bộ văn bản tiếng Việt trong ảnh. Giữ nguyên định dạng đoạn văn. Chỉ trả về văn bản thuần." },
        ],
      },
    });
    return response.text?.trim() || "Không tìm thấy văn bản.";
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Không đọc được ảnh.");
  }
};

export const explainForKids = async (word: string, grade: number): Promise<DefinitionData> => {
  const ai = getAiClient();
  try {
    const prompt = `Giải thích từ "${word}" cho học sinh Lớp ${grade}. 
    Yêu cầu: Nghĩa đơn giản, dễ hiểu. Kèm 1 câu ví dụ.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Fast model
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            definition: { type: Type.STRING },
            exampleSentence: { type: Type.STRING }
          },
          required: ["word", "definition", "exampleSentence"]
        }
      },
    });
    return cleanAndParseJSON(response.text) as DefinitionData;
  } catch (error) {
    console.error("Definition Error:", error);
    throw error;
  }
};

// NEW: Batch analyze vocabulary for caching
export const analyzeVocabularyContext = async (text: string, grade: number): Promise<DefinitionData[]> => {
  const ai = getAiClient();
  try {
    const prompt = `Phân tích văn bản dưới đây và trích xuất danh sách các từ vựng (từ khó, từ hay, từ láy, thành ngữ) quan trọng phù hợp với học sinh Lớp ${grade}.
    Với mỗi từ, hãy cung cấp định nghĩa đơn giản và một câu ví dụ.
    
    Văn bản: """${text}"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Fast & Cost-effective for large context
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              definition: { type: Type.STRING },
              exampleSentence: { type: Type.STRING }
            },
            required: ["word", "definition", "exampleSentence"]
          }
        }
      },
    });
    return cleanAndParseJSON(response.text) as DefinitionData[];
  } catch (error) {
    console.error("Batch Vocabulary Analysis Error:", error);
    return [];
  }
};

export const generateIllustration = async (prompt: string): Promise<string | null> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
    });
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
  } catch (e) { return null; }
};

// --- MODULE B: STORYTELLING ---

export const generateStoryFromPrompt = async (topic: string, grade: number, base64Image?: string): Promise<string> => {
  const ai = getAiClient();
  const promptText = `Hãy đóng vai một người kể chuyện thiếu nhi. Viết một câu chuyện ngắn, sáng tạo, ý nghĩa giáo dục dành cho học sinh Lớp ${grade} về chủ đề: "${topic}". Ngôn ngữ trong sáng, sinh động, phù hợp trình độ đọc hiểu lớp ${grade}.`;
  
  const parts: any[] = [{ text: promptText }];
  if (base64Image) {
    parts.unshift({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
  }

  try {
    const response = await ai.models.generateContent({
      model: base64Image ? "gemini-2.5-flash-image" : "gemini-3-flash-preview",
      contents: { parts },
    });
    return response.text || "Không thể tạo câu chuyện lúc này.";
  } catch (error) {
    console.error("Story Error", error);
    throw new Error("Lỗi tạo truyện.");
  }
};

export const generateStoryScenes = async (story: string): Promise<string[]> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Dựa trên câu chuyện sau, hãy tạo ra 4 câu mô tả ngắn gọn (bằng tiếng Anh) về 4 cảnh quan trọng nhất trong truyện để vẽ tranh minh họa cho trẻ em.
      Mô tả cần chi tiết về nhân vật, hành động và bối cảnh.
      Phong cách: "Cute 3D cartoon style, vivid colors, bright lighting, high quality, for children book".
      Câu chuyện: """${story}"""`,
      config: {
        responseMimeType: "application/json",
      }
    });
    return cleanAndParseJSON(response.text) as string[];
  } catch (error) {
    console.error("Story Scenes Error", error);
    return [];
  }
};

// --- MODULE C: EXERCISES (QUIZ) ---

export const generateQuiz = async (topic: string, grade: number, base64Image?: string, contextText?: string): Promise<QuizQuestion[]> => {
  const ai = getAiClient();
  
  let prompt = `Tạo 5 câu hỏi trắc nghiệm tiếng Việt (Luyện từ và câu) cho học sinh Lớp ${grade}.\n`;
  
  if (topic) prompt += `Chủ đề chính: "${topic}".\n`;
  if (contextText) prompt += `Dựa trên nội dung văn bản sau để ra câu hỏi: """${contextText}"""\n`;
  if (base64Image) prompt += `QUAN TRỌNG: Hãy phân tích hình ảnh đính kèm (bài tập mẫu hoặc đoạn văn) để tạo ra các câu hỏi tương tự hoặc dựa trên nội dung đó.\n`;
  
  prompt += `Độ khó phù hợp với chương trình Tiếng Việt lớp ${grade}. Output JSON format: Array of objects.`;

  const parts: any[] = [{ text: prompt }];
  if (base64Image) {
    parts.unshift({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
  }

  try {
    const response = await ai.models.generateContent({
      model: base64Image ? "gemini-2.5-flash-image" : "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } }, // 4 options
              correctAnswer: { type: Type.INTEGER, description: "Index 0-3" },
              explanation: { type: Type.STRING },
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"],
          },
        },
      },
    });
    return cleanAndParseJSON(response.text) as QuizQuestion[];
  } catch (error) {
    console.error("Quiz Error", error);
    throw new Error("Lỗi tạo bài tập.");
  }
};

// --- MODULE D: WRITING SUPPORT ---

export const generateWritingSupport = async (topic: string, type: string, grade: number, mode: 'paragraph' | 'outline' | 'essay', base64Image?: string): Promise<WritingGuide> => {
  const ai = getAiClient();
  
  let userInstruction = "";
  
  if (mode === 'paragraph') {
      userInstruction = `
      YÊU CẦU CHẾ ĐỘ: VIẾT ĐOẠN VĂN NGẮN.
      1. Trường 'sampleText': Bắt buộc là một đoạn văn duy nhất. Các câu viết nối tiếp nhau liên tục, không được xuống dòng, không gạch đầu dòng. Độ dài khoảng 5-7 câu.
      2. Trường 'outline': Gợi ý ngắn gọn cấu trúc của đoạn văn đó (câu mở đoạn, các câu thân đoạn, câu kết đoạn).
      `;
  } else if (mode === 'outline') {
      userInstruction = `
      YÊU CẦU CHẾ ĐỘ: LẬP DÀN Ý CHI TIẾT.
      1. Trường 'outline': Bắt buộc trình bày rõ ràng 3 phần: 
         1. Mở bài
         2. Thân bài
         3. Kết bài
         Mỗi phần phải có các ý nhỏ liệt kê bằng gạch ngang đầu dòng (-).
      2. Trường 'sampleText': Chỉ viết một đoạn Mở bài mẫu ngắn để minh họa (không viết cả bài).
      `;
  } else if (mode === 'essay') {
      userInstruction = `
      YÊU CẦU CHẾ ĐỘ: VIẾT BÀI VĂN HOÀN CHỈNH.
      1. Trường 'sampleText': Bắt buộc phải là bài văn hoàn chỉnh gồm 3 phần rõ rệt:
         - Mở bài: 1 đoạn văn.
         - Thân bài: Chia thành 1 đến 3 đoạn văn tùy ý.
         - Kết bài: 1 đoạn văn.
         Các đoạn phải tách nhau bằng dấu xuống dòng.
      2. Trường 'outline': Tóm tắt dàn ý sơ lược của bài văn đó.
      `;
  }
  
  const prompt = `Vai trò: Giáo viên Tiếng Việt tiểu học dạy Lớp ${grade}.
  Đề bài: ${topic} (${type}).
  ${base64Image ? "QUAN TRỌNG: Hãy tham khảo hình ảnh đính kèm (tranh minh họa, dàn ý mẫu, hoặc đề bài trong sách) để viết nội dung bám sát nhất." : ""}
  
  ${userInstruction}
  
  Hãy trả về JSON gồm:
  - outline: (String) Nội dung dàn ý theo yêu cầu trên.
  - sampleText: (String) Nội dung văn bản mẫu theo yêu cầu trên.
  - tips: (String) Lời khuyên, từ ngữ hay nên dùng cho đề bài này.
  `;

  const parts: any[] = [{ text: prompt }];
  if (base64Image) {
    parts.unshift({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
  }

  try {
    const response = await ai.models.generateContent({
      model: base64Image ? "gemini-2.5-flash-image" : "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outline: { type: Type.STRING },
            sampleText: { type: Type.STRING },
            tips: { type: Type.STRING },
          },
          required: ["outline", "sampleText", "tips"],
        },
      },
    });
    return cleanAndParseJSON(response.text) as WritingGuide;
  } catch (error) {
    console.error("Writing Error", error);
    throw new Error("Lỗi tạo dàn ý.");
  }
};