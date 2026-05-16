// Spaced Repetition System (based on SuperMemo-2)

export const processReview = (word, grade, intervalMultiplier = 1) => {
  // grade: 0 (Again/Forgot), 1 (Hard), 2 (Good), 3 (Easy)
  
  let { repetition, interval, efactor } = word;
  
  if (grade === 0) {
    repetition = 0;
    interval = 1;
  } else {
    // Grade > 0 (Remembered)
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor * intervalMultiplier);
    }
    repetition += 1;
  }

  // Update E-Factor (max 1.3 to avoid it dropping too low)
  efactor = efactor + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02));
  if (efactor < 1.3) efactor = 1.3;

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  // Set to start of day for easier comparison
  nextReviewDate.setHours(0, 0, 0, 0);

  return {
    ...word,
    repetition,
    interval,
    efactor,
    nextReviewDate: nextReviewDate.getTime(),
    lastReviewed: new Date().getTime(),
    isReviewedToday: true
  };
};

// Initial state for a new word
export const getInitialSRSData = () => ({
  repetition: 0,
  interval: 1,
  efactor: 2.5,
  nextReviewDate: new Date(new Date().setHours(0,0,0,0)).getTime(), // Due today
  lastReviewed: null,
  isReviewedToday: false
});
