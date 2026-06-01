import { db } from "./lib/db";
import { users, clients, medications, visits } from "../db/schema";
import bcrypt from "bcryptjs";
import { setCors, handleOptions } from "./lib/cors";

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return handleOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = req.query.secret || req.body?.secret;
  if (secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const hash = await bcrypt.hash("password123", 10);

    const [admin] = await db.insert(users).values({
      name: "Alex Demo",
      email: "demo@carei.app",
      passwordHash: hash,
      role: "carer",
      phone: "07700 900123",
    }).returning();

    const seededClients = await db.insert(clients).values([
      { name: "Margaret Chen", age: 82, condition: "Dementia", address: "12 Oak Lane, London", phone: "020 7946 0958", emergencyContact: "James Chen (son) 07700 900001", needs: ["Mobility assistance", "Medication prompts"], avatar: "https://i.pravatar.cc/150?u=margaret" },
      { name: "Arthur Wright", age: 76, condition: "Parkinson's", address: "45 Maple Drive, London", phone: "020 7946 0959", emergencyContact: "Sarah Wright (daughter) 07700 900002", needs: ["Meal prep", "Falls risk"], avatar: "https://i.pravatar.cc/150?u=arthur" },
      { name: "Dorothy Patel", age: 89, condition: "Arthritis", address: "7 Birch Crescent, London", phone: "020 7946 0960", emergencyContact: "Raj Patel (nephew) 07700 900003", needs: ["Personal care", "Companionship"], avatar: "https://i.pravatar.cc/150?u=dorothy" },
      { name: "George Thompson", age: 71, condition: "Diabetes T2", address: "22 Elm Street, London", phone: "020 7946 0961", emergencyContact: "Emma Thompson (wife) 07700 900004", needs: ["Blood glucose monitoring", "Dietary support"], avatar: "https://i.pravatar.cc/150?u=george" },
    ]).returning();

    await db.insert(medications).values([
      { clientId: seededClients[0].id, name: "Donepezil", dose: "10mg", schedule: "Morning" },
      { clientId: seededClients[0].id, name: "Memantine", dose: "20mg", schedule: "Evening" },
      { clientId: seededClients[1].id, name: "Levodopa", dose: "250mg", schedule: "Morning & Evening" },
      { clientId: seededClients[1].id, name: "Ropinirole", dose: "2mg", schedule: "Morning" },
      { clientId: seededClients[2].id, name: "Paracetamol", dose: "1g", schedule: "As required" },
      { clientId: seededClients[3].id, name: "Metformin", dose: "500mg", schedule: "With meals" },
      { clientId: seededClients[3].id, name: "Gliclazide", dose: "80mg", schedule: "Morning" },
    ]);

    const today = new Date();
    today.setHours(9, 0, 0, 0);

    await db.insert(visits).values([
      { clientId: seededClients[0].id, carerId: admin.id, date: new Date(today.getTime() + 30 * 60000), type: "Morning visit", duration: 60, status: "scheduled" },
      { clientId: seededClients[1].id, carerId: admin.id, date: new Date(today.getTime() + 3 * 60 * 60000), type: "Medication review", duration: 30, status: "scheduled" },
      { clientId: seededClients[2].id, carerId: admin.id, date: new Date(today.getTime() + 5 * 60 * 60000), type: "Afternoon check", duration: 45, status: "scheduled" },
      { clientId: seededClients[3].id, carerId: admin.id, date: new Date(today.getTime() + 7 * 60 * 60000), type: "Evening visit", duration: 60, status: "scheduled" },
    ]);

    res.status(200).json({ success: true, userId: admin.id, clients: seededClients.length });
  } catch (err: any) {
    console.error("[/api/seed] error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
