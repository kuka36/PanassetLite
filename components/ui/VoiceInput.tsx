
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

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = (e: React.SyntheticEvent) => {
    e.preventDefault(); // Prevent default behavior (like text selection or context menu)
    
    // Check browser support
    if (!('webkitSpeechRecognition' in window)) {
      setError(t('voiceNoSupport'));
      return;
    }

    // Check API Key only if we need AI parsing
    if (mode !== 'CHAT') {
        const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
        if (!apiKey) {
            setError(t('apiKeyMissing'));
            return;
        }
    }

    if (isListening || isProcessing) return;

    setError(null);
    setIsListening(true);

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true; // Keep listening while holding
    recognition.interimResults = true; // We might want to show partials later, but for now just gathering
    recognition.lang = settings.language === 'zh' ? 'zh-CN' : 'en-US';

    // We'll store the final transcript here
    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      // ignore no-speech error which happens if user presses but doesn't speak immediately
      if (event.error !== 'no-speech') {
          console.error("Speech error", event.error);
          setError(t('voiceError'));
      }
      setIsListening(false);
    };
    
    // We handle the 'processing' in stopListening manually using the gathered transcript
    // because recognition.stop() is async and we need to grab the result.
    // However, onresult fires continuously. 
    // The trick with 'continuous=true' is we need to force stop and take what we have.
    
    recognition.start();
  };

  const stopListening = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!recognitionRef.current || !isListening) return;

    // Small delay to ensure last chunk is caught if user speaks fast
    setTimeout(() => {
        recognitionRef.current.stop();
        setIsListening(false);
        
        // Wait for the 'end' event or just process what we have? 
        // The standard API is tricky with manual stops. 
        // A robust way for 'Hold to Talk' is to rely on the onresult accumulating 
        // and then processing the buffer when mouse up happens.
        
        // However, since we can't easily access the internal buffer of the 'recognition' object 
        // from inside this closure without refs, let's rely on the instance 
        // effectively firing 'onresult' before 'onend'.
        
        // Actually, a simpler approach for 'Hold to Talk' with webkitSpeechRecognition:
        // We set continuous=false. If they hold longer, it might cut off? 
        // No, continuous=true is better.
        
        // Let's attach a "final" processor to onend.
        recognitionRef.current.onend = () => {
             // This is slightly hacky because we don't have the transcript text here easily
             // unless we stored it in a ref.
             setIsListening(false);
        };
    }, 150);
  };

  // We need to capture the transcript data to process it *after* stop.
  // We'll use a ref to store the text accumulating during the current session.
  const transcriptBuffer = useRef('');

  const handleStart = (e: React.SyntheticEvent) => {
      e.preventDefault();
      transcriptBuffer.current = ''; // Reset buffer
      
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
      setError(null);

      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.language === 'zh' ? 'zh-CN' : 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            final += event.results[i][0].transcript;
        }
        // Simplified accumulation: just take the latest dump or accumulate?
        // Web Speech API results are tricky. simpler:
        // Just keep updating the buffer with the full current recognition result (mapped)
        const currentText = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
        transcriptBuffer.current = currentText;
      };

      recognition.start();
  };

  const handleStop = (e: React.SyntheticEvent) => {
      e.preventDefault();
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
          
          // Process what we captured
          setTimeout(() => {
              const text = transcriptBuffer.current;
              if (text && text.trim().length > 0) {
                  handleProcessing(text);
              }
          }, 200); // Give a moment for final result events
      }
  };

  const handleProcessing = async (text: string) => {
    if (!text) return;
    
    // For Chat mode, we just return the text immediately
    if (mode === 'CHAT') {
        if (onTextResult) onTextResult(text);
        return;
    }

    // For other modes, we process via AI
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

  return (
    <div className={`relative flex items-center ${className} select-none`}>
        {error && (
            <div className="absolute -top-8 right-0 bg-red-50 text-red-600 text-xs px-2 py-1 rounded border border-red-100 whitespace-nowrap z-10 animate-fade-in">
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
                onMouseDown={handleStart}
                onMouseUp={handleStop}
                onMouseLeave={handleStop}
                onTouchStart={handleStart}
                onTouchEnd={handleStop}
                className={`
                    flex items-center gap-2 transition-all active:scale-95 touch-none select-none
                    ${isListening 
                        ? 'bg-red-500 text-white shadow-md shadow-red-200 ring-2 ring-red-100' 
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                    }
                    ${isListening ? 'px-4 py-2 rounded-full' : 'p-2 rounded-full'}
                `}
                title={t('voiceInput')}
            >
                {isListening ? (
                     <>
                        <MicOff size={16} className="animate-pulse"/> 
                        <span className="text-xs font-bold whitespace-nowrap">
                            {settings.language === 'zh' ? "松开结束" : "Release to Send"}
                        </span>
                     </>
                ) : (
                    <>
                        <Mic size={20} />
                        {/* Only show hint text in CHAT mode if space allows, otherwise just icon */}
                         <span className="sr-only">
                             {settings.language === 'zh' ? "按住说话" : "Hold to Talk"}
                         </span>
                    </>
                )}
            </button>
        )}
        
        {/* Tooltip hint for desktop users who hover */}
        {!isListening && !isProcessing && (
            <div className="absolute left-full ml-2 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity">
                {settings.language === 'zh' ? "按住说话" : "Hold to Talk"}
            </div>
        )}
    </div>
  );
};
