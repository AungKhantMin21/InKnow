import "dotenv/config";
import express from "express";
import cors from "cors";
import supabase from "./db/supabase.js";
import authRoutes from "./routes/auth.js";
import sessionsRoutes from "./routes/sessions.js";
import knowledgeRoutes from "./routes/knowledge.js";
import copilotRoutes from "./routes/copilot.js";
import managerRoutes from "./routes/manager.js";
import groupsRoutes from "./routes/groups.js";
import invitesRoutes from "./routes/invites.js";
import adminRoutes from "./routes/admin.js";
import jobsRoutes from "./routes/jobs.js";
import errorHandler from "./middleware/errorHandler.js";
import { startWorker } from "./workers/job-worker.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" }, error: null, message: null });
});

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/copilot", copilotRoutes);
app.use("/api/manager", managerRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/invites", invitesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/jobs", jobsRoutes);

app.use(errorHandler);

async function start() {
  const { data, error } = await supabase.from("groups").select("id");

  if (error) {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }

  console.log(`DB connected — ${data.length} groups loaded`);

  startWorker();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
