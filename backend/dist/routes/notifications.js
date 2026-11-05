"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationStore_1 = require("../agent/notificationStore");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
    if (!walletAddress) {
        res.status(400).json({ error: "walletAddress is required" });
        return;
    }
    try {
        res.json({ notifications: await (0, notificationStore_1.listNotifications)(walletAddress) });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load notifications" });
    }
});
exports.default = router;
