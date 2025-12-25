import React, { useEffect, useState } from 'react';
import { DefinitionData } from '../types';
import { IconX } from './Icons';

interface DefinitionModalProps {
  data: DefinitionData | null;
  imageUrl: string | null;
  isLoading: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
  onImageError?: () => void;
}

const DefinitionModal: React.FC<DefinitionModalProps> = ({ data, imageUrl, isLoading, onClose, position, onImageError }) => {
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!data && !isLoading) return null;

  // Desktop positioning logic
  const desktopStyle = position 
    ? { top: Math.min(position.y + 20, window.innerHeight - 300), left: Math.min(position.x, window.innerWidth - 320) } 
    : {};

  return (
    <div 
      className={`fixed z-50 flex ${isMobile ? 'items-end inset-0' : ''}`}
      style={!isMobile && position ? { ...desktopStyle, position: 'absolute' } : {}}
    >
      {/* Mobile Backdrop */}
      {isMobile && (
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>
      )}

      <div 
        className={`
          bg-white dark:bg-gray-800 shadow-2xl border-brand-200 dark:border-gray-700 overflow-hidden 
          ${isMobile ? 'w-full rounded-t-2xl animate-slide-up border-t-2 relative z-10 max-h-[80vh] flex flex-col' : 'rounded-2xl border-2 w-80 animate-fade-in-up'}
        `}
        style={{ animationDuration: '0.3s' }}
      >
        {/* Header */}
        <div className="bg-brand-500 text-white p-3 flex justify-between items-center flex-shrink-0">
          <h3 className="font-bold text-lg capitalize flex items-center">
            {isLoading ? 'Đang tra từ...' : data?.word}
          </h3>
          <button onClick={onClose} className="hover:bg-brand-600 rounded-full p-1 transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable on mobile if content is long */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
               <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
               <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Đang hỏi thầy giáo AI...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Definition */}
              <div>
                <p className="text-gray-700 dark:text-gray-200 text-lg leading-relaxed">
                  <span className="text-2xl mr-2 align-middle">📖</span>
                  {data?.definition}
                </p>
              </div>

              {/* Example */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800">
                <p className="text-yellow-800 dark:text-yellow-100 italic text-base font-medium">
                  " {data?.exampleSentence} "
                </p>
              </div>

              {/* Illustration */}
              <div className="aspect-video w-full rounded-xl bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center relative shadow-inner">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={data?.word} 
                    className="w-full h-full object-cover animate-fade-in" 
                    onError={onImageError}
                  />
                ) : (
                   <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-500 border-t-brand-500 rounded-full animate-spin"></div>
                        <span className="text-xs text-gray-400 dark:text-gray-400">Đang tìm ảnh...</span>
                      </div>
                   </div>
                )}
                {/* Badge */}
                <span className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {imageUrl && imageUrl.startsWith('data:') ? 'AI Generated' : 'Google Image'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* CSS for slide up animation if not using Tailwind plugin */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default DefinitionModal;