
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, StopCircle } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { parseVoiceCommand } from '../../services/geminiService';
import { VoiceParseResult } from '../../types';

interface VoiceInputProps {
  onResult: (data: VoiceParseResult) => void;
  mode: 'ASSET' | 'TRANSACTION';
  className?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onResult, mode, className = "" }) => {
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

  const startListening = () => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window)) {
      setError(t('voiceNoSupport'));
      return;
    }

    // Check API Key
    const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
    if (!apiKey) {
      setError(t('apiKeyMissing'));
      return;
    }

    setError(null);
    setIsListening(true);

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    // Set language based on App Settings
    recognition.lang = settings.language === 'zh' ? 'zh-CN' : 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      recognition.stop();
      setIsListening(false);
      handleProcessing(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error", event.error);
      setIsListening(false);
      setError(t('voiceError'));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleProcessing = async (text: string) => {
    if (!text) return;
    
    setIsProcessing(true);
    const apiKey = settings.aiProvider === 'deepseek' ? settings.deepSeekApiKey : settings.geminiApiKey;
    
    try {
      // Prepare minimal context for AI (Symbol + Name + ID)
      const context = assets.map(a => ({ symbol: a.symbol, name: a.name, id: a.id }));
      
      const result = await parseVoiceCommand(text, mode, apiKey, settings.aiProvider, context);
      
      if (result) {
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
    <div className={`relative flex items-center ${className}`}>
        {error && (
            <div className="absolute top-10 right-0 bg-red-50 text-red-600 text-xs px-2 py-1 rounded border border-red-100 whitespace-nowrap z-10 animate-fade-in">
                {error}
            </div>
        )}
        
        {isProcessing ? (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium border border-blue-100 animate-pulse">
                <Loader2 size={14} className="animate-spin"/>
                {t('processing')}
             </div>
        ) : isListening ? (
             <button 
                onClick={stopListening}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-medium border border-red-100 hover:bg-red-100 transition-colors animate-pulse"
             >
                <StopCircle size={14} />
                {t('listening')}
             </button>
        ) : (
            <button 
                type="button"
                onClick={startListening}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                title={t('voiceInput')}
            >
                <Mic size={20} />
            </button>
        )}
    </div>
  );
};
