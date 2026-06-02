import "dotenv/config";
import express from "express";
import supabase from "./db/supabase.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" }, error: null, message: null });
});

async function start() {
  const { data, error } = await supabase.from("roles").select("id, name");

  if (error) {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }

  console.log(`DB connected — ${data.length} roles loaded`);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
