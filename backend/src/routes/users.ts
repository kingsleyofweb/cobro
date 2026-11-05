import { Router } from "express";
import { findUserByWallet, upsertUser } from "../agent/userStore";

const router = Router();

router.get("/profile", async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  if (!walletAddress) { res.status(400).json({ error: "walletAddress is required" }); return; }
  try { res.json({ user: (await findUserByWallet(walletAddress)) ?? null }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load profile" }); }
});

router.post("/profile", async (req, res) => {
  const { username, walletAddress, role } = req.body;
  if (!username || !walletAddress || !["client", "freelancer"].includes(role)) {
    res.status(400).json({ error: "username, walletAddress and role are required" }); return;
  }
  try { res.json({ user: await upsertUser(username, walletAddress, role) }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to save profile" }); }
});

export default router;
