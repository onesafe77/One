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
  
  // Shift detection:
  // Shift 1: 06:00-16:00 (360-960 menit)
  // Shift 2: 16:30-20:00 (990-1200 menit)
  
  if (totalMinutes >= 990 && totalMinutes < 1200) { // 16:30 to 19:59
    return "Shift 2";
  } else if (totalMinutes >= 360 && totalMinutes < 960) { // 06:00 to 15:59
    return "Shift 1";
  } else {
    return "Shift 1"; // Default to Shift 1 for other times
  }
}

export function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 06:00:00 sampai 16:00:00 (360-960 minutes)
    return totalMinutes >= 360 && totalMinutes < 960;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 16:30:00 sampai 20:00:00 (990-1200 minutes)
    return totalMinutes >= 990 && totalMinutes < 1200;
  }
  
  return false;
}

export function getShiftDescription(shift: string): string {
  switch (shift) {
    case "Shift 1":
      return "Shift 1 (06:00 - 16:00)"; // Waktu window check-in sesuai validasi
    case "Shift 2":
      return "Shift 2 (16:30 - 20:00)"; // Waktu window check-in sesuai validasi
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