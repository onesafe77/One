// Utility functions for shift determination and display

// Function to get current local time
export function getCurrentTime(): Date {
  return new Date();
}

// Function to get current local time string in HH:MM format
export function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Shift detection tanpa overlap:
  // Shift 1: 04:00-18:00 (240-1080 menit)
  // Shift 2: 18:00-04:00 (1080+ menit atau <240 menit)
  
  if (totalMinutes >= 240 && totalMinutes < 1080) { // 04:00 to 17:59
    return "Shift 1";
  } else { // 18:00 to 03:59 (next day)
    return "Shift 2";
  }
}

export function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 04:00:00 sampai 18:00:00 (240-1080 minutes)
    return totalMinutes >= 240 && totalMinutes < 1080;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 18:00:00 sampai 04:00:00 hari berikutnya (1080+ minutes atau <240 minutes)
    // TIDAK ADA OVERLAP dengan Shift 1
    return totalMinutes >= 1080 || totalMinutes < 240;
  }
  
  return false;
}

export function getShiftDescription(shift: string): string {
  switch (shift) {
    case "Shift 1":
      return "Shift 1 (04:00 - 18:00)"; // Waktu window check-in sesuai validasi
    case "Shift 2":
      return "Shift 2 (18:00 - 04:00)"; // Waktu window check-in sesuai validasi
    default:
      return shift;
  }
}

export function getCurrentShift(): string {
  const currentTime = getCurrentTimeString();
  return determineShiftByTime(currentTime);
}

export function formatTimeWithShift(time: string): string {
  const shift = determineShiftByTime(time);
  return `${time} (${shift})`;
}