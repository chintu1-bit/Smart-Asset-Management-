import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { 
  User, Asset, Booking, MaintenanceLog, AuditLog, 
  UserRole, AssetStatus, BookingStatus, ReturnCondition, SystemStats 
} from "./src/types";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
      };
    }
  }
}

// DB Path
const DB_FILE = path.join(process.cwd(), "db.json");

// Helper structure inside db.json
interface DatabaseState {
  users: User[];
  assets: Asset[];
  bookings: Booking[];
  maintenanceLogs: MaintenanceLog[];
  auditLogs: AuditLog[];
}

// Quick security mechanism
const JWT_SECRET = "iitr-secret-key-allocation-platform-2026";

// Initialize Database with pre-seeded data if it does not exist
function initDb(): DatabaseState {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse db.json, creating a fresh one.", e);
    }
  }

  const defaultDb: DatabaseState = {
    users: [
      { id: "u-admin", name: "IITR Admin Coordinator", email: "admin@iitr.ac.in", role: "ADMIN" },
      { id: "u-user", name: "Rajesh Kumar (Student)", email: "student@iitr.ac.in", role: "USER" },
      { id: "u-user2", name: "Ananya Sharma (Cultural Sec)", email: "ananya@iitr.ac.in", role: "USER" }
    ],
    assets: [
      {
        id: "a-sony-fx3",
        name: "Sony FX3 Cinema Camera",
        category: "Cameras & Optics",
        description: "Full-frame cinema line camera with top handle, ideal for Cultural Council premium videography.",
        totalQuantity: 3,
        availableQuantity: 3,
        status: "HEALTHY",
        condition: "Excellent - Sensor cleaned on May 20th",
        qrCode: "asset-sony-fx3",
        lastMaintained: "2026-05-20"
      },
      {
        id: "a-senn-mic",
        name: "Sennheiser EW-100 Wireless Mic",
        category: "Audio Systems",
        description: "Professional lapel mic sets for main speakers, stage sound feed, and anchoring.",
        totalQuantity: 5,
        availableQuantity: 5,
        status: "HEALTHY",
        condition: "Good - Transmitters fully functional",
        qrCode: "asset-senn-mic",
        lastMaintained: "2026-04-12"
      },
      {
        id: "a-qsc-spkr",
        name: "QSC K12.2 Active Powered Speaker",
        category: "Audio Systems",
        description: "2000W rugged active loudspeaker, perfect for MAC Auditorium sound reinforcements.",
        totalQuantity: 4,
        availableQuantity: 4,
        status: "HEALTHY",
        condition: "Excellent - Visual screens undamaged",
        qrCode: "asset-qsc-spkr",
        lastMaintained: "2026-05-02"
      },
      {
        id: "a-couch",
        name: "Stage Drama Victorian Couch",
        category: "Stage Props",
        description: "An elegant velvet-trimmed wood couch for theatrical performances and backdrop settings.",
        totalQuantity: 1,
        availableQuantity: 1,
        status: "HEALTHY",
        condition: "A bit worn - Cushion needs slight re-aligning",
        qrCode: "asset-couch",
        lastMaintained: "2025-11-15"
      },
      {
        id: "a-softbox",
        name: "Studio Softbox Lighting Panel Kit",
        category: "Lighting",
        description: "Dimmable LED panels with high stands for indoor photography, studio settings, and digital art.",
        totalQuantity: 4,
        availableQuantity: 4,
        status: "MAINTENANCE",
        condition: "Needs bulb check - Flickers sometimes on low power",
        qrCode: "asset-softbox",
        lastMaintained: "2026-06-01"
      }
    ],
    bookings: [
      {
        id: "b-001",
        userId: "u-user",
        userName: "Rajesh Kumar (Student)",
        userEmail: "student@iitr.ac.in",
        assetId: "a-sony-fx3",
        assetName: "Sony FX3 Cinema Camera",
        assetCategory: "Cameras & Optics",
        quantity: 1,
        startDate: "2026-05-10",
        endDate: "2026-05-14",
        status: "RETURNED",
        returnStatus: "EXCELLENT",
        returnedAt: "2026-05-14T11:20:00Z",
        notes: "Used for the Thomso Main teaser shoot. Captured in full log.",
        createdAt: "2026-05-08T10:00:00Z"
      },
      {
        id: "b-002",
        userId: "u-user",
        userName: "Rajesh Kumar (Student)",
        userEmail: "student@iitr.ac.in",
        assetId: "a-senn-mic",
        assetName: "Sennheiser EW-100 Wireless Mic",
        assetCategory: "Audio Systems",
        quantity: 2,
        startDate: "2026-06-03",
        endDate: "2026-06-07",
        status: "ISSUED",
        notes: "Currently being used at MAC for the inter-college debates.",
        createdAt: "2026-06-01T14:30:00Z"
      },
      {
        id: "b-003",
        userId: "u-user2",
        userName: "Ananya Sharma (Cultural Sec)",
        userEmail: "ananya@iitr.ac.in",
        assetId: "a-qsc-spkr",
        assetName: "QSC K12.2 Active Powered Speaker",
        assetCategory: "Audio Systems",
        quantity: 2,
        startDate: "2026-06-10",
        endDate: "2026-06-12",
        status: "APPROVED",
        notes: "Booked in advance for the Choreography section's practice trial.",
        createdAt: "2026-06-04T09:12:00Z"
      }
    ],
    maintenanceLogs: [
      {
        id: "m-001",
        assetId: "a-softbox",
        assetName: "Studio Softbox Lighting Panel Kit",
        issueDescription: "Stand lock knob is missing, LED bulbs flicker on 20% brightness.",
        reportedBy: "admin@iitr.ac.in",
        reportedAt: "2026-06-01T11:00:00Z",
        status: "OPEN"
      }
    ],
    auditLogs: [
      {
        id: "log-001",
        userId: "u-admin",
        userEmail: "admin@iitr.ac.in",
        action: "SEED_DATA",
        targetName: "System",
        timestamp: "2026-06-05T04:00:00Z",
        details: "Initial database pre-populated with default cultural assets and student profiles."
      }
    ]
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), "utf-8");
  return defaultDb;
}

let db = initDb();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// Simple atomic write operations and locking
const dbLock = {
  isLocked: false,
  queue: [] as (() => void)[],
  async acquire() {
    if (!this.isLocked) {
      this.isLocked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  },
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.isLocked = false;
    }
  }
};

// Simple manual token verification - stateless/simulated JWT
function parseBearerToken(authHeader: string | undefined): { email: string; role: UserRole; id: string } | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
    const json = JSON.parse(raw);
    if (json.email && json.role && json.id) {
      return json;
    }
  } catch (e) {
    // Return null on failure
  }
  return null;
}

// Authentication middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const tokenPayload = parseBearerToken(req.headers.authorization);
  if (!tokenPayload) {
    return res.status(401).json({ error: "Unauthorized access - Please login first" });
  }
  req.user = tokenPayload;
  next();
};

const adminMiddleware = (req: any, res: any, next: any) => {
  const tokenPayload = parseBearerToken(req.headers.authorization);
  if (!tokenPayload || tokenPayload.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden - Administrator account required" });
  }
  req.user = tokenPayload;
  next();
};

// Create the Express app
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Log action helper
  const logAudit = (userId: string, email: string, action: string, targetName: string, details: string) => {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      userEmail: email,
      action,
      targetName,
      timestamp: new Date().toISOString(),
      details
    };
    db.auditLogs.unshift(log); // newest first
    saveDb();
  };

  // Re-calculate quantities in-memory based on current approved or issued bookings
  const getRecalculatedAssetQuantity = (asset: Asset, bookings: Booking[]): number => {
    // Only 'ISSUED' counts towards reducing the immediate physical layout limit of an item if we only count physical handovers,
    // OR we can report physical available count as: `totalQuantity - sum(ISSUED)`
    // And safe bookable stock as of calendar checks as: `totalQuantity - sum(overlapping APPROVED/ISSUED/PENDING)`
    const activeIssuedQuantity = bookings
      .filter(b => b.assetId === asset.id && b.status === "ISSUED")
      .reduce((sum, b) => sum + b.quantity, 0);
    return Math.max(0, asset.totalQuantity - activeIssuedQuantity);
  };

  // Cron simulation interval: check for overdue rentals every 60 seconds
  setInterval(() => {
    let overdueCount = 0;
    const now = new Date();
    db.bookings.forEach(b => {
      if (b.status === "ISSUED") {
        const endDate = new Date(b.endDate);
        if (endDate < now) {
          overdueCount++;
        }
      }
    });
    // This background worker simulates verification periodically.
  }, 60000);

  // ----------------------- API Routes -----------------------

  // Auth: Email/Password login mock
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const emailTrim = email.trim().toLowerCase();
    
    // Check if user exists in db
    let user = db.users.find(u => u.email.toLowerCase() === emailTrim);
    
    if (!user) {
      // Auto-register during demo if password matches basic rule
      const domain = emailTrim.split("@")[1] || "";
      const isIitEmail = domain.includes("iit") && domain.endsWith("ac.in");

      if (isIitEmail && password.length >= 6) {
        const isDefaultAdmin = emailTrim.startsWith("admin");
        const role: UserRole = isDefaultAdmin ? "ADMIN" : "USER";
        const isRoorkee = domain.includes("iitr");
        const iitName = domain.split(".")[0].toUpperCase();
        const nameText = isDefaultAdmin 
          ? `${iitName} Admin Coordinator` 
          : `${emailTrim.split("@")[0].toUpperCase()} (Student, ${iitName})`;

        user = {
          id: `u-${Date.now()}`,
          name: nameText,
          email: emailTrim,
          role: role
        };
        db.users.push(user);
        saveDb();
        logAudit(user.id, user.email, "REGISTER", "User Profile", `New account automatically registered under ${iitName} domain.`);
      } else {
        return res.status(400).json({ error: "Please sign in with a valid Indian Institute of Technology email (must contain 'iit' and end with 'ac.in', e.g. student@iitb.ac.in, chintu1@ch.iitr.ac.in) and a password with at least 6 characters" });
      }
    }

    // Verify mock password (just require a string length of at least 6)
    if (password !== "admin123" && password !== "student123" && password.length < 6) {
      return res.status(401).json({ error: "Invalid password for training. Default passwords: admin123 / student123" });
    }

    // Generate Bearer token as base64-encoded user info
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64");

    res.json({
      token,
      user
    });
  });

  // Assets: Get all assets (supports search, category, and status filters)
  app.get("/api/assets", (req, res) => {
    const { search, category, status } = req.query;
    let filtered = [...db.assets];

    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }

    if (category && category !== "All") {
      filtered = filtered.filter(a => a.category === category);
    }

    if (status && status !== "All") {
      filtered = filtered.filter(a => a.status === status);
    }

    // Dynamic available quantity calculation
    const result = filtered.map(a => ({
      ...a,
      availableQuantity: getRecalculatedAssetQuantity(a, db.bookings)
    }));

    res.json(result);
  });

  // Create Assets (Admin only)
  app.post("/api/assets", adminMiddleware, (req, res) => {
    const { name, category, description, totalQuantity, condition } = req.body;
    if (!name || !category || typeof totalQuantity !== "number" || totalQuantity <= 0) {
      return res.status(400).json({ error: "Invalid asset data. Name, category, and totalQuantity are required." });
    }

    const newAsset: Asset = {
      id: `a-${Date.now()}`,
      name,
      category,
      description: description || "",
      totalQuantity,
      availableQuantity: totalQuantity,
      status: "HEALTHY",
      condition: condition || "Excellent",
      qrCode: `asset-${Date.now()}`
    };

    db.assets.push(newAsset);
    saveDb();

    logAudit(req.user.id, req.user.email, "CREATE_ASSET", name, `Added ${totalQuantity} units to category ${category}`);

    res.status(201).json(newAsset);
  });

  // Update Asset (Admin only)
  app.put("/api/assets/:id", adminMiddleware, (req, res) => {
    const { id } = req.params;
    const { name, category, description, totalQuantity, status, condition } = req.body;

    const index = db.assets.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const existing = db.assets[index];

    const updated: Asset = {
      ...existing,
      name: name ?? existing.name,
      category: category ?? existing.category,
      description: description ?? existing.description,
      totalQuantity: typeof totalQuantity === "number" ? totalQuantity : existing.totalQuantity,
      status: status ?? existing.status,
      condition: condition ?? existing.condition
    };

    db.assets[index] = updated;
    saveDb();

    logAudit(req.user.id, req.user.email, "UPDATE_ASSET", updated.name, `Modified details, status set to ${updated.status}`);

    res.json(updated);
  });

  // Delete Asset (Admin only)
  app.delete("/api/assets/:id", adminMiddleware, (req, res) => {
    const { id } = req.params;

    const index = db.assets.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const assetName = db.assets[index].name;
    
    // Check if any booking is currently active (ISSUED or APPROVED)
    const hasActiveBookings = db.bookings.some(b => b.assetId === id && (b.status === "ISSUED" || b.status === "APPROVED"));
    if (hasActiveBookings) {
      return res.status(400).json({ error: "Cannot delete asset with active bookings. Complete or cancel outstanding bookings first" });
    }

    db.assets.splice(index, 1);
    // clean up pending bookings for it
    db.bookings = db.bookings.filter(b => !(b.assetId === id && b.status === "PENDING"));
    saveDb();

    logAudit(req.user.id, req.user.email, "DELETE_ASSET", assetName, `Removed from the active catalog inventory`);

    res.json({ success: true, message: `Asset deleted successfully: ${assetName}` });
  });

  // Bookings: List personal bookings (User)
  app.get("/api/bookings/my", authMiddleware, (req, res) => {
    const userBookings = db.bookings
      .filter(b => b.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(userBookings);
  });

  // Bookings: Get all bookings (Admin only)
  app.get("/api/bookings", adminMiddleware, (req, res) => {
    const sorted = [...db.bookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sorted);
  });

  // Bookings: Create booking request with strict concurrency locking & overbooking protection
  app.post("/api/bookings", authMiddleware, async (req, res) => {
    await dbLock.acquire();
    try {
      const { assetId, quantity, startDate, endDate, notes } = req.body;
      if (!assetId || !quantity || !startDate || !endDate) {
        return res.status(400).json({ error: "Asset registration requires: ID, quantity, and date ranges." });
      }

      if (quantity <= 0) {
        return res.status(400).json({ error: "Booking quantity must be at least 1." });
      }

      const asset = db.assets.find(a => a.id === assetId);
      if (!asset) {
        return res.status(404).json({ error: "Resource item not found in our catalog" });
      }

      if (asset.status === "RETIRED") {
        return res.status(400).json({ error: "Asset has been retired and is unavailable for booking." });
      }

      const requestedStart = new Date(startDate);
      const requestedEnd = new Date(endDate);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (requestedStart < today) {
        return res.status(400).json({ error: "Booking start date cannot be in the past." });
      }

      if (requestedEnd < requestedStart) {
        return res.status(400).json({ error: "End date must be on or after the start date." });
      }

      // Live Overlap Check Calculation:
      // We look at all approved or issued bookings for this asset,
      // and determine the maximum reserved amount on any single calendar day within our requested range [requestedStart, requestedEnd].
      const msPerDay = 24 * 60 * 60 * 1000;
      const numDays = Math.round((requestedEnd.getTime() - requestedStart.getTime()) / msPerDay) + 1;
      
      const activeBookings = db.bookings.filter(b => 
        b.assetId === assetId && 
        (b.status === "APPROVED" || b.status === "ISSUED")
      );

      for (let i = 0; i < numDays; i++) {
        const currentDate = new Date(requestedStart.getTime() + i * msPerDay);
        currentDate.setHours(12, 0, 0, 0); // avoid time-zone edge cases

        // Sum quantities for bookings active on this specific date
        const bookedOnThisDay = activeBookings
          .filter(b => {
            const bStart = new Date(b.startDate);
            bStart.setHours(12, 0, 0, 0);
            const bEnd = new Date(b.endDate);
            bEnd.setHours(12, 0, 0, 0);
            return currentDate >= bStart && currentDate <= bEnd;
          })
          .reduce((sum, b) => sum + b.quantity, 0);

        if (asset.totalQuantity - bookedOnThisDay < quantity) {
          return res.status(400).json({ 
            error: `Overbooking Collision: Only ${asset.totalQuantity - bookedOnThisDay} units of '${asset.name}' are available on the date ${currentDate.toISOString().split('T')[0]}.`
          });
        }
      }

      const newBooking: Booking = {
        id: `b-${Date.now()}`,
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        assetId: asset.id,
        assetName: asset.name,
        assetCategory: asset.category,
        quantity,
        startDate,
        endDate,
        status: "PENDING",
        notes: notes || "",
        createdAt: new Date().toISOString()
      };

      db.bookings.push(newBooking);
      saveDb();

      logAudit(
        req.user.id, 
        req.user.email, 
        "CREATE_BOOKING", 
        asset.name, 
        `Requested ${quantity} units from ${startDate} to ${endDate}`
      );

      res.status(201).json(newBooking);
    } catch (e: any) {
      res.status(500).json({ error: "Transaction processing failed: " + e.message });
    } finally {
      dbLock.release();
    }
  });

  // Bookings: Change request status (Admin only)
  // Options: APPROVE, REJECT, ISSUE (physical pickup), RETURN (physical return)
  app.patch("/api/bookings/:id/status", adminMiddleware, (req, res) => {
    const { id } = req.params;
    const { status, returnStatus, notes } = req.body;

    const index = db.bookings.findIndex(b => b.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Booking record not found" });
    }

    const booking = db.bookings[index];
    const asset = db.assets.find(a => a.id === booking.assetId);

    if (!asset) {
      return res.status(404).json({ error: "Associated catalog asset not found" });
    }

    const oldStatus = booking.status;
    const updatedStatus = status as BookingStatus;

    // Validate states transitions
    if (updatedStatus === "ISSUED" && oldStatus !== "APPROVED" && oldStatus !== "PENDING") {
      return res.status(400).json({ error: "Assets can only be ISSUED if previously APPROVED or PENDING" });
    }

    if (updatedStatus === "RETURNED" && oldStatus !== "ISSUED") {
      return res.status(400).json({ error: "Assets can only be returned if they are currently ISSUED" });
    }

    // Trigger state modifications
    booking.status = updatedStatus;
    if (notes) {
      booking.notes = notes;
    }

    if (updatedStatus === "RETURNED") {
      booking.returnStatus = (returnStatus as ReturnCondition) || "EXCELLENT";
      booking.returnedAt = new Date().toISOString();
      if (returnStatus === "DAMAGED") {
        // Automatically put asset to Maintenance
        asset.status = "MAINTENANCE";
        asset.condition = `Damaged upon return: ${notes || "Reported during checkout"}`;

        // Create log entry
        const mLog: MaintenanceLog = {
          id: `m-${Date.now()}`,
          assetId: asset.id,
          assetName: asset.name,
          issueDescription: `Reported DAMAGED upon return from booking request. Notes: ${notes || "None."}`,
          reportedBy: req.user.email,
          reportedAt: new Date().toISOString(),
          status: "OPEN"
        };
        db.maintenanceLogs.unshift(mLog);
      }
    }

    db.bookings[index] = booking;
    saveDb();

    logAudit(
      req.user.id, 
      req.user.email, 
      `BOOKING_${updatedStatus}`, 
      asset.name, 
      `Booking request of quantity ${booking.quantity} marked as ${updatedStatus} by admin.`
    );

    res.json(booking);
  });

  // Maintenance: Report item damage or register a log (Admin or Student User)
  app.post("/api/maintenance", authMiddleware, (req, res) => {
    const { assetId, issueDescription } = req.body;
    if (!assetId || !issueDescription) {
      return res.status(400).json({ error: "Asset ID and issue description query parameters are required" });
    }

    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Set status to Maintenance
    asset.status = "MAINTENANCE";
    asset.condition = `Maintained: ${issueDescription}`;

    const newLog: MaintenanceLog = {
      id: `m-${Date.now()}`,
      assetId,
      assetName: asset.name,
      issueDescription,
      reportedBy: req.user.email,
      reportedAt: new Date().toISOString(),
      status: "OPEN"
    };

    db.maintenanceLogs.unshift(newLog);
    saveDb();

    logAudit(
      req.user.id, 
      req.user.email, 
      "REPORT_MAINTENANCE", 
      asset.name, 
      `Reported maintenance problem: ${issueDescription}`
    );

    res.status(201).json(newLog);
  });

  // Maintenance: List all logs (All authenticated users)
  app.get("/api/maintenance", authMiddleware, (req, res) => {
    res.json(db.maintenanceLogs);
  });

  // Maintenance: Resolve a maintenance issue (Admin only)
  app.post("/api/maintenance/:id/resolve", adminMiddleware, (req, res) => {
    const { id } = req.params;
    const { condition } = req.body;

    const logIndex = db.maintenanceLogs.findIndex(l => l.id === id);
    if (logIndex === -1) {
      return res.status(404).json({ error: "Maintenance record not found" });
    }

    const log = db.maintenanceLogs[logIndex];
    log.status = "RESOLVED";
    log.resolvedAt = new Date().toISOString();

    const asset = db.assets.find(a => a.id === log.assetId);
    if (asset) {
      asset.status = "HEALTHY";
      asset.condition = condition || "Excellent (Repaired)";
      asset.lastMaintained = new Date().toISOString().split("T")[0];
    }

    saveDb();

    logAudit(
      req.user.id, 
      req.user.email, 
      "RESOLVE_MAINTENANCE", 
      log.assetName, 
      `Issue resolved and marked asset status as HEALTHY.`
    );

    res.json(log);
  });

  // System Audit Logs (Admin only)
  app.get("/api/audit-logs", adminMiddleware, (req, res) => {
    res.json(db.auditLogs);
  });

  // Stats Analytics (Admin only)
  app.get("/api/stats", adminMiddleware, (req, res) => {
    const totalAssets = db.assets.length;
    const activeBookings = db.bookings.filter(b => b.status === "ISSUED" || b.status === "APPROVED").length;
    const pendingApprovals = db.bookings.filter(b => b.status === "PENDING").length;
    
    const now = new Date();
    const overdueCount = db.bookings.filter(b => 
      b.status === "ISSUED" && new Date(b.endDate) < now
    ).length;

    // Category Distribution
    const catCounts: Record<string, number> = {};
    db.assets.forEach(a => {
      catCounts[a.category] = (catCounts[a.category] || 0) + a.totalQuantity;
    });
    const categoryDistribution = Object.entries(catCounts).map(([name, value]) => ({
      name,
      value
    }));

    // Asset Utilization Rate formulation
    // Calculated as: sum(booking event days) compared to total capacity of this asset
    const assetUtilization = db.assets.map(a => {
      const activeAssetBookings = db.bookings.filter(b => b.assetId === a.id);
      let totalBookedDays = 0;
      activeAssetBookings.forEach(b => {
        const start = new Date(b.startDate);
        const end = new Date(b.endDate);
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24*60*60*1000)) + 1);
        if (b.status === "RETURNED" || b.status === "ISSUED" || b.status === "APPROVED") {
          totalBookedDays += days * b.quantity;
        }
      });

      // Simple heuristic score capped at 95% maximum for realism
      const utilizationScore = Math.min(95, Math.max(10, Math.round((totalBookedDays / (a.totalQuantity * 30)) * 100)) || 15);

      return {
        name: a.name,
        utilization: utilizationScore
      };
    }).slice(0, 5); // top 5 for visual fidelity

    const stats: SystemStats = {
      totalAssets,
      activeBookings,
      pendingApprovals,
      overdueCount,
      categoryDistribution,
      assetUtilization,
      recentAuditLogs: db.auditLogs.slice(0, 15)
    };

    res.json(stats);
  });

  // ----------------- Serve Frontend -----------------

  if (process.env.NODE_ENV !== "production") {
    // Vite Middlewares for development environment
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Asset Management Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Smart Asset Management Platform server", err);
});
