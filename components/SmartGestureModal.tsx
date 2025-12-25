import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { IconX, IconCamera, IconCheck } from './Icons';
import { QuizQuestion } from '../types';

interface SmartGestureModalProps {
  questions: QuizQuestion[];
  onClose: () => void;
  playSFX?: (type: 'click' | 'correct' | 'wrong' | 'victory') => void;
}

const SmartGestureModal: React.FC<SmartGestureModalProps> = ({ questions, onClose, playSFX }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [gestureCount, setGestureCount] = useState<number>(0);
  const [detectedFingerCount, setDetectedFingerCount] = useState<number>(0);
  
  // Debounce logic
  const lastGestureTime = useRef<number>(0);
  const stableGestureCount = useRef<number>(0);
  const currentStableGesture = useRef<number>(0);

  const question = questions[currentQIndex];

  // Initialize MediaPipe
  useEffect(() => {
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setHandLandmarker(landmarker);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing hand landmarker:", error);
        setLoading(false);
        alert("Không thể khởi động nhận diện cử chỉ. Vui lòng thử lại sau.");
        onClose();
      }
    };
    init();
  }, []);

  // Camera stream & Detection Loop
  useEffect(() => {
    if (!handLandmarker || !videoRef.current) return;

    let animationFrameId: number;
    const video = videoRef.current;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
      } catch (err) {
        console.error("Camera error:", err);
        alert("Cần quyền truy cập camera để sử dụng tính năng này.");
      }
    };

    const predictWebcam = async () => {
      if (!handLandmarker || !video || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if(!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (video.currentTime > 0) {
        const results = handLandmarker.detectForVideo(video, performance.now());
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let fingers = 0;

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // Draw simple points
          ctx.fillStyle = "#0ea5e9";
          for (const point of landmarks) {
            ctx.beginPath();
            ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, 2 * Math.PI);
            ctx.fill();
          }

          // Robust Finger Counting using Distance from Wrist (0)
          // A finger is extended if the Tip is significantly further from the Wrist than the PIP joint.
          const isFingerExtended = (tipIdx: number, pipIdx: number) => {
              const wrist = landmarks[0];
              const tip = landmarks[tipIdx];
              const pip = landmarks[pipIdx];
              
              const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
              const distPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
              
              // Threshold: Tip must be at least 10% further than PIP to be considered "extended/straight"
              return distTip > distPip * 1.1;
          };

          // Thumb (4) vs IP (3). Thumb is special.
          // For vertical hand: Check if Tip Y is above IP Y.
          // For general extension: Check if Tip is far from Pinky MCP (17) (Open palm).
          // We combine Y check (for vertical) OR distance check (for spread).
          // Simple & effective for "kids raising hand": Tip Y < IP Y (Note: Y increases downwards)
          if (landmarks[4].y < landmarks[3].y) fingers++;

          // Index (8 vs 6)
          if (isFingerExtended(8, 6)) fingers++;
          // Middle (12 vs 10)
          if (isFingerExtended(12, 10)) fingers++;
          // Ring (16 vs 14)
          if (isFingerExtended(16, 14)) fingers++;
          // Pinky (20 vs 18)
          if (isFingerExtended(20, 18)) fingers++;
          
          // Debug text on canvas
          ctx.fillStyle = "white";
          ctx.font = "bold 30px Quicksand";
          ctx.shadowColor="black";
          ctx.shadowBlur=4;
          ctx.fillText(`Ngón tay: ${fingers}`, 20, 50);
        }
        
        setDetectedFingerCount(fingers);
        handleStableGesture(fingers);
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    startCamera();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [handLandmarker]);

  // Logic to stabilize gesture input (Debounce)
  const handleStableGesture = (count: number) => {
    const now = Date.now();
    
    if (count === currentStableGesture.current) {
      stableGestureCount.current++;
    } else {
      stableGestureCount.current = 0;
      currentStableGesture.current = count;
    }

    // Require ~20 frames (approx 0.7s) of stable gesture to trigger action
    if (stableGestureCount.current > 20 && (now - lastGestureTime.current > 1500)) {
        if (count >= 1 && count <= 5) {
            triggerAction(count);
            lastGestureTime.current = now;
            stableGestureCount.current = 0; // Reset to force re-hold
        }
    }
  };

  const triggerAction = (fingers: number) => {
    setGestureCount(fingers);
    
    // Logic: 1->A, 2->B, 3->C, 4->D
    if (fingers >= 1 && fingers <= 4) {
      // Cannot change answer if already submitted
      if (!isSubmitted) {
        setSelectedOption(fingers - 1); // 0, 1, 2, 3
        playSFX?.('click');
      }
    } 
    // Logic: 5 -> Check / Next
    else if (fingers === 5) {
      handleSubmitNextAction();
    }
  };

  useEffect(() => {
     if (gestureCount === 0) return;

     // Reset gesture display after a delay
     const timer = setTimeout(() => setGestureCount(0), 2000);
     return () => clearTimeout(timer);
  }, [gestureCount]);

  const handleSubmitNextAction = () => {
     setIsSubmitted(prev => {
        if (!prev) {
           // If not submitted -> Submit
           // Check if correct immediately for sound
           if (selectedOption === question.correctAnswer) {
              playSFX?.('correct');
           } else {
              playSFX?.('wrong');
           }
           return true; 
        } else {
           // If already submitted -> Next Question
           setTimeout(() => {
              setCurrentQIndex(current => {
                 if (current < questions.length - 1) {
                    setIsSubmitted(false);
                    setSelectedOption(null);
                    playSFX?.('click');
                    return current + 1;
                 } else {
                    alert("Chúc mừng! Bạn đã hoàn thành bài tập.");
                    playSFX?.('victory');
                    onClose();
                    return current;
                 }
              });
           }, 500); // Small delay to prevent double trigger
           return prev;
        }
     });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-3xl overflow-hidden flex flex-col md:flex-row relative">
         <button 
            onClick={onClose} 
            className="absolute top-4 right-4 z-50 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full backdrop-blur-md shadow-lg flex items-center font-bold transition-transform transform hover:scale-105 border-2 border-white/20"
         >
            <IconX className="w-5 h-5 mr-2"/>
            Thoát
         </button>

         {/* Left Side: Camera */}
         <div className="w-full md:w-1/2 bg-black relative flex items-center justify-center overflow-hidden">
            {loading && <div className="text-white flex flex-col items-center"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"/>Đang khởi động camera AI...</div>}
            
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover mirror-mode" autoPlay playsInline muted></video>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover mirror-mode opacity-70"></canvas>
            
            {/* Gesture Feedback Overlay */}
            <div className="absolute bottom-6 left-6 right-6 bg-black/60 backdrop-blur text-white p-4 rounded-2xl border border-white/10">
               <p className="text-sm font-bold opacity-70 uppercase tracking-wider mb-1">Trạng thái nhận diện</p>
               <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                     <span className="text-4xl font-bold text-primary-400 mr-2">{detectedFingerCount}</span>
                     <span className="text-sm">Ngón tay</span>
                  </div>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div className="flex-1">
                     {gestureCount > 0 && (
                        <div className="animate-bounce-slow font-bold text-green-400 flex items-center">
                           <IconCheck className="w-5 h-5 mr-1"/>
                           {gestureCount === 5 
                              ? (isSubmitted ? "Đã chuyển câu!" : "Đã kiểm tra!") 
                              : `Đã chọn đáp án ${String.fromCharCode(64 + gestureCount)}`
                           }
                        </div>
                     )}
                     {gestureCount === 0 && <span className="text-gray-400 italic text-sm">Giữ yên tay khoảng 2 giây để chọn...</span>}
                  </div>
               </div>
            </div>
         </div>

         {/* Right Side: Question */}
         <div className="w-full md:w-1/2 bg-white dark:bg-gray-800 p-8 flex flex-col relative">
            <div className="flex justify-between items-center mb-6">
                <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-bold">Câu {currentQIndex + 1}/{questions.length}</span>
                <div className="flex flex-col space-y-1">
                   <div className="text-xs font-bold text-gray-500 uppercase">Hướng dẫn:</div>
                   <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                     <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><span className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center mr-1 text-[10px] text-black">1</span>A</span>
                     <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><span className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center mr-1 text-[10px] text-black">2</span>B</span>
                     <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><span className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center mr-1 text-[10px] text-black">3</span>C</span>
                     <span className="flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"><span className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center mr-1 text-[10px] text-black">4</span>D</span>
                     <span className="flex items-center bg-primary-100 text-primary-700 px-2 py-1 rounded"><span className="w-4 h-4 bg-primary-500 text-white rounded-full flex items-center justify-center mr-1 text-[10px]">5</span>Nộp/Tiếp</span>
                   </div>
                </div>
            </div>

            {question ? (
               <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 leading-relaxed">{question.question}</h3>
                  <div className="space-y-4">
                     {question.options.map((opt, idx) => {
                        const isSelected = selectedOption === idx;
                        const isCorrect = question.correctAnswer === idx;
                        
                        let className = "w-full p-4 rounded-2xl border-2 text-left text-lg font-medium transition-all transform ";
                        
                        if (isSubmitted) {
                           if (isCorrect) className += "bg-green-100 border-green-500 text-green-800 scale-105";
                           else if (isSelected) className += "bg-red-100 border-red-500 text-red-800 opacity-80";
                           else className += "bg-gray-50 border-gray-100 opacity-50";
                        } else {
                           if (isSelected) className += "bg-primary-50 border-primary-500 text-primary-800 scale-105 shadow-md";
                           else className += "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-200";
                        }

                        return (
                           <div key={idx} className={className}>
                              <span className="inline-block w-8 font-bold opacity-50">{String.fromCharCode(65 + idx)}.</span>
                              {opt}
                              {isSubmitted && isCorrect && <IconCheck className="inline-block ml-2 text-green-600"/>}
                           </div>
                        );
                     })}
                  </div>
                  
                  {isSubmitted && (
                     <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 rounded-xl animate-fade-in-up">
                        <p className="font-bold mb-1">💡 Giải thích:</p>
                        <p>{question.explanation}</p>
                     </div>
                  )}
               </div>
            ) : (
               <div className="text-center text-gray-500">Đã hết câu hỏi.</div>
            )}
            
            <div className="mt-6 text-center text-gray-400 text-sm italic">
               "Duỗi thẳng 1 ngón tay để chọn A, 2 ngón chọn B..."
            </div>
         </div>
      </div>
      <style>{`
         .mirror-mode {
            transform: scaleX(-1);
         }
      `}</style>
    </div>
  );
};

export default SmartGestureModal;