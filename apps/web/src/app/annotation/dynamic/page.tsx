'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { AnnotationRenderer } from '@/components/AnnotationRenderer';

export default function DynamicAnnotationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [initialDraft, setInitialDraft] = useState<Record<string, any>>({});

  const handleDraftSave = async (values: Record<string, any>) => {
    console.log('Auto-saving draft:', values);
  };

  const handleSubmit = async (values: Record<string, any>) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Submitted annotation:', values);
    setIsLoading(false);
  };

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">动态标注页</h1>
        <div className="p-4 bg-gray-50 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">原始待标注数据</h3>
          <p className="text-gray-700">这款手机续航真的太差了，用半天就没电了。</p>
        </div>
        <AnnotationRenderer 
          initialValues={initialDraft}
          onSubmit={handleSubmit}
          onDraftSave={handleDraftSave}
        />
      </div>
    </AppShell>
  );
}
