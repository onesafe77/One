// Utility functions for shift determination and display

export function determineShiftByTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Berdasarkan data roster dan fleksibilitas operasional:
  // Shift 1: 08:00-16:00 (check-in window: 06:00-18:00)
  // Shift 2: 18:00-06:00 (check-in window: 12:00-10:00)
  
  if (totalMinutes >= 360 && totalMinutes < 720) {
    return "Shift 1";
  } else {
    return "Shift 2";
  }
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
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return determineShiftByTime(currentTime);
}

export function formatTimeWithShift(time: string): string {
  const shift = determineShiftByTime(time);
  return `${time} (${shift})`;
}