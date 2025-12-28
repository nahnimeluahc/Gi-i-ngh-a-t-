import React, { useState, useRef, useEffect, useCallback } from 'react';
import { extractTextFromImage, explainForKids, generateIllustration, generateQuiz, generateStoryFromPrompt, generateWritingSupport, generateSpeech, searchStoryVideos, searchRealImage, generateStoryScenes, analyzeVocabularyContext, generateExtendedReading } from './services/geminiService';
import { DefinitionData, AppState, ModuleType, QuizQuestion, WritingGuide, GradeLevel, SearchResult, SavedStory, SavedQuiz, SavedWriting, ExtendedReadingData, SavedExtendedReading } from './types';
import { IconCamera, IconTrash, IconSearch, IconRefresh, IconBook, IconPen, IconStar, IconChat, IconCheck, IconX, IconStop, IconMagic, IconSettings, IconSun, IconMoon, IconLaptop, IconImage, IconAppLogo, IconMobile, IconTablet, IconNotebook, IconHeart, IconSpeaker, IconVolume, IconGlobe } from './components/Icons';
import DefinitionModal from './components/DefinitionModal';
import SmartGestureModal from './components/SmartGestureModal';

// --- AUDIO RESOURCES ---
const AUDIO_URLS = {
  bgMusic: "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3", // Happy 8-bit loop
  click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.m4a", // Soft pop
  correct: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.m4a", // Success chime
  wrong: "https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.m4a", // Soft bonk
  victory: "https://assets.mixkit.co/active_storage/sfx/1434/1434-preview.m4a", // Level up
};

// --- CURRICULUM DATA (Based on "Kết nối tri thức") ---
const CURRICULUM_DATA: Record<number, { quizTopics: string[], writingTypes: string[] }> = {
  1: {
    quizTopics: ["Âm và vần", "Quy tắc chính tả (c/k, g/gh, ng/ngh)", "Dấu thanh", "Từ chỉ sự vật", "Câu hỏi và dấu chấm hỏi"],
    writingTypes: ["Viết câu nêu hoạt động", "Điền từ vào chỗ trống", "Viết câu cảm ơn/xin lỗi", "Giới thiệu bản thân"]
  },
  2: {
    quizTopics: ["Từ chỉ sự vật, hoạt động, đặc điểm", "Câu kiểu Ai là gì?", "Câu kiểu Ai làm gì?", "Câu kiểu Ai thế nào?", "Dấu phẩy, Dấu chấm", "Từ ngữ về nghề nghiệp"],
    writingTypes: ["Kể về người thân", "Kể về một hoạt động ở trường", "Viết bưu thiếp", "Viết tin nhắn", "Kể về con vật nuôi", "Kể về việc làm tốt"]
  },
  3: {
    quizTopics: ["Từ chỉ gộp", "Biện pháp so sánh", "Câu khiến", "Câu cảm", "Dấu hai chấm", "Từ ngữ về cộng đồng", "Dấu gạch ngang"],
    writingTypes: ["Kể về một buổi lễ chào cờ", "Kể về người hàng xóm", "Viết thư cho bạn", "Tả đồ vật em yêu thích", "Nêu tình cảm, cảm xúc về cảnh đẹp"]
  },
  4: {
    quizTopics: ["Danh từ", "Động từ", "Tính từ", "Biện pháp nhân hóa", "Dấu ngoặc kép", "Câu kể Ai làm gì?", "Chủ ngữ và Vị ngữ", "Trạng ngữ", "Dấu ngoặc đơn"],
    writingTypes: ["Tả cây cối", "Tả con vật", "Viết báo cáo thảo luận", "Kể chuyện cổ tích bằng lời văn của em", "Viết thư thăm hỏi", "Tả đồ chơi", "Thuật lại một sự việc"]
  },
  5: {
    quizTopics: ["Từ đồng nghĩa", "Từ trái nghĩa", "Từ đa nghĩa", "Đại từ", "Kết từ", "Câu ghép", "Biện pháp điệp từ", "Mở rộng vốn từ: Tổ quốc"],
    writingTypes: ["Tả phong cảnh", "Tả người", "Viết báo cáo công việc", "Viết bài văn tranh luận", "Kể chuyện sáng tạo", "Viết đoạn văn thể hiện tình cảm"]
  }
};

const EXTENDED_READING_TOPICS = [
  "Khoa học: Vòng đời của bướm",
  "Khoa học: Tại sao trời mưa?",
  "Thế giới động vật: Khủng long bạo chúa",
  "Lịch sử: Sự tích Hồ Gươm",
  "Lịch sử: Anh Kim Đồng",
  "Địa lý: Vịnh Hạ Long",
  "Địa lý: Hang Sơn Đoòng",
  "Danh nhân: Bác Hồ",
  "Danh nhân: Trạng Quỳnh",
  "Kỹ năng sống: Lòng hiếu thảo",
  "Kỹ năng sống: Bảo vệ môi trường",
  "Vũ trụ: Hệ mặt trời",
];

// --- AUDIO UTILS ---
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// --- HELPER ---
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- GLOBAL STYLES FOR SCROLLBAR ---
const GlobalStyles = () => (
  <style>{`
    .custom-scrollbar::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.05);
      border-radius: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: #fbbf24; /* amber-400 */
      border-radius: 8px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: #f59e0b; /* amber-500 */
    }
    .dark .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: #d97706; /* amber-600 */
    }
    /* Slider Range Style */
    input[type=range] {
      -webkit-appearance: none;
      width: 100%;
      background: transparent;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 16px;
      width: 16px;
      border-radius: 50%;
      background: #0ea5e9;
      margin-top: -6px;
      cursor: pointer;
    }
    input[type=range]::-webkit-slider-runnable-track {
      width: 100%;
      height: 4px;
      cursor: pointer;
      background: #e2e8f0;
      border-radius: 2px;
    }
    .dark input[type=range]::-webkit-slider-runnable-track {
      background: #4b5563;
    }
  `}</style>
);

// --- SETTINGS COMPONENT ---
interface SettingsModalProps {
  onClose: () => void;
  settings: {
    fontSize: 'normal' | 'large';
    soundEffects: boolean;
    bgMusic: boolean;
    autoExplain: boolean;
    themeMode: 'light' | 'dark' | 'system';
    background: string;
    viewMode: 'desktop' | 'tablet' | 'mobile';
    volume: number;
  };
  onUpdateSettings: (key: string, value: any) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, settings, onUpdateSettings }) => {
  
  const bgOptions = [
    { id: 'bg-brand-50', color: '#f0f9ff', name: 'Mặc định' },
    { id: 'bg-orange-50', color: '#fff7ed', name: 'Giấy' },
    { id: 'bg-emerald-50', color: '#ecfdf5', name: 'Thiên nhiên' },
    { id: 'bg-pink-50', color: '#fdf2f8', name: 'Mộng mơ' },
    { id: 'bg-slate-100', color: '#f1f5f9', name: 'Hiện đại' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up border border-brand-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="bg-brand-500 p-4 text-white flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center"><IconSettings className="mr-2"/> Cài đặt ứng dụng</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition"><IconX className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-6">
          
          {/* View Mode Section */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Chế độ hiển thị</h4>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => onUpdateSettings('viewMode', 'mobile')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.viewMode === 'mobile' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-gray-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconMobile className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Điện thoại</span>
              </button>
              <button 
                onClick={() => onUpdateSettings('viewMode', 'tablet')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.viewMode === 'tablet' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-gray-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconTablet className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Tablet</span>
              </button>
              <button 
                onClick={() => onUpdateSettings('viewMode', 'desktop')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.viewMode === 'desktop' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-gray-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconLaptop className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Máy tính</span>
              </button>
            </div>
          </div>

          {/* Theme Section */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Giao diện (Sáng / Tối)</h4>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => onUpdateSettings('themeMode', 'light')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.themeMode === 'light' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-gray-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconSun className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Sáng</span>
              </button>
              <button 
                onClick={() => onUpdateSettings('themeMode', 'dark')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.themeMode === 'dark' ? 'border-brand-500 bg-gray-800 text-brand-500' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconMoon className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Tối</span>
              </button>
              <button 
                onClick={() => onUpdateSettings('themeMode', 'system')}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition ${settings.themeMode === 'system' ? 'border-brand-500 bg-gray-100 text-brand-700 dark:bg-gray-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}
              >
                <IconLaptop className="w-6 h-6 mb-1"/>
                <span className="text-xs font-bold">Hệ thống</span>
              </button>
            </div>
          </div>

          {/* Background Section */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Hình nền / Màu nền</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {bgOptions.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => onUpdateSettings('background', bg.id)}
                  className={`relative w-10 h-10 rounded-full flex-shrink-0 border-2 transition transform hover:scale-110 ${settings.background === bg.id ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: bg.color }}
                  title={bg.name}
                >
                  {settings.background === bg.id && <div className="absolute inset-0 flex items-center justify-center text-brand-600"><IconCheck className="w-5 h-5"/></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Interface Section */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Hiển thị</h4>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Cỡ chữ</span>
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                <button 
                  onClick={() => onUpdateSettings('fontSize', 'normal')}
                  className={`px-3 py-1 text-sm rounded-md transition ${settings.fontSize === 'normal' ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-white shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  Vừa
                </button>
                <button 
                  onClick={() => onUpdateSettings('fontSize', 'large')}
                  className={`px-3 py-1 text-sm rounded-md transition ${settings.fontSize === 'large' ? 'bg-white dark:bg-gray-600 text-brand-600 dark:text-white shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  Lớn
                </button>
              </div>
            </div>
          </div>

          {/* Audio Section */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Âm thanh</h4>
            
            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Hiệu ứng (Click, Đúng/Sai)</span>
              <button 
                onClick={() => onUpdateSettings('soundEffects', !settings.soundEffects)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${settings.soundEffects ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${settings.soundEffects ? 'translate-x-6' : 'translate-x-0'}`}/>
              </button>
            </div>

            {/* Background Music Toggle */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-700 dark:text-gray-200 font-medium">Nhạc nền vui nhộn</span>
              <button 
                onClick={() => onUpdateSettings('bgMusic', !settings.bgMusic)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${settings.bgMusic ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${settings.bgMusic ? 'translate-x-6' : 'translate-x-0'}`}/>
              </button>
            </div>

            {/* Volume Control */}
            <div>
               <div className="flex justify-between mb-1">
                  <span className="text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center"><IconVolume className="w-4 h-4 mr-1"/> Âm lượng</span>
                  <span className="text-gray-500 text-xs font-bold">{Math.round(settings.volume * 100)}%</span>
               </div>
               <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={settings.volume} 
                  onChange={(e) => onUpdateSettings('volume', parseFloat(e.target.value))}
               />
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
           <button onClick={onClose} className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-6 rounded-xl shadow transition">
             Xong
           </button>
        </div>
      </div>
    </div>
  );
};


// --- COMPONENTS FOR MODULES ---

const ExtendedReadingModule = ({ grade, settings, playSFX, onLookup, onSpeak, savedExtendedReadings, onSave, onRemove }: any) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedReadingData | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');

  const textSizeClass = settings.fontSize === 'large' ? 'text-lg leading-relaxed' : 'text-base leading-relaxed';

  const handleSearch = async () => {
    if (!topic) return alert("Hãy nhập chủ đề em muốn tìm hiểu!");
    setLoading(true);
    playSFX('click');
    setResult(null);
    try {
      const res = await generateExtendedReading(topic, grade);
      setResult(res);
      playSFX('victory');
    } catch (e: any) {
      alert(e.message || "Lỗi tìm kiếm thông tin. Vui lòng thử lại!");
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (!result) return;
    playSFX('click');
    const newItem: SavedExtendedReading = {
      id: Date.now().toString(),
      request: topic,
      data: result,
      date: Date.now()
    };
    onSave(newItem);
  };

  const handleLoadSaved = (item: SavedExtendedReading) => {
    setTopic(item.request);
    setResult(item.data);
    setActiveTab('search');
    playSFX('click');
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const str = selection?.toString().trim();
    if (str && str.length > 0 && str.length < 50) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if(rect) {
          onLookup(str, { x: rect.left + rect.width/2, y: rect.top + window.scrollY });
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-20">
       <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => {setActiveTab('search'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'search' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconGlobe className="w-5 h-5 mr-2"/> Tìm hiểu & Đọc
            </button>
            <button onClick={() => {setActiveTab('saved'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'saved' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconNotebook className="w-5 h-5 mr-2"/> Đã lưu <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">{savedExtendedReadings.length}</span>
            </button>
       </div>

       {activeTab === 'saved' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {savedExtendedReadings.length === 0 && <div className="col-span-full text-center text-gray-400 py-10">Chưa có bài đọc nào được lưu.</div>}
             {savedExtendedReadings.map((item: SavedExtendedReading) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col" onClick={() => handleLoadSaved(item)}>
                   <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-brand-700 dark:text-brand-300 line-clamp-1">{item.data.title}</h4>
                      <button onClick={(e) => {e.stopPropagation(); onRemove(item.id); playSFX('click');}} className="text-gray-400 hover:text-red-500"><IconTrash className="w-4 h-4"/></button>
                   </div>
                   <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{item.data.content}</p>
                   {item.data.images.length > 0 && (
                      <div className="h-24 w-full rounded-lg overflow-hidden bg-gray-100 mt-auto">
                         <img src={item.data.images[0].url} className="w-full h-full object-cover" alt="thumbnail"/>
                      </div>
                   )}
                </div>
             ))}
          </div>
       ) : (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left: Search & Suggestions */}
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700">
                  <h3 className="font-bold text-lg text-brand-700 dark:text-brand-400 mb-3">🔍 Em muốn tìm hiểu gì?</h3>
                  <div className="relative mb-4">
                     <input 
                       type="text" 
                       value={topic}
                       onChange={(e) => setTopic(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                       placeholder="Ví dụ: Cá heo, Bác Hồ, Sự tích..."
                       className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                     />
                     <IconSearch className="absolute left-3 top-3.5 w-5 h-5 text-gray-400"/>
                  </div>
                  <button 
                    onClick={handleSearch} 
                    disabled={loading}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-xl shadow transition flex justify-center items-center"
                  >
                     {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : <IconMagic className="mr-2"/>}
                     Tìm kiếm & Tạo bài đọc
                  </button>
               </div>

               <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Gợi ý chủ đề hay</h3>
                  <div className="flex flex-wrap gap-2">
                     {EXTENDED_READING_TOPICS.map((t, i) => (
                        <button 
                           key={i} 
                           onClick={() => { setTopic(t); playSFX('click'); }}
                           className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-brand-900 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition text-left"
                        >
                           {t}
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Right: Content */}
            <div className="lg:col-span-2">
               {result ? (
                  <div className="bg-paper dark:bg-gray-800 p-8 rounded-2xl shadow-md border-2 border-brand-100 dark:border-gray-700 min-h-[500px] animate-fade-in-up transition-colors relative">
                     <div className="flex justify-between items-start mb-6 border-b border-brand-200 dark:border-gray-700 pb-4">
                        <div>
                           <h2 className="text-2xl font-bold text-brand-800 dark:text-brand-300 mb-1">{result.title}</h2>
                           {result.source && <p className="text-xs text-gray-500 italic">Nguồn: {result.source}</p>}
                        </div>
                        <div className="flex space-x-2">
                           <button onClick={() => onSpeak(result.content)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-brand-100 dark:hover:bg-gray-600 transition" title="Đọc bài"><IconSpeaker className="w-5 h-5"/></button>
                           <button onClick={handleSave} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full hover:bg-red-100 transition" title="Lưu bài"><IconHeart className="w-5 h-5"/></button>
                        </div>
                     </div>

                     {/* Image Grid */}
                     {result.images.length > 0 && (
                        <div className={`grid gap-3 mb-6 ${result.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                           {result.images.map((img, idx) => (
                              <div key={idx} className="group relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 dark:border-gray-600">
                                 <img 
                                    src={img.url} 
                                    alt={img.caption} 
                                    className="w-full h-full object-cover transition transform group-hover:scale-105"
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                    <p className="text-white text-xs font-medium truncate w-full">{img.caption}</p>
                                 </div>
                                 <span className={`absolute top-2 right-2 text-[10px] text-white px-2 py-0.5 rounded-full font-bold shadow-sm ${img.type === 'ai' ? 'bg-purple-500/80' : 'bg-blue-500/80'}`}>
                                    {img.type === 'ai' ? 'AI Vẽ' : 'Ảnh thật (AI)'}
                                 </span>
                              </div>
                           ))}
                        </div>
                     )}

                     <div 
                        onMouseUp={handleMouseUp}
                        className={`prose ${textSizeClass} max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap selection:bg-yellow-200 selection:text-black cursor-text`}
                     >
                        {result.content}
                     </div>
                  </div>
               ) : (
                  <div className="h-full bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-8 text-center transition-colors">
                     {loading ? (
                        <div className="flex flex-col items-center animate-pulse">
                           <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"/>
                           <p className="text-lg font-bold text-brand-600">Đang tìm kiếm thông tin và hình ảnh...</p>
                           <p className="text-sm">Thầy giáo AI đang đọc sách và tìm ảnh đẹp cho em đấy!</p>
                        </div>
                     ) : (
                        <>
                           <IconGlobe className="w-20 h-20 mb-4 opacity-20"/>
                           <p className="text-lg font-medium">Kết quả tìm kiếm sẽ hiện ở đây.</p>
                           <p className="text-sm">Hãy chọn một chủ đề bên trái hoặc nhập từ khóa nhé!</p>
                        </>
                     )}
                  </div>
               )}
            </div>
         </div>
       )}
    </div>
  );
};

// ... (No changes to VocabularyModule component)
const VocabularyModule = ({ savedWords, onRemove, onView, settings, playSFX }: { 
  savedWords: DefinitionData[], 
  onRemove: (word: string) => void, 
  onView: (wordData: DefinitionData) => void,
  settings: any,
  playSFX: (t: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWords = savedWords.filter(item => 
    item.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto pb-20">
       <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700 mb-6 transition-colors">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center">
                <div className="bg-pink-100 dark:bg-pink-900/30 p-3 rounded-full mr-4 text-pink-600 dark:text-pink-400">
                   <IconNotebook className="w-8 h-8"/>
                </div>
                <div>
                   <h3 className="font-bold text-xl text-brand-800 dark:text-brand-300">Sổ tay từ vựng của em</h3>
                   <p className="text-sm text-gray-500 dark:text-gray-400">Lưu giữ {savedWords.length} từ vựng đã học</p>
                </div>
             </div>
             {savedWords.length > 0 && (
                <div className="relative">
                   <input 
                     type="text" 
                     placeholder="Tìm từ..." 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-brand-200 outline-none w-48 transition-all"
                   />
                   <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-3"/>
                </div>
             )}
          </div>

          {savedWords.length === 0 ? (
             <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <IconHeart className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                <p className="text-lg font-medium">Sổ tay còn trống.</p>
                <p className="text-sm mt-2">Bé hãy bấm vào biểu tượng trái tim <IconHeart className="inline w-4 h-4"/> khi tra từ để lưu vào đây nhé!</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWords.map((item, index) => (
                   <div 
                     key={index} 
                     className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-700 transition-all group flex flex-col h-full relative cursor-pointer"
                     onClick={() => { onView(item); playSFX('click'); }}
                   >
                      <div className="flex justify-between items-start mb-3">
                         <div className="flex-1">
                            <h4 className="font-bold text-lg text-brand-700 dark:text-brand-400 capitalize mb-1">{item.word}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.definition}</p>
                         </div>
                         {item.cachedImage && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 flex-shrink-0 ml-2 bg-gray-50">
                               <img src={item.cachedImage} className="w-full h-full object-cover" alt={item.word} />
                            </div>
                         )}
                      </div>
                      
                      <div className="mt-auto pt-3 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
                         <span className="italic truncate max-w-[70%]">"{item.exampleSentence}"</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onRemove(item.word); playSFX('click'); }}
                           className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 rounded-full transition-colors z-10"
                           title="Xóa từ này"
                         >
                            <IconTrash className="w-4 h-4"/>
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          )}
       </div>
    </div>
  );
};

const ReadingModule = ({ onLookup, isLookupMode, setLookupMode, grade, settings, playSFX, onBatchCache, savedWords, onRemoveWord, onViewWord }: any) => {
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'reading' | 'vocab'>('reading');

  const textSizeClass = settings.fontSize === 'large' ? 'text-xl leading-loose' : 'text-lg leading-relaxed';

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    try {
      setImageUrl(URL.createObjectURL(file));
      const b64 = await readFileAsBase64(file);
      const res = await extractTextFromImage(b64);
      setText(res);
      playSFX('correct'); // Subtle confirmation
      
      // Auto trigger batch vocabulary analysis
      if (res && res.length > 20) {
         triggerBatchAnalysis(res);
      }
    } catch(e: any) { alert(e.message || "Lỗi đọc ảnh"); }
    setIsLoading(false);
  };

  const triggerBatchAnalysis = async (content: string) => {
     setIsAnalyzing(true);
     try {
        await onBatchCache(content);
     } catch (e) { console.log(e); }
     setIsAnalyzing(false);
  };

  // Paste Handler for Reading
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Check if we are focusing an input, if so, don't intercept standard paste
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        // If pasting text into textarea, we also want to trigger analysis
        if (document.activeElement?.tagName === 'TEXTAREA') {
           setTimeout(() => {
              // Wait for value to update
              const val = (document.activeElement as HTMLTextAreaElement).value;
              if (val.length > 20) triggerBatchAnalysis(val);
           }, 100);
        }
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleProcessFile(file);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Text Selection
  const handleMouseUp = () => {
    if (!isLookupMode) return;
    const selection = window.getSelection();
    const str = selection?.toString().trim();
    if (str && str.length > 0 && str.length < 50) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if(rect) {
          playSFX('click');
          onLookup(str, { x: rect.left + rect.width/2, y: rect.top + window.scrollY });
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
        {/* Module Header Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => { setActiveTab('reading'); playSFX('click'); }}
                className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 flex items-center ${activeTab === 'reading' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
                <IconBook className="w-5 h-5 mr-2"/>
                Đọc & Tra từ
            </button>
            <button 
                onClick={() => { setActiveTab('vocab'); playSFX('click'); }}
                className={`pb-2 px-4 font-bold text-lg transition-colors border-b-2 flex items-center ${activeTab === 'vocab' ? 'border-pink-500 text-pink-600 dark:text-pink-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
                <IconNotebook className="w-5 h-5 mr-2"/>
                Sổ tay từ vựng <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{savedWords.length}</span>
            </button>
        </div>

        {activeTab === 'reading' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
              {/* Input */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow border border-brand-100 dark:border-gray-700 flex flex-col h-fit transition-colors">
                <h3 className="font-bold text-brand-600 dark:text-brand-400 mb-2 flex items-center flex-shrink-0 sticky top-0 bg-white dark:bg-gray-800 z-10 py-2">
                  <IconCamera className="w-5 h-5 mr-2"/> 
                  <span>Văn bản / Ảnh sách</span>
                  <span className="ml-auto text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Hỗ trợ lớp {grade}</span>
                </h3>
                
                {/* Scrollable Container for Input */}
                <div className="flex-1 flex flex-col min-h-[300px]">
                    {!imageUrl ? (
                      <div onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 min-h-[150px] border-2 border-dashed border-brand-200 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-50 dark:hover:bg-gray-700 transition p-6 group mb-4">
                        <div className="bg-brand-50 dark:bg-gray-700 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                           <IconCamera className="w-8 h-8 text-brand-500 dark:text-brand-400"/>
                        </div>
                        <p className="text-brand-700 dark:text-brand-300 font-bold text-lg mb-1">Chụp / Tải ảnh trang sách</p>
                        <p className="text-center text-sm text-gray-500 dark:text-gray-400">hoặc Dán ảnh (Ctrl+V) trực tiếp vào đây</p>
                        <input type="file" hidden ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleProcessFile(e.target.files[0])} accept="image/*" />
                      </div>
                    ) : (
                      <div className="relative flex-shrink-0 h-64 bg-black/5 rounded-xl overflow-hidden group mb-4 border border-brand-100">
                        <img src={imageUrl} className="w-full h-full object-contain" />
                        <button onClick={() => { setImageUrl(null); setText(''); playSFX('click'); }} className="absolute top-2 right-2 bg-white/90 p-2 rounded-lg shadow text-red-500 hover:text-red-600 hover:bg-white transition"><IconTrash/></button>
                      </div>
                    )}
                    <textarea 
                      className="flex-1 min-h-[300px] p-4 border border-gray-200 dark:border-gray-600 rounded-xl w-full resize-none focus:ring-2 focus:ring-brand-200 outline-none text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" 
                      placeholder="Hoặc gõ/dán văn bản vào đây..." 
                      value={text} 
                      onChange={(e) => setText(e.target.value)}
                      onBlur={() => {
                         if (text.length > 20) triggerBatchAnalysis(text);
                      }}
                    />
                </div>
              </div>

              {/* Output */}
              <div className="bg-paper dark:bg-gray-800 rounded-2xl p-6 shadow border border-yellow-100 dark:border-gray-700 flex flex-col relative h-fit min-h-[500px] transition-colors">
                <div className="flex justify-between items-center mb-4 flex-shrink-0 sticky top-0 bg-paper dark:bg-gray-800 z-10 py-2 border-b dark:border-gray-700">
                   <h3 className="font-bold text-brand-600 dark:text-brand-400 flex items-center"><IconBook className="w-5 h-5 mr-2"/> Đọc & Giải Nghĩa</h3>
                   <div className="flex items-center gap-2">
                     {isAnalyzing && (
                       <div className="flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200 rounded-full text-xs font-bold animate-pulse">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-bounce"/>
                          Đang học từ vựng...
                       </div>
                     )}
                     <button onClick={() => { setLookupMode(!isLookupMode); playSFX('click'); }} className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1 ${isLookupMode ? 'bg-yellow-500 text-white shadow-md hover:bg-yellow-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                       <IconSearch className="w-3 h-3"/>
                       <span>{isLookupMode ? 'Tra từ: BẬT' : 'Tra từ: TẮT'}</span>
                     </button>
                   </div>
                </div>
                <div 
                  ref={textRef} onMouseUp={handleMouseUp}
                  className={`flex-1 prose max-w-none ${textSizeClass} whitespace-pre-wrap text-gray-800 dark:text-gray-100 ${isLookupMode ? 'cursor-help selection:bg-yellow-200 selection:text-black' : ''}`}
                  style={{ fontFamily: '"Quicksand", sans-serif' }}
                >
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-60 min-h-[300px]">
                       <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                       <p className="text-brand-600 font-medium animate-pulse">Đang đọc chữ trong ảnh...</p>
                    </div>
                  ) : (
                    text || <span className="text-gray-400 italic">Văn bản sẽ hiện ở đây. <br/>Bé hãy bôi đen từ khó để xem giải nghĩa nhé!</span>
                  )}
                </div>
              </div>
            </div>
        ) : (
            <VocabularyModule savedWords={savedWords} onRemove={onRemoveWord} onView={onViewWord} settings={settings} playSFX={playSFX} />
        )}
    </div>
  );
};

// ... (No changes to StoryModule)
const StoryModule = ({ grade, settings, playSFX, onLookup, savedStories, onSave, onRemove, onLoadStory }: any) => {
  const [topic, setTopic] = useState('');
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [videos, setVideos] = useState<SearchResult[]>([]);
  
  // Tabs for Story Module
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');
  
  // Image Generation State
  const [storyImages, setStoryImages] = useState<string[]>([]);
  const [isGenImages, setIsGenImages] = useState(false);
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null); 
  
  // TTS Settings
  const [voice, setVoice] = useState<'Kore' | 'Puck'>('Kore');
  const [region, setRegion] = useState<'Bắc' | 'Nam'>('Bắc');

  const textSizeClass = settings.fontSize === 'large' ? 'text-xl' : 'text-base';
  const proseClass = settings.fontSize === 'large' ? 'prose-xl' : 'prose-lg';

  // Check if current story is saved
  const isSaved = savedStories.some((s: SavedStory) => s.content === story && s.content !== '');

  useEffect(() => {
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = settings.volume;
    }
  }, [settings.volume]);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleCreate = async () => {
    if (!topic && !imgB64) return alert("Hãy nhập chủ đề hoặc tải ảnh!");
    stopAudio();
    setLoading(true);
    playSFX('click');
    setVideos([]);
    setStoryImages([]);
    try {
      const res = await generateStoryFromPrompt(topic || "Kể chuyện theo ảnh", grade, imgB64 || undefined);
      setStory(res);
      playSFX('correct');
      const videoRes = await searchStoryVideos(topic || "Kể chuyện thiếu nhi");
      setVideos(videoRes);
    } catch(e: any) { alert(e.message || "Lỗi tạo truyện"); }
    setLoading(false);
  };

  const handleProcessInputForReading = async () => {
    stopAudio();
    if (!topic && !imgB64) return alert("Hãy dán văn bản hoặc tải ảnh trang sách!");
    
    setLoading(true);
    playSFX('click');
    setStoryImages([]);
    try {
      let contentToRead = topic;
      if (imgB64 && !topic) {
        contentToRead = await extractTextFromImage(imgB64);
      } else if (imgB64 && topic) {
         const ocrText = await extractTextFromImage(imgB64);
         contentToRead = topic + "\n\n" + ocrText;
      }
      setStory(contentToRead);
      playSFX('correct');
      const keywords = contentToRead.split(' ').slice(0, 10).join(' ');
      searchStoryVideos(keywords).then(setVideos);
    } catch(e: any) { alert(e.message || "Lỗi xử lý nội dung"); }
    setLoading(false);
  };

  const handleReadAloud = async () => {
    if (!story) return;
    stopAudio();
    setTtsLoading(true);
    playSFX('click');
    try {
      const b64 = await generateSpeech(story, voice, region);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;
      
      const audioData = decodeBase64(b64);
      const buffer = await decodeAudioData(audioData, audioCtx, 24000, 1);
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = settings.volume;
      gainNode.connect(audioCtx.destination);
      gainNodeRef.current = gainNode;

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.onended = () => setIsPlaying(false);
      
      sourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch(e: any) {
      alert(e.message || "Lỗi khi đọc truyện. Vui lòng thử lại.");
    }
    setTtsLoading(false);
  };

  const handleGenImages = async () => {
    if (!story) return;
    setIsGenImages(true);
    playSFX('click');
    setStoryImages([]);
    try {
      const scenes = await generateStoryScenes(story);
      if (scenes.length === 0) throw new Error("Không tạo được kịch bản tranh.");
      const imagePromises = scenes.slice(0, 4).map(prompt => generateIllustration(prompt));
      const results = await Promise.all(imagePromises);
      const validImages = results.filter(img => img !== null) as string[];
      setStoryImages(validImages);
      if(validImages.length > 0) playSFX('victory');
    } catch (e: any) {
      alert(e.message || "Lỗi tạo tranh minh họa. Vui lòng thử lại.");
    }
    setIsGenImages(false);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const str = selection?.toString().trim();
    if (str && str.length > 0 && str.length < 50) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if(rect) {
          onLookup(str, { x: rect.left + rect.width/2, y: rect.top + window.scrollY });
      }
    }
  };

  const handleSaveCurrentStory = () => {
      if(!story) return;
      playSFX('click');
      const newStory: SavedStory = {
          id: Date.now().toString(),
          title: topic || (story.slice(0, 50) + "..."),
          content: story,
          date: Date.now(),
          image: storyImages[0] || null
      };
      onSave(newStory);
  };

  const handleLoadSavedStory = (s: SavedStory) => {
      setTopic(s.title);
      setStory(s.content);
      if(s.image) setStoryImages([s.image]);
      setActiveTab('create');
      playSFX('click');
      onLoadStory(); // Scroll to content if needed
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto space-y-6 pb-20">
       <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => {setActiveTab('create'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'create' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconStar className="w-5 h-5 mr-2"/> Tạo câu chuyện
            </button>
            <button onClick={() => {setActiveTab('saved'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'saved' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconNotebook className="w-5 h-5 mr-2"/> Kho truyện đã lưu <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">{savedStories.length}</span>
            </button>
       </div>

       {activeTab === 'saved' ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {savedStories.length === 0 && <div className="text-gray-400 col-span-2 text-center py-10">Chưa có câu chuyện nào được lưu.</div>}
               {savedStories.map((s: SavedStory) => (
                   <div key={s.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col" onClick={() => handleLoadSavedStory(s)}>
                       <div className="flex justify-between items-start mb-2">
                           <h4 className="font-bold text-lg text-brand-700 dark:text-brand-300 line-clamp-1">{s.title}</h4>
                           <button onClick={(e) => {e.stopPropagation(); onRemove(s.id); playSFX('click');}} className="text-gray-400 hover:text-red-500"><IconTrash className="w-4 h-4"/></button>
                       </div>
                       <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-3">{s.content}</p>
                       <div className="mt-auto text-xs text-gray-400">{new Date(s.date).toLocaleDateString('vi-VN')}</div>
                   </div>
               ))}
           </div>
       ) : (
       <>
       <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700 flex-shrink-0 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg text-brand-700 dark:text-brand-400">📖 Nội dung câu chuyện</h3>
            <span className="text-xs bg-brand-100 dark:bg-gray-700 text-brand-600 dark:text-brand-300 px-2 py-1 rounded-full font-bold">Lớp {grade}</span>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
             <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Chủ đề hoặc Nội dung truyện:</label>
                <textarea 
                  value={topic} onChange={(e) => setTopic(e.target.value)}
                  className={`w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 focus:border-brand-500 outline-none h-32 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${textSizeClass}`}
                  placeholder="Nhập chủ đề để AI kể HOẶC dán nội dung truyện trong sách vào đây để AI đọc..."
                />
             </div>
             <div className="w-full md:w-64 flex-shrink-0 flex flex-col">
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Ảnh minh họa / Trang sách:</label>
                <div className="relative flex-1 min-h-[128px]">
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={async (e) => {
                     if(e.target.files?.[0]) {
                       setImg(URL.createObjectURL(e.target.files[0]));
                       setImgB64(await readFileAsBase64(e.target.files[0]));
                       playSFX('click');
                     }
                   }}/>
                   <div className="w-full h-full bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-500 overflow-hidden hover:bg-brand-50 dark:hover:bg-gray-700 transition p-2">
                      {img ? <img src={img} className="w-full h-full object-contain rounded"/> : (
                        <>
                          <IconCamera className="mb-2 opacity-50"/>
                          <span className="text-xs text-center">Tải ảnh chụp trang sách<br/>hoặc ảnh minh họa</span>
                        </>
                      )}
                   </div>
                   {img && <button onClick={()=>{setImg(null);setImgB64(null); playSFX('click');}} className="absolute top-1 right-1 z-20 bg-white rounded-full p-1 text-red-500 shadow"><IconX className="w-4 h-4"/></button>}
                </div>
             </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
             <button onClick={handleCreate} disabled={loading} className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold py-3 px-4 rounded-xl shadow transition transform active:scale-[0.98] flex justify-center items-center">
                {loading && !story ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : <IconStar className="mr-2"/>}
                ✨ Tìm truyện/tạo truyện
             </button>
             <button onClick={handleProcessInputForReading} disabled={loading} className="flex-1 bg-white dark:bg-gray-700 border-2 border-brand-500 text-brand-600 dark:text-white hover:bg-brand-50 font-bold py-3 px-4 rounded-xl shadow-sm transition transform active:scale-[0.98] flex justify-center items-center">
                {loading && !story ? <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mr-2"/> : <IconMagic className="mr-2"/>}
                📖 Trích xuất & Đọc ngay
             </button>
          </div>
       </div>

       {story && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-paper dark:bg-gray-800 p-6 rounded-2xl shadow-md border-2 border-primary-100 dark:border-gray-700 flex flex-col h-fit transition-colors">
                <div className="flex flex-wrap items-center justify-between mb-4 border-b dark:border-gray-700 pb-4 gap-4 sticky top-0 bg-paper dark:bg-gray-800 z-10 transition-colors">
                  <div className="flex items-center">
                      <h4 className="text-xl font-bold text-brand-800 dark:text-brand-300 mr-2">📖 Nội dung câu chuyện</h4>
                      <button 
                        onClick={handleSaveCurrentStory} 
                        className={`p-1.5 rounded-full transition ${isSaved ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={isSaved ? "Đã lưu" : "Lưu câu chuyện này"}
                      >
                          <IconHeart className="w-6 h-6" filled={isSaved}/>
                      </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Voice Controls */}
                    <div className="flex bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-1 rounded-lg">
                      <button onClick={()=>setVoice('Kore')} className={`px-2 py-1 text-xs font-bold rounded ${voice==='Kore'?'bg-brand-100 text-brand-700 dark:bg-gray-600 dark:text-white':'text-gray-500 dark:text-gray-400'}`}>Cô giáo</button>
                      <button onClick={()=>setVoice('Puck')} className={`px-2 py-1 text-xs font-bold rounded ${voice==='Puck'?'bg-brand-100 text-brand-700 dark:bg-gray-600 dark:text-white':'text-gray-500 dark:text-gray-400'}`}>Thầy giáo</button>
                    </div>
                    <div className="flex bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-1 rounded-lg">
                      <button onClick={()=>setRegion('Bắc')} className={`px-2 py-1 text-xs font-bold rounded ${region==='Bắc'?'bg-brand-100 text-brand-700 dark:bg-gray-600 dark:text-white':'text-gray-500 dark:text-gray-400'}`}>Bắc</button>
                      <button onClick={()=>setRegion('Nam')} className={`px-2 py-1 text-xs font-bold rounded ${region==='Nam'?'bg-brand-100 text-brand-700 dark:bg-gray-600 dark:text-white':'text-gray-500 dark:text-gray-400'}`}>Nam</button>
                    </div>
                    
                    {/* New: Create Illustration Button */}
                    <button 
                       onClick={handleGenImages}
                       disabled={isGenImages}
                       className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg font-bold flex items-center text-sm shadow transition active:scale-95"
                       title="Tạo tranh minh họa"
                    >
                       {isGenImages ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <IconImage className="w-5 h-5"/>}
                    </button>

                    {!isPlaying ? (
                      <button 
                        onClick={handleReadAloud} 
                        disabled={ttsLoading}
                        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-bold flex items-center text-sm shadow transition active:scale-95"
                      >
                        {ttsLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : <IconChat className="mr-2 w-4 h-4"/>}
                        {ttsLoading ? 'Đang tải...' : 'Đọc'}
                      </button>
                    ) : (
                      <button 
                        onClick={stopAudio}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center text-sm shadow transition active:scale-95"
                      >
                        <IconStop className="mr-2 w-4 h-4"/> Dừng
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Generated Images Grid */}
                {storyImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {storyImages.map((src, i) => (
                      <div key={i} className="aspect-video rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-600 group relative">
                        <img src={src} alt={`Minh họa ${i+1}`} className="w-full h-full object-cover transition transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"/>
                      </div>
                    ))}
                  </div>
                )}
                
                <div 
                  onMouseUp={handleMouseUp}
                  className={`prose ${proseClass} max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-medium selection:bg-yellow-200 selection:text-black cursor-text`}
                >
                  {story}
                </div>
              </div>
            </div>

            {/* Video Search Results */}
            <div className="space-y-4">
              <h4 className="font-bold text-brand-700 dark:text-brand-300 flex items-center">
                <IconStar className="mr-2 text-yellow-500"/> Xem video YouTube
              </h4>
              {videos.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {videos.map((vid, i) => (
                    <a key={i} href={vid.uri} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-brand-100 dark:border-gray-700 shadow-sm hover:border-primary-500 transition group flex items-start space-x-3">
                      <div className="bg-red-50 text-red-500 p-2 rounded-lg group-hover:bg-red-500 group-hover:text-white transition flex-shrink-0">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z"/></svg>
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-snug line-clamp-2">{vid.title}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center text-gray-400">
                  {loading ? 'Đang tìm video...' : 'Nhập nội dung để xem các video gợi ý nhé!'}
                </div>
              )}
            </div>
         </div>
       )}
       </>
       )}
    </div>
  );
};

const QuizModule = ({ grade, settings, suggestedTopics = [], playSFX, onSpeak, savedQuizzes, onSave, onRemove }: any) => {
  const [topic, setTopic] = useState('');
  const [contextText, setContextText] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [answers, setAnswers] = useState<{[key:number]: number}>({});
  const [submitted, setSubmitted] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

  const textSizeClass = settings.fontSize === 'large' ? 'text-lg' : 'text-base';
  const questionSizeClass = settings.fontSize === 'large' ? 'text-xl' : 'text-lg';

  const handleGen = async () => {
    if(!topic && !imgB64 && !contextText) return alert("Hãy nhập chủ đề, dán văn bản hoặc tải ảnh bài tập!");
    setLoading(true);
    playSFX('click');
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    try {
       const qs = await generateQuiz(topic, grade, imgB64 || undefined, contextText || undefined);
       setQuestions(qs);
       playSFX('victory');
    } catch(e: any) { alert(e.message || "Lỗi tạo câu hỏi"); }
    setLoading(false);
  };

  const handleLoadMore = async () => {
     if(!topic && !imgB64 && !contextText) return;
     setLoadingMore(true);
     playSFX('click');
     try {
       const newQs = await generateQuiz(topic, grade, imgB64 || undefined, contextText || undefined);
       const currentMaxId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 0;
       const fixedQs = newQs.map((q, i) => ({
           ...q,
           id: currentMaxId + i + 1
       }));
       
       setQuestions(prev => [...prev, ...fixedQs]);
       setSubmitted(false);
       playSFX('correct'); 
     } catch(e: any) {
       console.error(e);
       alert(e.message || "Lỗi tải thêm câu hỏi");
     }
     setLoadingMore(false);
  };

  const handleAnswer = (qid: number, oid: number) => {
    if(submitted) return;
    setAnswers(p => ({...p, [qid]: oid}));
    playSFX('click');
  };

  const handleSubmit = () => {
     setSubmitted(true);
     let correctCount = 0;
     questions.forEach(q => {
         if(answers[q.id] === q.correctAnswer) correctCount++;
     });
     if(correctCount === questions.length) playSFX('victory');
     else if (correctCount > 0) playSFX('correct');
     else playSFX('wrong');
  };

  const handleSaveResult = () => {
      if(!submitted || questions.length === 0) return;
      playSFX('click');
      let correctCount = 0;
      questions.forEach(q => {
         if(answers[q.id] === q.correctAnswer) correctCount++;
      });
      
      const newSavedQuiz: SavedQuiz = {
          id: Date.now().toString(),
          topic: topic || "Bài tập tổng hợp",
          score: correctCount,
          total: questions.length,
          date: Date.now(),
          questions: questions,
          userAnswers: answers
      };
      onSave(newSavedQuiz);
  };

  const isSaved = false; // Results are saved as new entries every time

  const correctCount = questions.filter(q => answers[q.id] === q.correctAnswer).length;
  const totalCount = questions.length;

  return (
    <div className="h-full flex flex-col relative">
       <div className="max-w-4xl mx-auto space-y-6 pb-20 flex-1 w-full">
          <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                <button onClick={() => {setActiveTab('create'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'create' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                    <IconCheck className="w-5 h-5 mr-2"/> Làm bài tập
                </button>
                <button onClick={() => {setActiveTab('saved'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'saved' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                    <IconNotebook className="w-5 h-5 mr-2"/> Lịch sử làm bài <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">{savedQuizzes.length}</span>
                </button>
          </div>

          {activeTab === 'saved' ? (
              <div className="space-y-4">
                  {savedQuizzes.length === 0 && <div className="text-gray-400 text-center py-10">Chưa có bài tập nào được lưu.</div>}
                  {savedQuizzes.map((sq: SavedQuiz) => (
                      <div key={sq.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                          <div>
                              <h4 className="font-bold text-brand-700 dark:text-brand-300">{sq.topic}</h4>
                              <p className="text-sm text-gray-500">Kết quả: <span className="font-bold text-green-500">{sq.score}</span> / {sq.total}</p>
                              <p className="text-xs text-gray-400">{new Date(sq.date).toLocaleDateString('vi-VN')} {new Date(sq.date).toLocaleTimeString('vi-VN')}</p>
                          </div>
                          <button onClick={() => {onRemove(sq.id); playSFX('click');}} className="text-gray-400 hover:text-red-500 p-2"><IconTrash/></button>
                      </div>
                  ))}
              </div>
          ) : (
          <>
          {/* Settings Panel */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700 mb-6 space-y-4 transition-colors">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-brand-700 dark:text-brand-400 flex items-center"><IconCheck className="mr-2"/> Thiết lập bài tập</h3>
                <span className="text-xs bg-brand-100 dark:bg-gray-700 text-brand-600 dark:text-brand-300 px-2 py-1 rounded font-bold">Lớp {grade}</span>
             </div>

             <div className="relative z-0">
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Chủ đề (Bắt buộc)</label>
               <input 
                 value={topic} onChange={e => setTopic(e.target.value)}
                 className={`w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-brand-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition ${textSizeClass}`}
                 placeholder={suggestedTopics.length > 0 ? `Ví dụ: ${suggestedTopics[0]}...` : `Ví dụ: Từ láy, Danh từ...`}
               />
               {suggestedTopics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                     <span className="text-xs text-gray-400 font-bold self-center mr-1">Gợi ý:</span>
                     {suggestedTopics.map((t, i) => (
                        <button 
                           key={i} 
                           onClick={() => { setTopic(t); playSFX('click'); }}
                           className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full transition"
                        >
                           {t}
                        </button>
                     ))}
                  </div>
               )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col relative z-0">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Dán văn bản / đề bài (Tùy chọn)</label>
                  <textarea 
                    value={contextText}
                    onChange={e => setContextText(e.target.value)}
                    className={`flex-1 p-3 rounded-xl border border-gray-200 dark:border-gray-600 outline-none focus:ring-2 focus:ring-brand-200 resize-none h-32 bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${textSizeClass}`}
                    placeholder="Dán đoạn văn hoặc nội dung câu hỏi vào đây (Ctrl+V)..."
                  />
                </div>

                <div className="flex flex-col">
                   <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 flex justify-between">
                      Ảnh bài tập (Tùy chọn)
                      {img && <span className="text-red-500 cursor-pointer hover:underline" onClick={()=>{setImg(null);setImgB64(null); playSFX('click');}}>Xóa ảnh</span>}
                   </label>
                   <div className="relative flex-1 h-32">
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={async (e) => {
                        if(e.target.files?.[0]) {
                          setImg(URL.createObjectURL(e.target.files[0]));
                          setImgB64(await readFileAsBase64(e.target.files[0]));
                          playSFX('click');
                        }
                      }}/>
                      <div className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition bg-white dark:bg-gray-900 ${img ? 'border-brand-400' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                         {img ? (
                            <img src={img} className="w-full h-full object-contain rounded-lg p-1"/>
                         ) : (
                            <>
                               <IconCamera className="w-8 h-8 text-gray-400 mb-1"/>
                               <span className="text-sm font-bold text-gray-500">Tải ảnh bài tập</span>
                               <span className="text-xs text-gray-400">(.jpg, .png)</span>
                            </>
                         )}
                      </div>
                   </div>
                </div>
             </div>
             
             <div className="flex flex-col md:flex-row gap-3">
                <button onClick={handleGen} disabled={loading} className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-primary-600 transition transform active:scale-[0.99] flex justify-center items-center text-lg">
                   {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : '🚀 Tạo bài luyện tập'}
                </button>
                
                {questions.length > 0 && (
                   <button 
                     onClick={() => { setShowSmartModal(true); playSFX('click'); }}
                     className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform active:scale-[0.99] flex items-center justify-center"
                     title="Sử dụng camera để trả lời câu hỏi"
                   >
                      <IconCamera className="mr-2"/>
                      Tương tác thông minh
                   </button>
                )}
             </div>
          </div>

          {/* Results Area */}
          <div className="space-y-6">
             {questions.map((q, idx) => (
                <div key={q.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-brand-50 dark:border-gray-700 animate-fade-in-up transition-colors" style={{animationDelay: `${idx * 100}ms`}}>
                   <div className="flex items-start justify-between mb-4">
                      {/* FIX: Changed text-brand-800 to text-gray-900 and dark:text-gray-200 to dark:text-white for better contrast */}
                      <p className={`font-bold text-gray-900 dark:text-white ${questionSizeClass} flex-1`}>
                        <span className="bg-brand-100 dark:bg-gray-700 text-brand-600 dark:text-brand-400 px-2 py-1 rounded mr-2 text-base">Câu {idx+1}</span> 
                        {q.question}
                      </p>
                      <button 
                        onClick={() => onSpeak(q.question)} 
                        className="ml-2 p-2 bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-gray-600 rounded-full text-brand-600 dark:text-gray-300 transition-colors"
                        title="Đọc câu hỏi"
                      >
                        <IconSpeaker className="w-5 h-5"/>
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {q.options.map((opt, oIdx) => {
                         const isSelected = answers[q.id] === oIdx;
                         const isCorrect = q.correctAnswer === oIdx;
                         let bgClass = "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white";
                         
                         if (submitted) {
                           if (isCorrect) bgClass = "bg-green-100 dark:bg-green-900 border-green-300 ring-1 ring-green-500 text-green-900 dark:text-green-100";
                           else if (isSelected) bgClass = "bg-red-100 dark:bg-red-900 border-red-300 text-red-900 dark:text-red-100";
                           else bgClass = "opacity-50 dark:text-gray-400";
                         } else if (isSelected) {
                           bgClass = "bg-primary-50 dark:bg-primary-900 border-primary-300 ring-1 ring-primary-500 text-primary-900 dark:text-primary-100";
                         }

                         return (
                           <button 
                             key={oIdx}
                             disabled={submitted}
                             onClick={() => handleAnswer(q.id, oIdx)}
                             className={`p-3 rounded-xl border text-left transition ${bgClass} ${textSizeClass}`}
                           >
                             {opt}
                           </button>
                         );
                      })}
                   </div>
                   {submitted && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-lg text-sm flex items-start">
                         <span className="mr-2 text-xl">💡</span>
                         <span className="mt-0.5">{q.explanation}</span>
                         <button 
                            onClick={() => onSpeak(q.explanation)} 
                            className="ml-auto p-1.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full"
                            title="Đọc giải thích"
                         >
                            <IconSpeaker className="w-4 h-4"/>
                         </button>
                      </div>
                   )}
                </div>
             ))}
             
             {/* Summary Box ... */}
             {submitted && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border-2 border-primary-500 flex flex-col items-center justify-center animate-bounce-slow relative">
                   <button 
                      onClick={handleSaveResult} 
                      className="absolute top-4 right-4 p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 shadow transition"
                      title="Lưu kết quả"
                   >
                      <IconHeart className="w-6 h-6"/>
                   </button>

                   <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Kết quả của em</h3>
                   <div className="text-4xl font-bold mb-4">
                      <span className="text-green-500">{correctCount}</span>
                      <span className="text-gray-400 mx-2">/</span>
                      <span className="text-gray-800 dark:text-gray-200">{totalCount}</span>
                   </div>
                   <button 
                     onClick={handleLoadMore} 
                     disabled={loadingMore}
                     className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition transform active:scale-95 flex items-center"
                   >
                     {loadingMore ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : <IconRefresh className="w-5 h-5 mr-2"/>}
                     Luyện tập thêm (Thêm 5 câu)
                   </button>
                </div>
             )}

             {questions.length === 0 && !loading && (
                <div className="text-center text-gray-400 mt-10">
                   <IconCheck className="w-20 h-20 mx-auto mb-4 opacity-10"/>
                   <p className="text-lg">Nhập chủ đề hoặc dán đề bài để bắt đầu nhé!</p>
                </div>
             )}
          </div>
          </>
          )}
       </div>
       {/* ... Footer actions ... */}
       {questions.length > 0 && !submitted && activeTab === 'create' && (
         <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t dark:border-gray-700 z-30 flex justify-center w-full gap-4">
            <button onClick={handleSubmit} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg text-lg border-4 border-white flex-1 max-w-xs">
               Nộp bài ngay
            </button>
            <button onClick={handleLoadMore} disabled={loadingMore} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-full shadow-lg flex items-center justify-center min-w-[50px]">
               {loadingMore ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <IconRefresh className="w-6 h-6"/>}
            </button>
         </div>
       )}

       {showSmartModal && questions.length > 0 && (
          <SmartGestureModal 
             questions={questions}
             onClose={() => setShowSmartModal(false)}
             playSFX={playSFX}
             onLoadMore={handleLoadMore}
          />
       )}
    </div>
  );
};

const WritingModule = ({ grade, settings, writingTypes = [], playSFX, onLookup, onSpeak, savedWritings, onSave, onRemove }: any) => {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(writingTypes[0] || '');
  const [mode, setMode] = useState<'paragraph' | 'outline' | 'essay'>('outline');
  const [result, setResult] = useState<WritingGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [imgB64, setImgB64] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');

  const textSizeClass = settings.fontSize === 'large' ? 'text-lg leading-relaxed' : 'text-base leading-relaxed';

  // ... (Hooks and Handlers same as before) ...
  useEffect(() => {
    if (writingTypes.length > 0 && !writingTypes.includes(type)) {
      setType(writingTypes[0]);
    }
  }, [writingTypes, type]);

  const handleGenerate = async () => {
    if (!topic && !imgB64) return alert("Hãy nhập đề bài hoặc tải ảnh đề bài!");
    setLoading(true);
    playSFX('click');
    setResult(null);
    try {
      const res = await generateWritingSupport(topic || "Viết bài văn theo ảnh", type, grade, mode, imgB64 || undefined);
      setResult(res);
      playSFX('victory');
    } catch (e: any) {
      alert(e.message || "Lỗi tạo bài văn mẫu.");
    }
    setLoading(false);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const str = selection?.toString().trim();
    if (str && str.length > 0 && str.length < 50) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if(rect) {
          onLookup(str, { x: rect.left + rect.width/2, y: rect.top + window.scrollY });
      }
    }
  };

  const handleSaveWriting = () => {
      if(!result) return;
      playSFX('click');
      const newWriting: SavedWriting = {
          id: Date.now().toString(),
          topic: topic || "Tập làm văn",
          type: type,
          mode: mode,
          content: result,
          date: Date.now()
      };
      onSave(newWriting);
  };

  const handleLoadWriting = (w: SavedWriting) => {
      setTopic(w.topic);
      setType(w.type);
      setMode(w.mode);
      setResult(w.content);
      setActiveTab('create');
      playSFX('click');
  };

  return (
    <div className="grid grid-cols-1 gap-6 pb-20">
      {/* ... Tabs and Saved list (No change) ... */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-4">
            <button onClick={() => {setActiveTab('create'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'create' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconPen className="w-5 h-5 mr-2"/> Tập làm văn
            </button>
            <button onClick={() => {setActiveTab('saved'); playSFX('click');}} className={`pb-2 px-4 font-bold text-lg transition border-b-2 flex items-center ${activeTab === 'saved' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-400'}`}>
                <IconNotebook className="w-5 h-5 mr-2"/> Bài văn đã lưu <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">{savedWritings.length}</span>
            </button>
      </div>

      {activeTab === 'saved' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedWritings.length === 0 && <div className="text-gray-400 col-span-2 text-center py-10">Chưa có bài văn nào được lưu.</div>}
              {savedWritings.map((w: SavedWriting) => (
                  <div key={w.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col" onClick={() => handleLoadWriting(w)}>
                      <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg text-brand-700 dark:text-brand-300 line-clamp-1">{w.topic}</h4>
                          <button onClick={(e) => {e.stopPropagation(); onRemove(w.id); playSFX('click');}} className="text-gray-400 hover:text-red-500"><IconTrash className="w-4 h-4"/></button>
                      </div>
                      <div className="flex gap-2 text-xs mb-2">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{w.type}</span>
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">{w.mode === 'outline' ? 'Dàn ý' : w.mode === 'paragraph' ? 'Đoạn văn' : 'Bài văn'}</span>
                      </div>
                      <div className="mt-auto text-xs text-gray-400">{new Date(w.date).toLocaleDateString('vi-VN')}</div>
                  </div>
              ))}
          </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <div className="space-y-6 h-fit">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-brand-100 dark:border-gray-700 transition-colors">
           <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-brand-700 dark:text-brand-400 flex items-center"><IconPen className="mr-2"/> Đề bài & Yêu cầu</h3>
              <span className="text-xs bg-brand-100 dark:bg-gray-700 text-brand-600 dark:text-brand-300 px-2 py-1 rounded font-bold">Lớp {grade}</span>
           </div>

           {/* Type Selection */}
           <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Dạng bài</label>
              <div className="flex flex-wrap gap-2">
                 {writingTypes.map((t, i) => (
                    <button 
                      key={i} 
                      onClick={() => { setType(t); playSFX('click'); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${type === t ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600'}`}
                    >
                      {t}
                    </button>
                 ))}
              </div>
           </div>
           
           {/* Topic Input */}
           <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Đề bài / Nội dung</label>
              <textarea 
                value={topic} onChange={e => setTopic(e.target.value)}
                className={`w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 focus:border-brand-500 outline-none h-32 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${textSizeClass}`}
                placeholder={`Ví dụ: Tả con mèo nhà em...`}
              />
           </div>

           {/* Image Input */}
           <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Ảnh minh họa / Đề bài trong sách</label>
               <div className="relative h-24">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={async (e) => {
                    if(e.target.files?.[0]) {
                      setImg(URL.createObjectURL(e.target.files[0]));
                      setImgB64(await readFileAsBase64(e.target.files[0]));
                      playSFX('click');
                    }
                  }}/>
                  <div className={`w-full h-full border-2 border-dashed rounded-xl flex items-center justify-center transition bg-white dark:bg-gray-900 ${img ? 'border-brand-400' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      {img ? (
                        <div className="flex items-center space-x-4">
                           <img src={img} className="h-20 w-auto object-contain rounded"/>
                           <button onClick={(e)=>{e.preventDefault(); setImg(null);setImgB64(null); playSFX('click');}} className="text-red-500 text-xs font-bold hover:underline z-20 relative">Xóa ảnh</button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                           <IconCamera className="w-6 h-6 text-gray-400 mb-1"/>
                           <span className="text-xs text-gray-400">Tải ảnh đề bài</span>
                        </div>
                      )}
                  </div>
               </div>
           </div>

           {/* Mode Selection */}
           <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Em muốn viết gì?</label>
              <div className="grid grid-cols-3 gap-2">
                 <button 
                   onClick={() => { setMode('outline'); playSFX('click'); }}
                   className={`p-3 rounded-xl border text-center transition ${mode === 'outline' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                 >
                    <div className="text-xs uppercase mb-1">Bước 1</div>
                    Lập dàn ý
                 </button>
                 <button 
                   onClick={() => { setMode('paragraph'); playSFX('click'); }}
                   className={`p-3 rounded-xl border text-center transition ${mode === 'paragraph' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                 >
                    <div className="text-xs uppercase mb-1">Bước 2</div>
                    Đoạn văn
                 </button>
                 <button 
                   onClick={() => { setMode('essay'); playSFX('click'); }}
                   className={`p-3 rounded-xl border text-center transition ${mode === 'essay' ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 font-bold' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                 >
                    <div className="text-xs uppercase mb-1">Bước 3</div>
                    Bài văn
                 </button>
              </div>
           </div>
           
           <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform active:scale-[0.98] flex justify-center items-center">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/> : <IconMagic className="mr-2"/>}
              {mode === 'outline' ? 'Lập Dàn Ý Chi Tiết' : mode === 'paragraph' ? 'Viết Đoạn Văn Mẫu' : 'Viết Bài Văn Hoàn Chỉnh'}
           </button>
        </div>
      </div>

      {/* Output Section */}
      <div className="space-y-6">
         {result ? (
            <div className="bg-paper dark:bg-gray-800 p-8 rounded-2xl shadow-md border-2 border-pink-100 dark:border-gray-700 min-h-[500px] flex flex-col relative animate-fade-in-up transition-colors">
               {/* Paper Lines Decoration */}
               <div className="absolute top-0 left-8 bottom-0 w-px bg-pink-200 dark:bg-gray-700 hidden md:block"></div>
               <div className="absolute top-0 right-8 bottom-0 w-px bg-pink-200 dark:bg-gray-700 hidden md:block"></div>
               
               <div className="md:pl-10 md:pr-10 relative z-10">
                  <div className="flex items-center justify-center mb-6 border-b-2 border-brand-100 dark:border-gray-600 pb-4">
                     <h3 className="font-bold text-xl text-brand-800 dark:text-brand-300 uppercase tracking-widest mr-2">
                        {mode === 'outline' ? 'Dàn Ý Gợi Ý' : mode === 'paragraph' ? 'Đoạn Văn Tham Khảo' : 'Bài Văn Tham Khảo'}
                     </h3>
                     <div className="flex space-x-1">
                        <button 
                          onClick={() => onSpeak(result.outline || result.sampleText || '')}
                          className="p-2 hover:bg-brand-100 dark:hover:bg-gray-700 rounded-full transition-colors text-brand-600 dark:text-brand-300"
                          title="Đọc nội dung"
                        >
                          <IconSpeaker className="w-5 h-5"/>
                        </button>
                        <button 
                          onClick={handleSaveWriting}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors text-red-500"
                          title="Lưu bài văn"
                        >
                          <IconHeart className="w-5 h-5"/>
                        </button>
                     </div>
                  </div>

                  {/* FIX: Removed monospace font, used font-sans for clean look */}
                  {result.outline && mode === 'outline' && (
                     <div 
                       onMouseUp={handleMouseUp}
                       className={`prose ${settings.fontSize === 'large' ? 'prose-xl' : 'prose-lg'} max-w-none text-gray-800 dark:text-gray-200 mb-8 selection:bg-yellow-200 selection:text-black cursor-text font-sans`}
                     >
                        <div className="whitespace-pre-wrap leading-relaxed">{result.outline}</div>
                     </div>
                  )}

                  {/* FIX: Removed font-serif, used default font-sans */}
                  {(mode === 'paragraph' || mode === 'essay') && result.sampleText && (
                     <div 
                       onMouseUp={handleMouseUp}
                       className={`prose ${settings.fontSize === 'large' ? 'prose-xl' : 'prose-lg'} max-w-none text-gray-800 dark:text-gray-200 mb-8 selection:bg-yellow-200 selection:text-black cursor-text font-sans`}
                     >
                        <div className="whitespace-pre-wrap leading-relaxed text-justify">{result.sampleText}</div>
                     </div>
                  )}

                  {result.tips && (
                     <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700 mt-8 relative">
                        <div className="absolute -top-3 -left-2 bg-yellow-400 text-white p-1 rounded-full shadow-sm"><IconStar className="w-4 h-4"/></div>
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-100 mb-2 text-sm uppercase">Lời khuyên của thầy giáo AI:</h4>
                        <p className="text-gray-700 dark:text-gray-300 italic text-sm">{result.tips}</p>
                     </div>
                  )}
               </div>
            </div>
         ) : (
            <div className="h-full bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-8 text-center transition-colors">
               <IconPen className="w-16 h-16 mb-4 opacity-20"/>
               <p className="text-lg font-medium">Kết quả sẽ hiện ở đây.</p>
               <p className="text-sm">Bé hãy chọn dạng bài và nhập đề bài bên cạnh nhé!</p>
            </div>
         )}
      </div>
      </div>
      )}
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('READING');
  const [grade, setGrade] = useState<GradeLevel>(4); // Default Grade 4
  
  // Dictionary State (Global)
  const [defData, setDefData] = useState<DefinitionData | null>(null);
  const [defImg, setDefImg] = useState<string | null>(null);
  const [modalPos, setModalPos] = useState<{x:number, y:number} | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupMode, setLookupMode] = useState(true);
  const [isRealImage, setIsRealImage] = useState(false);
  
  // Client-side Cache
  const definitionCache = useRef<Map<string, DefinitionData>>(new Map());

  // Saved Data States
  const [savedWords, setSavedWords] = useState<DefinitionData[]>(() => {
    try { return JSON.parse(localStorage.getItem('vietnamese_learning_vocab') || '[]'); } catch { return []; }
  });
  const [savedStories, setSavedStories] = useState<SavedStory[]>(() => {
    try { return JSON.parse(localStorage.getItem('vietnamese_learning_stories') || '[]'); } catch { return []; }
  });
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>(() => {
    try { return JSON.parse(localStorage.getItem('vietnamese_learning_quizzes') || '[]'); } catch { return []; }
  });
  const [savedWritings, setSavedWritings] = useState<SavedWriting[]>(() => {
    try { return JSON.parse(localStorage.getItem('vietnamese_learning_writings') || '[]'); } catch { return []; }
  });
  const [savedExtendedReadings, setSavedExtendedReadings] = useState<SavedExtendedReading[]>(() => {
    try { return JSON.parse(localStorage.getItem('vietnamese_learning_extended') || '[]'); } catch { return []; }
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem('vietnamese_learning_vocab', JSON.stringify(savedWords)); }, [savedWords]);
  useEffect(() => { localStorage.setItem('vietnamese_learning_stories', JSON.stringify(savedStories)); }, [savedStories]);
  useEffect(() => { localStorage.setItem('vietnamese_learning_quizzes', JSON.stringify(savedQuizzes)); }, [savedQuizzes]);
  useEffect(() => { localStorage.setItem('vietnamese_learning_writings', JSON.stringify(savedWritings)); }, [savedWritings]);
  useEffect(() => { localStorage.setItem('vietnamese_learning_extended', JSON.stringify(savedExtendedReadings)); }, [savedExtendedReadings]);

  // Handlers for Saving Data
  const handleToggleSaveWord = (wordData: DefinitionData) => {
    setSavedWords(prev => {
      const exists = prev.some(w => w.word.toLowerCase() === wordData.word.toLowerCase());
      if (exists) return prev.filter(w => w.word.toLowerCase() !== wordData.word.toLowerCase());
      return [{ ...wordData, cachedImage: defImg || wordData.cachedImage }, ...prev];
    });
  };
  const handleRemoveWord = (word: string) => setSavedWords(prev => prev.filter(w => w.word !== word));

  const handleSaveStory = (story: SavedStory) => setSavedStories(prev => [story, ...prev]);
  const handleRemoveStory = (id: string) => setSavedStories(prev => prev.filter(s => s.id !== id));

  const handleSaveQuiz = (quiz: SavedQuiz) => setSavedQuizzes(prev => [quiz, ...prev]);
  const handleRemoveQuiz = (id: string) => setSavedQuizzes(prev => prev.filter(q => q.id !== id));

  const handleSaveWriting = (writing: SavedWriting) => setSavedWritings(prev => [writing, ...prev]);
  const handleRemoveWriting = (id: string) => setSavedWritings(prev => prev.filter(w => w.id !== id));

  const handleSaveExtendedReading = (item: SavedExtendedReading) => setSavedExtendedReadings(prev => [item, ...prev]);
  const handleRemoveExtendedReading = (id: string) => setSavedExtendedReadings(prev => prev.filter(w => w.id !== id));

  const handleViewSavedWord = (wordData: DefinitionData) => {
    setDefData(wordData);
    setDefImg(wordData.cachedImage || null);
    setIsRealImage(wordData.cachedImage ? !wordData.cachedImage.startsWith('data:') : false);
    setModalPos(null);
  };

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    fontSize: 'normal' as 'normal' | 'large',
    soundEffects: true,
    bgMusic: false,
    autoExplain: true,
    themeMode: 'light' as 'light' | 'dark' | 'system',
    background: 'bg-brand-50',
    viewMode: 'desktop' as 'desktop' | 'tablet' | 'mobile',
    volume: 1.0,
  });

  // Audio Refs
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const sfxClickRef = useRef<HTMLAudioElement | null>(null);
  const sfxCorrectRef = useRef<HTMLAudioElement | null>(null);
  const sfxWrongRef = useRef<HTMLAudioElement | null>(null);
  const sfxVictoryRef = useRef<HTMLAudioElement | null>(null);
  
  // TTS Audio Context
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Audio
  useEffect(() => {
    bgMusicRef.current = new Audio(AUDIO_URLS.bgMusic);
    bgMusicRef.current.loop = true;
    bgMusicRef.current.volume = 0.3 * settings.volume; // Scaled by global volume
    
    sfxClickRef.current = new Audio(AUDIO_URLS.click);
    sfxCorrectRef.current = new Audio(AUDIO_URLS.correct);
    sfxWrongRef.current = new Audio(AUDIO_URLS.wrong);
    sfxVictoryRef.current = new Audio(AUDIO_URLS.victory);

    return () => {
        bgMusicRef.current?.pause();
    }
  }, []);

  // Update volume dynamically
  useEffect(() => {
     if(bgMusicRef.current) bgMusicRef.current.volume = 0.3 * settings.volume;
  }, [settings.volume]);

  // Handle Music Toggle
  useEffect(() => {
    if (bgMusicRef.current) {
        if (settings.bgMusic) {
            bgMusicRef.current.play().catch(e => console.log("Audio play blocked until interaction"));
        } else {
            bgMusicRef.current.pause();
        }
    }
  }, [settings.bgMusic]);

  // SFX Helper
  const playSFX = useCallback((type: 'click' | 'correct' | 'wrong' | 'victory') => {
      if (!settings.soundEffects) return;
      
      let sound: HTMLAudioElement | null = null;
      switch (type) {
          case 'click': sound = sfxClickRef.current; break;
          case 'correct': sound = sfxCorrectRef.current; break;
          case 'wrong': sound = sfxWrongRef.current; break;
          case 'victory': sound = sfxVictoryRef.current; break;
      }

      if (sound) {
          sound.volume = settings.volume;
          sound.currentTime = 0;
          sound.play().catch(() => {});
      }
  }, [settings.soundEffects, settings.volume]);

  // TTS Handler
  const handleTTS = async (text: string) => {
      if (!text) return;
      playSFX('click');
      try {
          const b64 = await generateSpeech(text, 'Kore', 'Bắc');
          
          if (!ttsAudioCtxRef.current) {
              ttsAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const ctx = ttsAudioCtxRef.current;
          
          if (ctx.state === 'suspended') {
              await ctx.resume();
          }

          const audioData = decodeBase64(b64);
          const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
          
          const gainNode = ctx.createGain();
          gainNode.gain.value = settings.volume;
          gainNode.connect(ctx.destination);

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(gainNode);
          source.start();
      } catch (e) {
          console.error("TTS Error:", e);
      }
  };

  // Handle Theme Change
  useEffect(() => {
    const root = window.document.documentElement;
    const applyDark = settings.themeMode === 'dark' || (settings.themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (applyDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [settings.themeMode]);

  const handleUpdateSettings = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleBatchCache = useCallback(async (text: string) => {
     // Run in background to not block UI
     console.log("Starting batch vocabulary analysis...");
     const vocabList = await analyzeVocabularyContext(text, grade);
     
     if (vocabList && vocabList.length > 0) {
        vocabList.forEach(item => {
           const cacheKey = `${item.word.toLowerCase().trim()}-${grade}`;
           if (!definitionCache.current.has(cacheKey)) {
              definitionCache.current.set(cacheKey, item);
           }
        });
        console.log(`Cached ${vocabList.length} words.`);
     }
  }, [grade]);

  const performImageSearch = async (word: string, cacheKey: string) => {
      // 1. Try to find a real image from Google first (via API)
      console.log(`Searching real image for: ${word}`);
      const realImageUrl = await searchRealImage(word);
      
      if (realImageUrl) {
          console.log("Found real image URL:", realImageUrl);
          setDefImg(realImageUrl);
          setIsRealImage(true);
          const item = definitionCache.current.get(cacheKey);
          if (item) { item.cachedImage = realImageUrl; definitionCache.current.set(cacheKey, item); }
      } else {
          console.log("No real image found, generating AI illustration...");
          // 2. Fallback to AI generation
          const simplePrompt = `Vẽ hình minh họa cho từ "${word}" trong tiếng Việt, phong cách hoạt hình cho trẻ em.`;
          generateIllustration(simplePrompt).then(url => {
              if (url) {
                  setDefImg(url);
                  setIsRealImage(false);
                  const item = definitionCache.current.get(cacheKey);
                  if (item) { item.cachedImage = url; definitionCache.current.set(cacheKey, item); }
              }
          });
      }
  };

  const handleLookup = async (word: string, pos: {x:number, y:number}) => {
    setModalPos(pos);
    setDefData(null);
    setDefImg(null);
    setIsLookupLoading(true);
    setIsRealImage(false);
    playSFX('click');
    
    const cacheKey = `${word.toLowerCase().trim()}-${grade}`;

    // CHECK CACHE FIRST
    if (definitionCache.current.has(cacheKey)) {
        const cachedData = definitionCache.current.get(cacheKey)!;
        setDefData(cachedData);
        playSFX('correct'); // Instant feedback
        setIsLookupLoading(false);
        
        // CHECK IF IMAGE IS ALREADY CACHED
        if (cachedData.cachedImage !== undefined) {
             setDefImg(cachedData.cachedImage);
             setIsRealImage(cachedData.cachedImage ? !cachedData.cachedImage.startsWith('data:') : false);
        } else {
             // Fetch image in background if not in cache
             setDefImg(null); // Clear previous
             performImageSearch(word, cacheKey);
        }
        return;
    }

    try {
      const data = await explainForKids(word, grade);
      setDefData(data);
      // CACHE RESULT (Text only first)
      definitionCache.current.set(cacheKey, data);
      playSFX('correct');
      // Fetch image in background
      performImageSearch(word, cacheKey);
    } catch(e) { /* silent fail */ }
    setIsLookupLoading(false);
  };

  const handleImageError = () => {
    if (isRealImage && defData) {
       console.log("Real image failed to load, falling back to AI...");
       setIsRealImage(false);
       setDefImg(null); 
       const simplePrompt = `Vẽ hình minh họa cho từ "${defData.word}" trong tiếng Việt, phong cách hoạt hình cho trẻ em.`;
       generateIllustration(simplePrompt).then(url => {
           if(url) {
               setDefImg(url);
               const cacheKey = `${defData.word.toLowerCase().trim()}-${grade}`;
               const item = definitionCache.current.get(cacheKey);
               if (item) { item.cachedImage = url; definitionCache.current.set(cacheKey, item); }
           }
       });
    }
  };

  const menuItems = [
    { id: 'READING', icon: IconBook, label: 'Đọc & Giải Nghĩa' },
    { id: 'STORY', icon: IconStar, label: 'Kể Chuyện' },
    { id: 'EXERCISE', icon: IconCheck, label: 'Từ và câu' },
    { id: 'WRITING', icon: IconPen, label: 'Tập Làm Văn' },
    { id: 'EXTENDED_READING', icon: IconGlobe, label: 'Đọc Mở Rộng' },
  ];

  const currentGradeData = CURRICULUM_DATA[grade];
  
  // Logic to determine layout based on View Mode
  const isDesktop = settings.viewMode === 'desktop';
  const isMobileView = settings.viewMode === 'mobile';
  const isTabletView = settings.viewMode === 'tablet';

  const containerClasses = isDesktop 
    ? "w-full h-full" 
    : isTabletView 
        ? "w-[768px] h-[1024px] rounded-[30px] shadow-2xl border-8 border-gray-800 overflow-hidden" 
        : "w-[375px] h-[812px] rounded-[40px] shadow-2xl border-8 border-gray-800 overflow-hidden";

  const wrapperClasses = isDesktop 
    ? "h-screen w-full"
    : "h-screen w-full bg-gray-900 flex items-center justify-center p-4 transition-all duration-500";

  // Force layout based on simulation mode, not just viewport width
  const layoutClasses = (isMobileView || isTabletView) 
     ? "flex-col" // Force column layout for simulated mobile/tablet
     : "md:flex-row flex-col"; // Normal responsive for desktop

  const navClasses = (isMobileView || isTabletView)
     ? "w-full flex-row border-t order-2 py-2" // Bottom nav for simulated mobile
     : "md:w-24 md:flex-col flex-row md:border-r border-t md:border-t-0 md:order-1 order-2"; // Sidebar for desktop

  const navItemClasses = (isMobileView || isTabletView)
     ? "py-2"
     : "md:py-4 p-2";

  return (
    <div className={`${wrapperClasses} font-sans transition-colors duration-300 ${isDesktop ? settings.background : ''}`}>
      <GlobalStyles />
      
      <div className={`${containerClasses} flex flex-col ${isDesktop ? '' : 'bg-white dark:bg-gray-900'} transition-all duration-300 relative`}>
          {/* Main Layout */}
          <div className={`flex flex-1 h-full overflow-hidden ${layoutClasses} ${settings.background} dark:bg-gray-900 transition-colors`}>
            
            {/* Navigation */}
            <nav className={`bg-white dark:bg-gray-800 flex z-50 shadow-sm flex-shrink-0 border-brand-200 dark:border-gray-700 transition-colors ${navClasses}`}>
                <div className={`${(isMobileView || isTabletView) ? 'hidden' : 'hidden md:flex'} flex-col items-center py-6 text-brand-600 dark:text-brand-400`}>
                   <div className="bg-primary-500 text-white p-2 rounded-xl mb-2"><IconAppLogo className="w-8 h-8"/></div>
                </div>
                
                <div className={`flex-1 flex justify-around ${(isMobileView || isTabletView) ? '' : 'md:flex-col md:justify-start md:space-y-4 md:pt-4'}`}>
                   {menuItems.map(item => (
                     <button
                       key={item.id}
                       onClick={() => { setActiveModule(item.id as ModuleType); playSFX('click'); }}
                       className={`flex flex-col items-center justify-center w-full ${(isMobileView || isTabletView) ? 'w-auto' : 'md:w-auto'} transition-colors relative group
                         ${activeModule === item.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-brand-500 dark:hover:text-brand-300'}
                         ${navItemClasses}`}
                     >
                       <item.icon className={`w-6 h-6 ${(isMobileView || isTabletView) ? '' : 'md:w-8 md:h-8'} mb-1 ${activeModule === item.id ? 'fill-current opacity-20' : ''}`}/>
                       <span className="text-[10px] md:text-xs font-bold text-center leading-tight">{item.label}</span>
                       {activeModule === item.id && <div className={`absolute bg-primary-500 ${(isMobileView || isTabletView) ? 'top-0 w-full h-1' : 'top-0 w-full h-1 md:left-0 md:w-1 md:h-full'}`}/>}
                     </button>
                   ))}
                </div>
                
                {/* Settings Button */}
                <div className={`flex justify-center items-center px-2 border-gray-100 dark:border-gray-700 ${(isMobileView || isTabletView) ? 'border-l' : 'md:pb-6 md:pt-2 border-l md:border-l-0 md:border-t md:mt-auto'}`}>
                     <button
                       onClick={() => { setShowSettings(true); playSFX('click'); }}
                       className="flex flex-col items-center justify-center p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                       title="Cài đặt"
                     >
                       <IconSettings className={`w-6 h-6 ${(isMobileView || isTabletView) ? '' : 'md:w-7 md:h-7'} mb-1`}/>
                       <span className={`text-[10px] font-bold text-center leading-tight ${(isMobileView || isTabletView) ? 'hidden' : 'md:block hidden'}`}>Cài đặt</span>
                     </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className={`flex-1 flex flex-col h-full overflow-hidden relative ${(isMobileView || isTabletView) ? 'order-1' : 'order-1 md:order-2'}`}>
                {/* Header */}
                <header className="h-16 bg-white dark:bg-gray-800 border-b border-brand-100 dark:border-gray-700 flex items-center px-4 md:px-6 justify-between flex-shrink-0 transition-colors">
                  <div className="flex items-center overflow-hidden">
                     <h1 className="text-lg md:text-2xl font-bold text-brand-700 dark:text-brand-400 truncate mr-4">
                        {activeModule === 'READING' && '📖 Cùng Em Đọc & Giải Nghĩa'}
                        {activeModule === 'STORY' && '✨ Cùng em kể chuyện'}
                        {activeModule === 'EXERCISE' && '✅ Từ và câu'}
                        {activeModule === 'WRITING' && '📝 Tập Làm Văn'}
                        {activeModule === 'EXTENDED_READING' && '🌍 Đọc Mở Rộng'}
                     </h1>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 ${(isMobileView) ? 'hidden' : 'hidden md:block'}`}>
                      Tác giả: Châu Lê Minh An
                    </span>
                    {/* Grade Selector */}
                    <div className="flex items-center bg-brand-50 dark:bg-gray-700 rounded-lg p-1 border border-brand-100 dark:border-gray-600 flex-shrink-0">
                       <span className={`text-xs font-bold text-brand-700 dark:text-brand-300 px-2 ${(isMobileView) ? 'hidden' : 'hidden sm:block'}`}>Lớp:</span>
                       {[1,2,3,4,5].map(g => (
                          <button 
                            key={g} 
                            onClick={() => { setGrade(g as GradeLevel); playSFX('click'); }}
                            className={`w-8 h-8 rounded-md text-sm font-bold transition flex items-center justify-center ${grade === g ? 'bg-brand-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 hover:text-brand-600 dark:hover:text-white'}`}
                          >
                            {g}
                          </button>
                       ))}
                    </div>
                  </div>
                </header>

                {/* Content Container - FULL SCROLLABLE */}
                <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar scroll-smooth" id="main-scroll-container">
                   {activeModule === 'READING' && (
                      <ReadingModule 
                          onLookup={handleLookup} 
                          isLookupMode={isLookupMode} 
                          setLookupMode={setLookupMode} 
                          grade={grade} 
                          settings={settings} 
                          playSFX={playSFX} 
                          onBatchCache={handleBatchCache}
                          savedWords={savedWords} 
                          onRemoveWord={handleRemoveWord} 
                          onViewWord={handleViewSavedWord}
                      />
                   )}
                   {activeModule === 'STORY' && <StoryModule grade={grade} settings={settings} playSFX={playSFX} onLookup={handleLookup} savedStories={savedStories} onSave={handleSaveStory} onRemove={handleRemoveStory} onLoadStory={() => {}} />}
                   {activeModule === 'EXERCISE' && <QuizModule grade={grade} settings={settings} suggestedTopics={currentGradeData?.quizTopics} playSFX={playSFX} onSpeak={handleTTS} savedQuizzes={savedQuizzes} onSave={handleSaveQuiz} onRemove={handleRemoveQuiz} />}
                   {activeModule === 'WRITING' && <WritingModule grade={grade} settings={settings} writingTypes={currentGradeData?.writingTypes} playSFX={playSFX} onLookup={handleLookup} onSpeak={handleTTS} savedWritings={savedWritings} onSave={handleSaveWriting} onRemove={handleRemoveWriting} />}
                   {activeModule === 'EXTENDED_READING' && <ExtendedReadingModule grade={grade} settings={settings} playSFX={playSFX} onLookup={handleLookup} onSpeak={handleTTS} savedExtendedReadings={savedExtendedReadings} onSave={handleSaveExtendedReading} onRemove={handleRemoveExtendedReading} />}
                </div>
            </main>
          </div>

          {/* Dictionary Modal */}
          {(defData || isLookupLoading) && (
            <DefinitionModal 
              data={defData} 
              imageUrl={defImg}
              isLoading={isLookupLoading} 
              position={modalPos} 
              onClose={() => { setDefData(null); setIsLookupLoading(false); playSFX('click'); }}
              onImageError={handleImageError}
              onSave={handleToggleSaveWord}
              isSaved={defData ? savedWords.some(w => w.word.toLowerCase() === defData.word.toLowerCase()) : false}
              onSpeak={handleTTS}
            />
          )}
          
          {/* Settings Modal */}
          {showSettings && (
            <SettingsModal 
              settings={settings}
              onUpdateSettings={(k, v) => { handleUpdateSettings(k, v); if(k !== 'bgMusic' && k !== 'soundEffects' && k !== 'volume') playSFX('click'); }}
              onClose={() => { setShowSettings(false); playSFX('click'); }}
            />
          )}
      </div>
    </div>
  );
};

export default App;