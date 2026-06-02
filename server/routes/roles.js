import { Router } from "express";
import supabase from "../db/supabase.js";

const router = Router();

// GET /api/roles
router.get("/", async (req, res, next) => {
  try {
    const { data: roles, error } = await supabase
      .from("roles")
      .select("id, name, department")
      .order("name");

    if (error) throw error;

    res.json({ data: { roles }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
