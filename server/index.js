import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" }, error: null, message: null });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
