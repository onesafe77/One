import { useEffect, useRef, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

export interface AutoSaveOptions {
  key: string;
  form: UseFormReturn<any>;
  delay?: number; // Auto save delay in milliseconds
  exclude?: string[]; // Fields to exclude from auto save
}

export function useAutoSave({ key, form, delay = 2000, exclude = [] }: AutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isRestoringRef = useRef(false);

  // Save draft to localStorage
  const saveDraft = () => {
    if (isRestoringRef.current) return;
    
    const values = form.getValues();
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([fieldKey]) => !exclude.includes(fieldKey))
    );
    
    localStorage.setItem(`draft_${key}`, JSON.stringify({
      data: filteredValues,
      timestamp: Date.now()
    }));
    
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1000);
  };

  // Load draft from localStorage
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(`draft_${key}`);
      if (!saved) return null;
      
      const { data, timestamp } = JSON.parse(saved);
      
      // Only restore if draft is less than 24 hours old
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - timestamp > maxAge) {
        clearDraft();
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  };

  // Clear draft from localStorage
  const clearDraft = () => {
    localStorage.removeItem(`draft_${key}`);
    setSaveStatus('idle');
  };

  // Restore draft on component mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      isRestoringRef.current = true;
      form.reset(draft);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }
  }, []);

  // Auto save on form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      if (isRestoringRef.current) return;
      
      setSaveStatus('saving');
      
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout for auto save
      timeoutRef.current = setTimeout(saveDraft, delay);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  // Check if draft exists
  const hasDraft = () => {
    const saved = localStorage.getItem(`draft_${key}`);
    return !!saved;
  };

  return {
    saveStatus,
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft
  };
}