/** Catch-all error handler — never expose raw messages to the client */
const errorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;

  // Gemini quota / rate limit — return 503 so client shows the right copy
  if (status === 429) {
    return res.status(503).json({
      data: null,
      error: "AI rate limit",
      message: "The AI is taking too long — try again.",
    });
  }

  res.status(status >= 400 && status < 500 ? status : 500).json({
    data: null,
    error: err.message || "Internal server error",
    message: "Something went wrong — try again.",
  });
};

export default errorHandler;
