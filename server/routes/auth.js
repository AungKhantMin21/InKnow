import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import supabase from "../db/supabase.js";
import auth from "../middleware/auth.js";

const router = Router();

/** Sign a 7-day JWT — carries only id; fresh data loaded from DB on each request */
const signToken = (employee) =>
  jwt.sign({ id: employee.id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ data: null, error: "Missing fields", message: "We need this to continue." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { data: employee, error } = await supabase
      .from("employees")
      .insert({ name, email, password: hashed })
      .select("id, name, email, is_manager, is_admin, group_id, job_title, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          data: null,
          error: "Email taken",
          message: "An account with that email already exists.",
        });
      }
      throw error;
    }

    const token = signToken(employee);
    res.status(201).json({ data: { employee, token }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ data: null, error: "Missing fields", message: "We need this to continue." });
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, name, email, password, is_manager, is_admin, group_id, job_title, created_at")
      .eq("email", email)
      .single();

    if (error || !employee) {
      return res.status(401).json({
        data: null,
        error: "Invalid credentials",
        message: "Email or password is incorrect.",
      });
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return res.status(401).json({
        data: null,
        error: "Invalid credentials",
        message: "Email or password is incorrect.",
      });
    }

    const { password: _pw, ...employeeData } = employee;
    const token = signToken(employeeData);
    res.json({ data: { employee: employeeData, token }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — returns full employee including Phase 2 fields
router.get("/me", auth, async (req, res, next) => {
  try {
    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, name, email, is_manager, is_admin, group_id, job_title, created_at, groups(name)")
      .eq("id", req.employee.id)
      .single();

    if (error || !employee) {
      return res.status(404).json({
        data: null,
        error: "Not found",
        message: "We couldn't find that. Try going back.",
      });
    }

    res.json({ data: { employee }, error: null, message: null });
  } catch (err) {
    next(err);
  }
});

export default router;
