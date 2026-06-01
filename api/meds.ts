import { db } from "./lib/db";
import { medicationLogs } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { setCors, handleOptions } from "./lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);

  try {
    if (req.method === "GET") {
      const { visitId } = req.query;
      let query = db.select().from(medicationLogs);
      if (visitId) query = query.where(eq(medicationLogs.visitId, Number(visitId))) as any;
      const rows = await query;
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const body = req.body;
      const [inserted] = await db.insert(medicationLogs).values(body).returning();
      return res.status(201).json(inserted);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[/api/meds] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
