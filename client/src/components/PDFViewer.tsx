import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, X } from 'lucide-react';

interface PDFViewerProps {
  pdfPath: string;
  title?: string;
  trigger?: React.ReactNode;
}

export function PDFViewer({ pdfPath, title = "Preview PDF", trigger }: PDFViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const handleOpenExternal = () => {
    window.open(pdfPath, '_blank', 'noopener,noreferrer');
  };

  const handleIframeError = () => {
    console.error('Error loading PDF in iframe:', pdfPath);
    setLoadError(true);
  };

  const handleIframeLoad = () => {
    // Check if iframe content is blocked by detecting Chrome's block message
    setLoadError(false);
    
    // Small delay to detect if Chrome blocks the content
    setTimeout(() => {
      try {
        const iframe = document.querySelector('[data-testid="pdf-iframe"]') as HTMLIFrameElement;
        if (iframe && iframe.contentDocument) {
          const content = iframe.contentDocument.body?.textContent || '';
          if (content.includes('blocked') || content.includes('This page has been blocked')) {
            setLoadError(true);
          }
        }
      } catch (e) {
        // If we can't access iframe content due to CORS, it might be loaded successfully
        // or blocked - we'll rely on user feedback
      }
    }, 1000);
  };

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center space-x-2"
      data-testid="pdf-viewer-trigger"
    >
      <FileText className="w-4 h-4" />
      <span>Preview PDF</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="flex items-center space-x-1"
                data-testid="pdf-external-link"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-xs">Buka di Tab Baru</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-gray-100">
          {loadError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 p-4">
              <FileText className="w-12 h-12 mb-4 text-gray-400" />
              <p className="text-sm mb-2 text-center">Browser memblokir preview PDF</p>
              <p className="text-xs text-gray-500 mb-4 text-center">
                Chrome mungkin memblokir tampilan PDF dalam preview ini
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Buka di Tab Baru
              </Button>
            </div>
          ) : (
            <iframe
              src={`${pdfPath}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              className="w-full h-full border-0"
              title={title}
              data-testid="pdf-iframe"
              onError={handleIframeError}
              onLoad={handleIframeLoad}
            />
          )}
        </div>
        
        <div className="flex-shrink-0 text-xs text-gray-500 text-center pt-2">
          💡 Tip: Jika PDF tidak tampil, klik "Buka di Tab Baru" atau pastikan browser mendukung preview PDF
        </div>
      </DialogContent>
    </Dialog>
  );
}