// Determines if a session has enough content to produce rich articles.
// Threshold: 150 words OR 4 employee messages — whichever comes first.
export const isSessionRichEnough = (messages) => {
  const employeeMessages = messages.filter((m) => m.role === "employee");
  const totalWords = employeeMessages.reduce(
    (sum, m) => sum + m.content.trim().split(/\s+/).length,
    0,
  );
  return totalWords >= 150 || employeeMessages.length >= 4;
};
