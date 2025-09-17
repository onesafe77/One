export const SECRET_KEY = 'AttendanceQR2024';

export function generateToken(employeeId: string): string {
  const timestamp = Date.now();
  const tokenData = `${employeeId}${SECRET_KEY}${timestamp}`;
  return btoa(tokenData).slice(0, 16);
}

export function validateQRData(qrDataString: string): { id: string; token: string } | null {
  if (!qrDataString || qrDataString.trim() === '') {
    return null;
  }
  
  try {
    // First, try direct JSON parsing (backward compatibility)
    const qrData = JSON.parse(qrDataString);
    if (qrData.id && qrData.token) {
      return { id: qrData.id, token: qrData.token };
    }
    return null;
  } catch {
    // If direct JSON parsing fails, try to extract from URL format
    try {
      // Check for direct mobile-driver URL format (both workspace and legacy)
      if (qrDataString.includes('/mobile-driver?nik=') || qrDataString.includes('/workspace/mobile-driver?nik=')) {
        const nikMatch = qrDataString.match(/[?&]nik=([^&]+)/);
        if (nikMatch && nikMatch[1]) {
          const nik = decodeURIComponent(nikMatch[1]);
          // For direct URLs, return the NIK as both id and token for compatibility
          return { id: nik, token: 'direct' };
        }
      }
      
      // Check for driver-view URL format (both workspace and legacy)
      if (qrDataString.includes('/driver-view?nik=') || qrDataString.includes('/workspace/driver-view?nik=')) {
        const nikMatch = qrDataString.match(/[?&]nik=([^&]+)/);
        if (nikMatch && nikMatch[1]) {
          const nik = decodeURIComponent(nikMatch[1]);
          // For direct URLs, return the NIK as both id and token for compatibility
          return { id: nik, token: 'direct' };
        }
      }
      
      // Check for compact URL format: /q/{token} (legacy)
      if (qrDataString.includes('/q/')) {
        const tokenMatch = qrDataString.match(/\/q\/([a-zA-Z0-9_-]+)/);
        if (tokenMatch && tokenMatch[1]) {
          const token = tokenMatch[1];
          // For compact URLs, we need to extract the employee ID from the token
          // This is a limitation - we'll need to validate on the server side
          // For now, return a special format that the scanner can recognize
          return { id: 'compact', token: token };
        }
      }
      
      // Helper function to parse URL parameters (legacy support)
      const parseQRParams = (url: URL) => {
        // Try multiple parameter names for compatibility
        const dataParam = url.searchParams.get('data') || url.searchParams.get('qr');
        if (dataParam) {
          const decodedData = decodeURIComponent(dataParam);
          const qrData = JSON.parse(decodedData);
          if (qrData.id && qrData.token) {
            return { id: qrData.id, token: qrData.token };
          }
        }
        return null;
      };
      
      // Check if it's a full URL with qr-redirect (legacy)
      if (qrDataString.includes('qr-redirect?')) {
        const url = new URL(qrDataString);
        const result = parseQRParams(url);
        if (result) return result;
      }
      
      // Handle case where QR might be just the URL path without domain (legacy)
      if (qrDataString.includes('/qr-redirect?')) {
        // Extract query string part
        const parts = qrDataString.split('/qr-redirect?');
        if (parts.length > 1) {
          const queryString = parts[1];
          const url = new URL(`http://localhost/?${queryString}`);
          const result = parseQRParams(url);
          if (result) return result;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

export function createQRPayload(employeeId: string, token: string): string {
  return JSON.stringify({ id: employeeId, token });
}

// Utility function untuk deteksi mobile device
export function isMobileDevice(): boolean {
  // Check user agent for mobile patterns
  const userAgentCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent);
  
  // Check screen size and touch capability together to avoid false positives on touch laptops
  const mobileScreenAndTouch = window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  // Return true if user agent indicates mobile OR if it's a small touch screen
  return userAgentCheck || mobileScreenAndTouch;
}

// Check if device is specifically a phone (smaller mobile device)
export function isMobilePhone(): boolean {
  return isMobileDevice() && window.innerWidth <= 480;
}
