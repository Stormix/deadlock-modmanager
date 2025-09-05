import { createContext, useContext, useState, ReactNode } from 'react';

interface ProgressContextType {
  isProcessing: boolean;
  processingStatus: string;
  setProcessing: (isProcessing: boolean, status?: string) => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider = ({ children }: { children: ReactNode }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  const setProcessing = (processing: boolean, status: string = '') => {
    setIsProcessing(processing);
    setProcessingStatus(status);
  };

  return (
    <ProgressContext.Provider value={{ isProcessing, processingStatus, setProcessing }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressIndicator = () => {
  const { isProcessing, processingStatus } = useProgress();

  if (!isProcessing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] rounded-lg bg-background border shadow-xl p-4 min-w-[250px] max-w-[400px]">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{processingStatus}</div>
          <div className="text-xs text-muted-foreground mt-1">Please wait...</div>
        </div>
      </div>
    </div>
  );
};
