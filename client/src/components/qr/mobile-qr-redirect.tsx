import { useEffect } from 'react';
import { validateQRData } from "@/lib/crypto-utils";

interface MobileQRRedirectProps {
  onQRDetected?: (employeeId: string) => void;
}

export function MobileQRRedirect({ onQRDetected }: MobileQRRedirectProps) {
  useEffect(() => {
    // Deteksi apakah diakses dari mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (!isMobile) return;

    // Cek URL parameters untuk QR scan result
    const urlParams = new URLSearchParams(window.location.search);
    const qrResult = urlParams.get('qr');
    
    if (qrResult) {
      try {
        const qrData = validateQRData(qrResult);
        if (qrData && qrData.id) {
          // Redirect ke mobile driver view
          window.location.href = `/mobile-driver?nik=${qrData.id}`;
        }
      } catch (error) {
        console.error('Invalid QR format:', error);
      }
    }
  }, []);

  return null; // This is a utility component that doesn't render anything
}