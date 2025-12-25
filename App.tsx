import React, { useState, useRef, useEffect, useCallback } from 'react';
import { extractTextFromImage, explainForKids, generateIllustration } from './services/geminiService';
import { DefinitionData, AppState } from './types';
import { IconCamera, IconTrash, IconSearch, IconRefresh, IconBook } from './components/Icons';
import DefinitionModal from './components/DefinitionModal';

// Helper to file reading
const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const App: React.FC = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [text, setText] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Dictionary / Modal State
  const [definitionData, setDefinitionData] = useState<DefinitionData | null>(null);
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(null);
  const [modalPosition, setModalPosition] = useState<{x: number, y: number} | null>(null);
  const [isDictionaryMode, setIsDictionaryMode] = useState<boolean>(true);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Mobile Tab State (Input vs Read)
  const [mobileTab, setMobileTab] = useState<'input' | 'read'>('input');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // -- Handlers --

  const processFile = async (file: File) => {
    try {
      setAppState(AppState.PROCESSING_OCR);
      setError(null);
      setText('Đang đọc hình ảnh, bé chờ chút nhé...');
      
      // Auto switch to read tab on mobile to show progress
      setMobileTab('read');
      
      const localUrl = URL.createObjectURL(file);
      setImageUrl(localUrl);

      const b64 = await readFileAsBase64(file);
      setImageBase64(b64);

      // Perform OCR
      const extractedText = await extractTextFromImage(b64);
      setText(extractedText);
      setAppState(AppState.READY);

    } catch (err) {
      setError("Không đọc được ảnh. Thử lại nhé!");
      setText('');
      setAppState(AppState.IDLE);
      setMobileTab('input'); // Go back to input on error
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleClear = () => {
    setText('');
    setImageUrl(null);
    setImageBase64(null);
    setAppState(AppState.IDLE);
    setDefinitionData(null);
    setError(null);
    setMobileTab('input');
  };

  const handleRescan = async () => {
    if (!imageBase64) return;
    try {
      setAppState(AppState.PROCESSING_OCR);
      setText('Đang đọc lại hình ảnh...');
      setError(null);
      setMobileTab('read');
      
      const extractedText = await extractTextFromImage(imageBase64);
      setText(extractedText);
      setAppState(AppState.READY);
    } catch (err) {
      setError("Có lỗi khi đọc lại.");
      setAppState(AppState.READY); // Back to ready state even if failed
    }
  };

  const handleTextSelection = useCallback(async () => {
    if (!isDictionaryMode) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    // Validate selection: reasonable length, not just symbols
    if (selectedText.length < 1 || selectedText.length > 50) return;

    // Get position for popup
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Calculate relative to viewport, handling scroll
    const x = rect.left + (rect.width / 2);
    const y = rect.top + window.scrollY;

    // Initial state for popup
    setModalPosition({ x, y });
    setIsLookingUp(true);
    setDefinitionData(null);
    setIllustrationUrl(null);

    try {
      // 1. Get Text Definition
      const defData = await explainForKids(selectedText);
      setDefinitionData(defData);

      // 2. Generate Image (Parallel-ish, but after we have the prompt)
      if (defData.imagePrompt) {
         generateIllustration(defData.imagePrompt).then(url => {
            if (url) setIllustrationUrl(url);
         });
      }

    } catch (err) {
      // Allow user to close manually or auto close? 
      // For now, let's just show an error inside the modal logic if data is null
    } finally {
        setIsLookingUp(false);
    }
    
    // Clear selection visually to avoid confusion or keep it? 
    // Usually better to keep it so user knows what they selected.
  }, [isDictionaryMode]);

  // Handle Global Paste for Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault(); // Stop default paste
            processFile(file);
            return; // Only process the first image found
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Attach mouseup event for selection
  useEffect(() => {
    const el = textDisplayRef.current;
    if (!el) return;

    el.addEventListener('mouseup', handleTextSelection);
    // Touch end for mobile? Mobile selection is tricky, usually handled by OS context menu.
    // We can try `touchend` but `getSelection` behavior varies. 
    // A separate "Lookup" button might be better for mobile, but let's stick to mouseup/touchend simulation.
    
    return () => {
      el.removeEventListener('mouseup', handleTextSelection);
    };
  }, [handleTextSelection]);


  return (
    <div className="min-h-screen bg-brand-50 flex flex-col font-sans text-slate-800">
      
      {/* 1. Header */}
      <header className="bg-white shadow-sm border-b border-brand-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="bg-brand-500 p-2 rounded-lg text-white flex-shrink-0">
               <IconBook className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-brand-600 tracking-tight truncate">CÙNG EM GIẢI NGHĨA TỪ</h1>
          </div>
          
          {/* Main Controls - Top Right */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button 
              onClick={() => setIsDictionaryMode(!isDictionaryMode)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                isDictionaryMode 
                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <IconSearch className="w-4 h-4" />
              <span className="hidden sm:inline">Tra từ {isDictionaryMode ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
              <span className="inline sm:hidden">{isDictionaryMode ? 'BẬT' : 'TẮT'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation (Visible only on lg screens and below) */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-16 z-30 flex shadow-sm">
        <button 
          onClick={() => setMobileTab('input')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors relative ${
            mobileTab === 'input' 
              ? 'text-brand-600' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <IconCamera className="w-4 h-4" /> <span>Nhập liệu</span>
          {mobileTab === 'input' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500"></div>}
        </button>
        <button 
          onClick={() => setMobileTab('read')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center space-x-2 transition-colors relative ${
            mobileTab === 'read' 
              ? 'text-brand-600' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <IconBook className="w-4 h-4" /> <span>Đọc bài</span>
          {mobileTab === 'read' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500"></div>}
        </button>
      </div>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 lg:p-6 gap-6 grid grid-cols-1 lg:grid-cols-2">
        
        {/* Left Column: Input Source */}
        {/* Hidden on mobile if tab is not 'input', always visible on lg */}
        <section className={`flex flex-col space-y-4 ${mobileTab === 'input' ? 'flex' : 'hidden'} lg:flex`}>
          
          <div className="bg-white rounded-2xl shadow-sm border-2 border-brand-100 p-4 flex-1 flex flex-col min-h-[300px] lg:min-h-[400px]">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center">
              <span className="bg-brand-100 text-brand-600 px-2 py-1 rounded text-sm mr-2 hidden sm:inline">Bước 1</span>
              Hình ảnh / Văn bản
            </h2>

            {/* Upload Area */}
            {!imageUrl ? (
               <div 
                 className="flex-1 border-3 border-dashed border-brand-200 rounded-xl bg-brand-50 hover:bg-brand-100 transition-colors cursor-pointer flex flex-col items-center justify-center p-6 sm:p-8 text-center group"
                 onClick={() => fileInputRef.current?.click()}
               >
                 <div className="bg-white p-4 rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform">
                    <IconCamera className="w-8 h-8 sm:w-10 sm:h-10 text-brand-500" />
                 </div>
                 <p className="text-brand-700 font-semibold text-lg">Chụp / Tải ảnh</p>
                 <p className="text-brand-400 text-sm mt-1">hoặc dán ảnh (Ctrl+V)</p>
                 <input 
                   type="file" 
                   accept="image/png, image/jpeg" 
                   className="hidden" 
                   ref={fileInputRef}
                   onChange={handleFileUpload}
                 />
               </div>
            ) : (
              <div className="relative flex-1 bg-black/5 rounded-xl overflow-hidden group min-h-[200px]">
                <img src={imageUrl} alt="Source" className="w-full h-full object-contain" />
                {/* Overlay controls */}
                <div className="absolute top-2 right-2 flex space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={handleRescan}
                     className="bg-white/90 p-2 rounded-lg text-brand-600 hover:text-brand-700 shadow-sm"
                     title="Quét lại"
                   >
                     <IconRefresh />
                   </button>
                   <button 
                     onClick={() => {
                        setImageUrl(null);
                        setImageBase64(null);
                        setAppState(AppState.IDLE);
                     }}
                     className="bg-white/90 p-2 rounded-lg text-red-500 hover:text-red-600 shadow-sm"
                     title="Xóa ảnh"
                   >
                     <IconTrash />
                   </button>
                </div>
              </div>
            )}

            {/* Manual Input Fallback */}
            <div className="mt-4 pt-4 border-t border-gray-100">
               <textarea
                 className="w-full p-3 rounded-lg border border-gray-200 focus:border-brand-400 focus:ring focus:ring-brand-200 outline-none transition-all text-sm resize-none h-24"
                 placeholder="Hoặc dán văn bản vào đây..."
                 value={text}
                 onChange={(e) => {
                    setText(e.target.value);
                    if(e.target.value) {
                      setAppState(AppState.READY);
                    }
                 }}
               ></textarea>
            </div>
          </div>
        </section>

        {/* Right Column: Interactive Text */}
        {/* Hidden on mobile if tab is not 'read', always visible on lg */}
        <section className={`flex flex-col space-y-4 ${mobileTab === 'read' ? 'flex' : 'hidden'} lg:flex`}>
           <div className="bg-paper rounded-2xl shadow-sm border-2 border-amber-100 p-4 sm:p-6 flex-1 flex flex-col relative min-h-[400px]">
             
             <div className="flex justify-between items-start mb-4">
               <h2 className="text-lg font-bold text-slate-700 flex items-center">
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-sm mr-2 hidden sm:inline">Bước 2</span>
                 Đọc & Tra từ
               </h2>
               {text && (
                 <button 
                   onClick={handleClear}
                   className="text-gray-400 hover:text-red-500 transition-colors text-sm font-medium flex items-center"
                 >
                   <IconTrash className="w-4 h-4 mr-1"/> <span className="hidden sm:inline">Xóa hết</span>
                 </button>
               )}
             </div>

             {/* Main Text Display */}
             <div 
               ref={textDisplayRef}
               className={`
                 flex-1 prose prose-lg max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap
                 ${isDictionaryMode ? 'cursor-help selection:bg-yellow-200 selection:text-black' : 'cursor-text'}
               `}
               style={{ 
                 fontSize: '1.25rem', 
                 lineHeight: '2',
                 fontFamily: '"Quicksand", sans-serif'
               }}
             >
               {appState === AppState.PROCESSING_OCR ? (
                 <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="text-brand-600 font-medium animate-pulse text-center px-4">Đang đọc chữ trong ảnh...<br/><span className="text-xs text-gray-400 font-normal">Sẽ tự chuyển sang chế độ đọc khi xong</span></p>
                 </div>
               ) : (
                  text || <span className="text-gray-400 italic">
                    {mobileTab === 'read' ? 'Chưa có nội dung. Hãy qua tab "Nhập liệu" để thêm ảnh hoặc văn bản nhé!' : 'Văn bản sẽ hiện ra ở đây. Hãy chọn một từ để xem nghĩa nhé!'}
                  </span>
               )}
             </div>
             
             {error && (
               <div className="absolute bottom-4 left-4 right-4 bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-sm text-center">
                 {error}
               </div>
             )}

           </div>
        </section>
      </main>

      {/* Definition Popup Modal */}
      {(definitionData || isLookingUp) && (
        <DefinitionModal 
          data={definitionData} 
          imageUrl={illustrationUrl}
          isLoading={isLookingUp}
          position={modalPosition}
          onClose={() => {
            setDefinitionData(null);
            setIsLookingUp(false);
          }}
        />
      )}

      {/* Footer Instructions */}
      <footer className="bg-white py-6 border-t border-brand-100 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center">
           <p className="text-gray-500 text-sm">
             Bôi đen từ bất kỳ để xem hình ảnh minh họa! 🎨
           </p>
           <p className="text-gray-400 text-xs mt-2">
             Powered by Google Gemini
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;