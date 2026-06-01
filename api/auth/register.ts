import { db } from "../lib/db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { setCors, handleOptions } from "../lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password required" });
    }

    // Check existing user
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [user] = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role: role || "carer",
    }).returning();

    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({
      user: safeUser,
      token: `carei_${user.id}_${Date.now()}`,
    });
  } catch (err: any) {
    console.error("[/api/auth/register] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
