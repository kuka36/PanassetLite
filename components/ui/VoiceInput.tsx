import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { parseVoiceCommand } from '../../services/geminiService';
import { VoiceParseResult } from '../../types';

interface VoiceInputProps {
  onResult?: (data: VoiceParseResult) => void;
  onTextResult?: (text: string) => void;
  mode: 'ASSET' | 'TRANSACTION' | 'CHAT';
  className?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onResult, onTextResult, mode, className = "" }) => {
  const { settings, assets, t } = usePortfolio();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const transcriptBuffer = useRef('');

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleProcessing = async (text: string) => {
    if (!text || !text.trim()) return;
    
    if (mode === 'CHAT') {
        if (onTextResult) onTextResult(text);
        return;
    }

    setIsProcessing(true);
    const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
    
    try {
      const context = assets.map(a => ({ symbol: a.symbol, name: a.name, id: a.id }));
      const result = await parseVoiceCommand(text, mode, apiKey, settings.aiProvider, context);
      if (result && onResult) {
        onResult(result);
      }
    } catch (err) {
      console.error(err);
      setError(t('voiceError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
        try {
            recognitionRef.current.stop();
        } catch (e) {
            // Ignore error if already stopped
        }
        setIsListening(false);
        
        // Short delay to ensure final results are captured from the recognition buffer
        setTimeout(() => {
            const text = transcriptBuffer.current;
            if (text && text.trim().length > 0) {
                handleProcessing(text);
            }
        }, 250); 
    }
  };

  const handleStart = (e: React.SyntheticEvent) => {
      // Critical: Stop propagation to prevent interference with underlying page
      e.preventDefault();
      e.stopPropagation();

      // Reset
      transcriptBuffer.current = ''; 
      setError(null);
      
      if (!('webkitSpeechRecognition' in window)) {
        setError(t('voiceNoSupport'));
        return;
      }

      if (mode !== 'CHAT') {
        const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
        if (!apiKey) {
            setError(t('apiKeyMissing'));
            return;
        }
      }

      setIsListening(true);

      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.language === 'zh' ? 'zh-CN' : 'en-US';

      recognition.onresult = (event: any) => {
        const currentText = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
        transcriptBuffer.current = currentText;
      };

      recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
              console.error("Speech error", event.error);
              setError(t('voiceError'));
          }
          // Only stop UI state on critical errors, ignore 'no-speech' during hold as it might just mean silence
          if (event.error !== 'no-speech') {
             setIsListening(false);
          }
      };

      try {
        recognition.start();
      } catch (err) {
        console.error("Failed to start recognition", err);
        setIsListening(false);
      }
  };

  const handleStop = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isListening) {
          stopRecognition();
      }
  };

  const handleContextMenu = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isListening) stopRecognition();
  };

  // Block clicks to ensure no ghost clicks propagate
  const handleClick = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  return (
    <div 
        className={`relative flex items-center ${className} select-none`}
        onClick={(e) => e.stopPropagation()} // Extra safety for container
    >
        {error && (
            <div className="absolute -top-8 right-0 bg-red-50 text-red-600 text-xs px-2 py-1 rounded border border-red-100 whitespace-nowrap z-10 animate-fade-in shadow-sm pointer-events-none">
                {error}
            </div>
        )}
        
        {isProcessing ? (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium border border-blue-100 animate-pulse">
                <Loader2 size={14} className="animate-spin"/>
                {t('processing')}
             </div>
        ) : (
            <button 
                type="button"
                // Mouse Events
                onMouseDown={handleStart}
                onMouseUp={handleStop}
                onMouseLeave={handleStop}
                // Touch Events
                onTouchStart={handleStart}
                onTouchEnd={handleStop}
                onTouchCancel={handleStop}
                // Misc
                onContextMenu={handleContextMenu}
                onClick={handleClick}
                
                className={`
                    flex items-center gap-2 transition-all active:scale-95 touch-none select-none
                    ${isListening 
                        ? 'bg-red-500 text-white shadow-md shadow-red-200 ring-4 ring-red-100 scale-105' 
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                    }
                    ${isListening ? 'px-4 py-2 rounded-full' : 'p-2 rounded-full'}
                `}
                style={{ 
                    WebkitTouchCallout: 'none', 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none' 
                }}
                title={t('voiceInput')}
            >
                {isListening ? (
                     <>
                        <MicOff size={16} className="animate-pulse"/> 
                        <span className="text-xs font-bold whitespace-nowrap pointer-events-none">
                            {settings.language === 'zh' ? "松开结束" : "Release to Send"}
                        </span>
                     </>
                ) : (
                    <>
                        <Mic size={20} />
                         <span className="sr-only">
                             {settings.language === 'zh' ? "按住说话" : "Hold to Talk"}
                         </span>
                    </>
                )}
            </button>
        )}
    </div>
  );
};