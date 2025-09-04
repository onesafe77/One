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

  const handleOpenExternal = () => {
    window.open(pdfPath, '_blank', 'noopener,noreferrer');
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
          <iframe
            src={`${pdfPath}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
            className="w-full h-full border-0"
            title={title}
            data-testid="pdf-iframe"
            onError={() => {
              console.error('Error loading PDF in iframe');
            }}
          />
        </div>
        
        <div className="flex-shrink-0 text-xs text-gray-500 text-center pt-2">
          💡 Tip: Jika PDF tidak tampil, klik "Buka di Tab Baru" atau pastikan browser mendukung preview PDF
        </div>
      </DialogContent>
    </Dialog>
  );
}