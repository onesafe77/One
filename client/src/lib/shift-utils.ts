// Utility functions for shift determination and display

// Function to get current WITA time (UTC+8)
export function getWITATime(): Date {
  const now = new Date();
  return new Date(now.getTime() + (8 * 60 * 60 * 1000));
}

// Function to get current WITA time string in HH:MM format
export function getCurrentWITATimeString(): string {
  const witaTime = getWITATime();
  return `${witaTime.getHours().toString().padStart(2, '0')}:${witaTime.getMinutes().toString().padStart(2, '0')}`;
}

export function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Shift detection based on actual shift times:
  // Shift 1: 08:00-16:00 (detection window: 06:00-17:59)
  // Shift 2: 18:00-06:00 (detection window: 18:00-05:59)
  
  if (totalMinutes >= 360 && totalMinutes < 1080) { // 06:00 to 17:59
    return "Shift 1";
  } else { // 18:00 to 05:59
    return "Shift 2";
  }
}

export function isValidShiftTime(currentTime: string, scheduledShift: string): boolean {
  const [hours, minutes] = currentTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  if (scheduledShift === "Shift 1") {
    // Shift 1: Hanya boleh scan antara jam 06:00:00 sampai 18:00:00 (360-1080 minutes)
    return totalMinutes >= 360 && totalMinutes < 1080;
  } else if (scheduledShift === "Shift 2") {
    // Shift 2: Hanya boleh scan antara jam 18:00:00 sampai 06:00:00 hari berikutnya (1080 minutes to 360 minutes next day)
    return totalMinutes >= 1080 || totalMinutes < 360;
  }
  
  return false;
}

export function getShiftDescription(shift: string): string {
  switch (shift) {
    case "Shift 1":
      return "Shift 1 (08:00 - 16:00)";
    case "Shift 2":
      return "Shift 2 (18:00 - 06:00)";
    default:
      return shift;
  }
}

export function getCurrentShift(): string {
  const currentTime = getCurrentWITATimeString();
  return determineShiftByTime(currentTime);
}

export function formatTimeWithShift(time: string): string {
  const shift = determineShiftByTime(time);
  return `${time} (${shift})`;
}