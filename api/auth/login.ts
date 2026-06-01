import { db } from "../lib/db";
import { users } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { setCors, handleOptions } from "../lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { passwordHash: _, ...safeUser } = user;
    res.status(200).json({
      user: safeUser,
      token: `carei_${user.id}_${Date.now()}`,
    });
  } catch (err: any) {
    console.error("[/api/auth/login] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
