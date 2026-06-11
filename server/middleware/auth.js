import jwt from "jsonwebtoken";
import supabase from "../db/supabase.js";

/**
 * Verify JWT and load fresh employee data from DB on every request.
 * Loads from DB so role/group changes by admins take effect immediately.
 */
const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
  }

  const token = header.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res
      .status(401)
      .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
  }

  try {
    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, name, email, is_manager, is_admin, group_id, job_title")
      .eq("id", decoded.id)
      .single();

    if (error || !employee) {
      return res
        .status(401)
        .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
    }

    req.employee = employee;
    next();
  } catch {
    return res
      .status(401)
      .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
  }
};

export default auth;
