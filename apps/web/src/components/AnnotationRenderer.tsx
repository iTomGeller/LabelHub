'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { tokens } from '@/lib/tokens';

interface AnnotationRendererProps {
  schema?: any;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onDraftSave?: (values: Record<string, any>) => Promise<void>;
}

export const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  onDraftSave
}) => {
  const [formValues, setFormValues] = useState<Record<string, any>>(initialValues);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const formValuesRef = useRef(formValues);
  const isSavingRef = useRef(isSaving);
  
  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);
  
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const goNext = useCallback(() => {
    setCurrentStep(currentStep + 1);
  }, [currentStep]);
  
  const saveDraft = useCallback(async () => {
    if (onDraftSave && !isSavingRef.current) {
      setIsSaving(true);
      await onDraftSave(formValuesRef.current);
      setLastSavedAt(new Date());
      setIsSaving(false);
    }
  }, [onDraftSave]);

  useEffect(() => {
    const autoSaveInterval = setInterval(saveDraft, 30000);
    return () => clearInterval(autoSaveInterval);
  }, [saveDraft]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await saveDraft();
      }
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        goNext();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        await onSubmit(formValuesRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDraft, goPrev, goNext, onSubmit]);

  const handleChange = (key: string, value: any) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    await onSubmit(formValues);
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: tokens.colorPrimary }}>
          标注表单
        </h2>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {isSaving && <span>保存中...</span>}
          {lastSavedAt && <span>上次保存: {lastSavedAt.toLocaleTimeString()}</span>}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block mb-2 font-medium">情感倾向 *</label>
          <div className="flex gap-4">
            {['正面', '负面', '中性'].map(opt => (
              <label key={opt} className="cursor-pointer">
                <input 
                  type="radio" 
                  checked={formValues.sentiment === opt}
                  onChange={(e) => handleChange('sentiment', opt)}
                  className="mr-1" 
                /> {opt}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block mb-2 font-medium">置信度 (0-1) *</label>
          <input 
            type="number" 
            step="0.1" 
            min="0" 
            max="1" 
            value={formValues.confidence ?? ''}
            onChange={(e) => handleChange('confidence', parseFloat(e.target.value))}
            className="w-full p-2 border rounded-md" 
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">备注</label>
          <textarea 
            value={formValues.comment ?? ''}
            onChange={(e) => handleChange('comment', e.target.value)}
            rows={3} 
            className="w-full p-2 border rounded-md" 
          />
        </div>
      </div>
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          上一题 (Alt + ←)
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 text-white rounded-md"
          style={{ backgroundColor: tokens.colorPrimary }}
        >
          提交标注 (Ctrl + Enter)
        </button>
        <button
          onClick={goNext}
          className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          下一题 (Alt + →)
        </button>
      </div>
    </div>
  );
};
