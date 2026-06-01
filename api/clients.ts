import { db } from "./lib/db";
import { clients, medications } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { setCors, handleOptions } from "./lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const allClients = await db.select().from(clients);
    const allMeds = await db.select().from(medications);

    const enriched = allClients.map((c) => ({
      ...c,
      meds: allMeds.filter((m) => m.clientId === c.id),
    }));

    res.status(200).json(enriched);
  } catch (err: any) {
    console.error("[/api/clients] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
