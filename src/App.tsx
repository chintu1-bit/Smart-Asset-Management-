import React, { useState, useEffect } from "react";
import { 
  Laptop, Shield, User as UserIcon, Calendar, Activity, 
  CheckCircle, AlertCircle, XCircle, Plus, Search, Filter, 
  Trash2, Edit, RefreshCw, FileText, Check, X, Clock, 
  ArrowRightLeft, QrCode, AlertTriangle, Gauge, History, 
  UserCheck, LogOut, HeartPulse, Sparkles, Send, Box,
  CheckCircle2, Info
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from "recharts";
import Login from "./components/Login";
import { 
  User, Asset, Booking, MaintenanceLog, AuditLog, SystemStats, UserRole, AssetStatus, BookingStatus 
} from "./types";

export default function App() {
  // Authentication state
  const [token, setToken] = useState<string | null>(localStorage.getItem("asset_token"));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("asset_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Loaders and errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal & Drawer views
  const [activeModal, setActiveModal] = useState<string | null>(null); // "add-asset", "edit-asset", "booking", "return-inspect", "qr-card", "report-issue", "resolve-maintenance"
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedLog, setSelectedLog] = useState<MaintenanceLog | null>(null);
  const [repairConditionText, setRepairConditionText] = useState("Excellent (Repaired)");

  // Form states
  // 1. Asset CRUD Form
  const [assetForm, setAssetForm] = useState({
    id: "",
    name: "",
    category: "Cameras & Optics",
    description: "",
    totalQuantity: 2,
    condition: "Excellent"
  });

  // 2. Booking Form (Resource Consumer)
  const [bookingForm, setBookingForm] = useState({
    quantity: 1,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: ""
  });
  // Real-time slot availability state inside the booking modal
  const [bookingClashMessage, setBookingClashMessage] = useState<{ type: "safe" | "clash"; text: string } | null>(null);

  // 3. Return Inspection Form
  const [returnForm, setReturnForm] = useState({
    status: "EXCELLENT", // "EXCELLENT" | "DAMAGED"
    damageDescription: "",
    notes: ""
  });

  // 4. Manual Issue Damage Report Form
  const [issueForm, setIssueForm] = useState({
    assetId: "",
    issueDescription: ""
  });

  // Quick Action scan state
  const [simulatedScanMode, setSimulatedScanMode] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Auto-clear notification toast helper
  const triggerSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => {
      setActionSuccess(null);
    }, 4500);
  };

  // Set auth credentials and load database
  const handleLoginSuccess = (userToken: string, loggedUser: User) => {
    localStorage.setItem("asset_token", userToken);
    localStorage.setItem("asset_user", JSON.stringify(loggedUser));
    setToken(userToken);
    setUser(loggedUser);
    triggerSuccess(`Successfully authenticated as ${loggedUser.name}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem("asset_token");
    localStorage.removeItem("asset_user");
    setToken(null);
    setUser(null);
    setActiveTab("dashboard");
    setAssets([]);
    setAllBookings([]);
    setMyBookings([]);
    setMaintenanceLogs([]);
    setAuditLogs([]);
    setStats(null);
  };

  // Generalized generic API requester helper
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const bearer = token ? { "Authorization": `Bearer ${token}` } : {};
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...bearer,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || "Failed to execute request");
    }

    return response.json();
  };

  // Sync state data from server
  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Assets list are visible for everyone
      const assetsData = await apiFetch(`/api/assets`);
      setAssets(assetsData);

      // 2. Load role-based queries
      if (user?.role === "ADMIN") {
        const [bookingsData, mLogsData, auditData, statsData] = await Promise.all([
          apiFetch(`/api/bookings`),
          apiFetch(`/api/maintenance`),
          apiFetch(`/api/audit-logs`),
          apiFetch(`/api/stats`)
        ]);
        setAllBookings(bookingsData);
        setMaintenanceLogs(mLogsData);
        setAuditLogs(auditData);
        setStats(statsData);
      } else {
        const [myBookingsData, mLogsData] = await Promise.all([
          apiFetch(`/api/bookings/my`),
          apiFetch(`/api/maintenance`)
        ]);
        setMyBookings(myBookingsData);
        setMaintenanceLogs(mLogsData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not retrieve council asset information.");
    } finally {
      setLoading(false);
    }
  };

  // Sync initially and on activeTab changes
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, activeTab]);

  // Handle live checking for overbooking overlaps
  useEffect(() => {
    if (activeModal === "booking" && selectedAsset) {
      if (bookingForm.startDate && bookingForm.endDate && bookingForm.quantity > 0) {
        liveCheckCollision();
      }
    }
  }, [bookingForm.startDate, bookingForm.endDate, bookingForm.quantity, selectedAsset, activeModal]);

  const liveCheckCollision = () => {
    if (!selectedAsset) return;
    const { startDate, endDate, quantity } = bookingForm;
    const requestedStart = new Date(startDate);
    const requestedEnd = new Date(endDate);
    
    if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
      setBookingClashMessage({ type: "clash", text: "Please enter valid date offsets." });
      return;
    }

    if (requestedEnd < requestedStart) {
      setBookingClashMessage({ type: "clash", text: "End date must fall on or after the starting date." });
      return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    if (requestedStart < today) {
      setBookingClashMessage({ type: "clash", text: "Cannot schedule historic reservations in the past." });
      return;
    }

    // Dynamic Client-side precheck calculation to guide UI
    // Filter active bookings of this asset
    const currentActive = (user?.role === "ADMIN" ? allBookings : assets.flatMap(a => allBookings)).length > 0 
      ? allBookings.filter(b => b.assetId === selectedAsset.id && (b.status === "APPROVED" || b.status === "ISSUED"))
      : []; // fallback inside standard user context if full list isn't fetched, otherwise check against local cached list

    const msPerDay = 24 * 60 * 60 * 1000;
    const numDays = Math.round((requestedEnd.getTime() - requestedStart.getTime()) / msPerDay) + 1;
    
    let maxBookedOnAnyDay = 0;
    let worstDayString = "";

    for (let i = 0; i < numDays; i++) {
      const checkDate = new Date(requestedStart.getTime() + i * msPerDay);
      checkDate.setHours(12, 0, 0, 0);

      const dayTotal = currentActive
        .filter(b => {
          const bStart = new Date(b.startDate);
          bStart.setHours(12, 0, 0, 0);
          const bEnd = new Date(b.endDate);
          bEnd.setHours(12, 0, 0, 0);
          return checkDate >= bStart && checkDate <= bEnd;
        })
        .reduce((sum, b) => sum + b.quantity, 0);

      if (dayTotal > maxBookedOnAnyDay) {
        maxBookedOnAnyDay = dayTotal;
        worstDayString = checkDate.toISOString().split("T")[0];
      }
    }

    const availableSpace = selectedAsset.totalQuantity - maxBookedOnAnyDay;
    if (availableSpace < quantity) {
      setBookingClashMessage({
        type: "clash",
        text: `Overbook Clash: Only ${availableSpace} units are available. ${maxBookedOnAnyDay}/${selectedAsset.totalQuantity} already booked around ${worstDayString || 'selected date'}.`
      });
    } else {
      setBookingClashMessage({
        type: "safe",
        text: `Resource Available: Great! All ${quantity} units are fully secure. (${availableSpace} free in this timeline)`
      });
    }
  };

  // Create or Update asset (Admin only)
  const handleAssetFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: assetForm.name,
        category: assetForm.category,
        description: assetForm.description,
        totalQuantity: Number(assetForm.totalQuantity),
        condition: assetForm.condition
      };

      if (assetForm.id) {
        // Edit Action
        await apiFetch(`/api/assets/${assetForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        triggerSuccess(`Asset detail '${assetForm.name}' updated successfully.`);
      } else {
        // Create Action
        await apiFetch(`/api/assets`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        triggerSuccess(`Successfully introduced '${assetForm.name}' to the active inventory.`);
      }

      setActiveModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to process asset transaction.");
    }
  };

  // Delete inventory line asset (Admin only)
  const handleDeleteAsset = async (id: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete '${name}' from inventory?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/assets/${id}`, {
        method: "DELETE"
      });
      triggerSuccess(`Successfully removed asset '${name}' from catalog.`);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete asset. Ensure no active bookings are coupled with this unit.");
    }
  };

  // Request high-integrity asset booking (Student Consumer)
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(null);
    
    try {
      const payload = {
        assetId: selectedAsset.id,
        quantity: Number(bookingForm.quantity),
        startDate: bookingForm.startDate,
        endDate: bookingForm.endDate,
        notes: bookingForm.notes
      };

      await apiFetch(`/api/bookings`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      triggerSuccess(`Your request for ${bookingForm.quantity}x '${selectedAsset.name}' has been lodged successfully!`);
      setActiveModal(null);
      
      // Reset form variables
      setBookingForm({
        quantity: 1,
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        notes: ""
      });
      setBookingClashMessage(null);

      // Refresh data
      loadData();
    } catch (err: any) {
      setError(err.message || "Could not reserve. Please resolve calendar date clashes.");
    }
  };

  // Process Approval Workflows State Transitions (Admin only)
  const handleUpdateBookingStatus = async (bookingId: string, transitionStatus: BookingStatus) => {
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: transitionStatus })
      });
      triggerSuccess(`Booking status marked as: ${transitionStatus}`);
      loadData();
    } catch (err: any) {
      setError(err.message || "Approval transaction rejected.");
    }
  };

  // Return Physical Handover inspect processing
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setError(null);
    try {
      await apiFetch(`/api/bookings/${selectedBooking.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RETURNED",
          returnStatus: returnForm.status,
          notes: `${returnForm.notes}. Status of item: ${returnForm.status}.${returnForm.status === "DAMAGED" ? ` Damage: ${returnForm.damageDescription}` : ""}`
        })
      });

      triggerSuccess(`Asset physical check-in recorded. Return state: ${returnForm.status}`);
      setActiveModal(null);
      setSelectedBooking(null);
      setReturnForm({ status: "EXCELLENT", damageDescription: "", notes: "" });
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed check-in transaction.");
    }
  };

  // Submit manual asset health issue damage report (Both client/admin Roles)
  const handleReportIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.assetId || !issueForm.issueDescription) {
      setError("Please complete all reported fields.");
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/maintenance`, {
        method: "POST",
        body: JSON.stringify({
          assetId: issueForm.assetId,
          issueDescription: issueForm.issueDescription
        })
      });
      triggerSuccess("Issue lodged successfully. Asset status has been marked as MAINTENANCE.");
      setIssueForm({ assetId: "", issueDescription: "" });
      setActiveModal(null);
      loadData();
    } catch (err: any) {
      setError(err.message || "Submission failed.");
    }
  };

  // Clean Resolve Maintenance (Admin only)
  const handleResolveMaintenance = async (logId: string, restoreCondition: string) => {
    setError(null);
    try {
      await apiFetch(`/api/maintenance/${logId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ condition: restoreCondition || "Excellent (Serviced)" })
      });
      triggerSuccess("Issue marked as resolved. Asset returned to HEALTHY status.");
      loadData();
    } catch (err: any) {
      setError(err.message || "Resolution update failed.");
    }
  };

  // Export borrowing ledger history to Microsoft Excel-compatible CSV format
  const exportReservationsToCSV = () => {
    const headers = [
      "Booking ID",
      "Borrower Name",
      "Borrower Email",
      "Equipment Name",
      "Category",
      "Quantity Borrowed",
      "Borrow Start Date",
      "Return Date Given (Due Date)",
      "Current Status",
      "When Returned (Actual)"
    ];

    const dataToExport = user?.role === "ADMIN" ? allBookings : myBookings;

    const rows = dataToExport.map(b => {
      const actualReturnDate = b.returnedAt 
        ? new Date(b.returnedAt).toLocaleString() 
        : b.status === "RETURNED" 
        ? "Returned (Timestamp N/A)" 
        : "Not returned yet";

      return [
        b.id,
        `"${(b.userName || "").replace(/"/g, '""')}"`,
        `"${(b.userEmail || "").replace(/"/g, '""')}"`,
        `"${(b.assetName || "").replace(/"/g, '""')}"`,
        `"${(b.assetCategory || "").replace(/"/g, '""')}"`,
        b.quantity,
        b.startDate,
        b.endDate,
        b.status,
        `"${actualReturnDate}"`
      ];
    });

    // Construct spreadsheet content with carriage returns and byte order mark (BOM)
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeName = user?.name ? user.name.replace(/\s+/g, '_') : "IIT_Asset_Ledger";
    link.setAttribute("download", `${safeName}_Borrowing_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess("Excel borrowing spreadsheet exported and downloaded successfully!");
  };

  // Simulated Beep Scan Handler (allows admins or users to instantly execute handovers upon scanning asset tags)
  const handleSimulateQRScan = (tagId: string) => {
    setScanResult(tagId);
    const matchedAsset = assets.find(a => a.id === tagId || a.qrCode === tagId);
    if (!matchedAsset) {
      setError("Invalid scanned tag. Resource item not recognized.");
      return;
    }
    
    // Find relevant active bookings to handle instant issuance / return process
    const assetBookings = (user?.role === "ADMIN" ? allBookings : myBookings).filter(b => b.assetId === matchedAsset.id);
    
    // Prioritize active handovers logic:
    // If a student has an APPROVED reservation, scan to ISSUE immediately.
    // If a student has an ISSUED reservation, scan to RETURN instantly.
    const approvedRequest = assetBookings.find(b => b.status === "APPROVED");
    const issuedRequest = assetBookings.find(b => b.status === "ISSUED");

    if (user?.role === "ADMIN") {
      if (issuedRequest) {
        // Prompt return inspection flow
        setSelectedBooking(issuedRequest);
        setReturnForm({ status: "EXCELLENT", damageDescription: "", notes: "Scanned return via system tag" });
        setActiveModal("return-inspect");
        setSimulatedScanMode(false);
      } else if (approvedRequest) {
        // Fast-track issue state
        handleUpdateBookingStatus(approvedRequest.id, "ISSUED");
        setSimulatedScanMode(false);
      } else {
        // General QR code card display
        setSelectedAsset(matchedAsset);
        setActiveModal("qr-card");
        setSimulatedScanMode(false);
      }
    } else {
      // User Context: Show item specifications or reservation helper
      setSelectedAsset(matchedAsset);
      setActiveModal("qr-card");
      setSimulatedScanMode(false);
    }
  };

  // Color mapper helper based on inventory status
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "HEALTHY": return "bg-green-50 text-green-700 border-green-200";
      case "MAINTENANCE": return "bg-amber-50 text-amber-700 border-amber-200";
      case "RETIRED": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getBookingStatusStyle = (status: BookingStatus) => {
    switch (status) {
      case "PENDING": return "bg-amber-50 text-amber-700 border-amber-200";
      case "APPROVED": return "bg-sky-50 text-sky-700 border-sky-200";
      case "REJECTED": return "bg-rose-50 text-rose-700 border-rose-200";
      case "ISSUED": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "RETURNED": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  // Formatted category filters list
  const categoriesList = ["All", "Cameras & Optics", "Audio Systems", "Stage Props", "Lighting"];

  // Search filter core logic
  const filteredAssets = assets.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesStatus = selectedStatus === "All" || item.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Render authentic pixel-art style simulated SVG QR code tag high contrast
  const drawSimulatedQRCodeSVG = (codeText: string) => {
    return (
      <svg viewBox="0 0 100 100" className="w-40 h-40 border-4 border-white shadow-md bg-white">
        {/* QR Borders and simulated elements */}
        <rect x="5" y="5" width="25" height="25" fill="black" />
        <rect x="10" y="10" width="15" height="15" fill="white" />
        <rect x="12" y="12" width="11" height="11" fill="black" />

        <rect x="70" y="5" width="25" height="25" fill="black" />
        <rect x="75" y="10" width="15" height="15" fill="white" />
        <rect x="77" y="12" width="11" height="11" fill="black" />

        <rect x="5" y="70" width="25" height="25" fill="black" />
        <rect x="10" y="75" width="15" height="15" fill="white" />
        <rect x="12" y="77" width="11" height="11" fill="black" />

        {/* Dynamic pixel matrices simulation generated purely on string hash */}
        {Array.from({ length: 12 }).map((_, r) => {
          const rowY = 32 + r * 3;
          return Array.from({ length: 12 }).map((_, c) => {
            const colX = 32 + c * 3;
            // Pseudorandom grid points selection based on text string hash
            const characterCode = codeText.charCodeAt((r + c) % codeText.length) || 42;
            const drawPixel = (characterCode * (r + 17) * (c + 23)) % 3 === 0;
            return drawPixel ? (
              <rect 
                key={`${r}-${c}`} 
                x={colX} 
                y={rowY} 
                width="3" 
                height="3" 
                fill="black" 
              />
            ) : null;
          });
        })}

        {/* Small aesthetic tags */}
        <rect x="45" y="15" width="6" height="6" fill="black" />
        <rect x="15" y="45" width="6" height="6" fill="black" />
        <rect x="80" y="45" width="6" height="6" fill="black" />
        <rect x="45" y="80" width="6" height="6" fill="black" />
      </svg>
    );
  };

  // If unauthorized state
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center p-4">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden">
      
      {/* Top Banner Status Info bar for overbooking prevention feedback */}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-white border-l-4 border-green-500 rounded-r-xl shadow-lg p-4 animate-bounce max-w-md">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400">System Success</p>
            <p className="text-sm font-semibold text-slate-700">{actionSuccess}</p>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600 ml-auto pl-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main error layout overlay */}
      {error && (
        <div className="m-4 mx-8 bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm">Operation Alert Constraints</h4>
            <p className="text-xs mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800 font-bold text-xs uppercase underline">Dismiss</button>
        </div>
      )}

      {/* Top Navigation */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-sm" id="main-nav">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
            </div>
            <span className="font-bold text-lg tracking-tight">
              AssetPro <span className="text-blue-600">IITR</span>
            </span>
          </div>
          
          <div className="flex gap-4 md:gap-6 text-sm font-medium text-slate-500">
            <button 
              id="tab-dashboard"
              onClick={() => setActiveTab("dashboard")} 
              className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "dashboard" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
            >
              Dashboard
            </button>
            <button 
              id="tab-inventory"
              aria-label="inventory catalog page link"
              onClick={() => setActiveTab("inventory")} 
              className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "inventory" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
            >
              Inventory Catalog
            </button>
            {user.role === "ADMIN" ? (
              <>
                <button 
                  id="tab-bookings-admin"
                  onClick={() => setActiveTab("bookings")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "bookings" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  Booking Requests
                </button>
                <button 
                  id="tab-health-admin"
                  onClick={() => setActiveTab("health")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "health" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  Equipment Health
                </button>
                <button 
                  id="tab-audit-admin"
                  onClick={() => setActiveTab("audit")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "audit" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  Audit Trails
                </button>
              </>
            ) : (
              <>
                <button 
                  id="tab-mybookings-user"
                  onClick={() => setActiveTab("my-bookings")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "my-bookings" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  My Borrowings
                </button>
                <button 
                  id="tab-health-student"
                  onClick={() => setActiveTab("health")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "health" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  Equipment Health
                </button>
                <button 
                  id="tab-report-user"
                  onClick={() => setActiveTab("report-issue")} 
                  className={`hover:text-blue-600 py-1 cursor-pointer transition-all ${activeTab === "report-issue" ? "text-blue-600 border-b-2 border-blue-600 font-bold" : ""}`}
                >
                  Report Damage
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Right user info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 py-1 px-3 rounded-xl">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ${user.role === 'ADMIN' ? 'bg-amber-500' : 'bg-blue-600'}`}>
              {user.name.charAt(0)}
            </div>
            <div className="text-left hidden md:block select-none">
              <p className="text-xs font-semibold text-slate-800 leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">{user.role} workspace</p>
            </div>
          </div>

          <button 
            id="button-logout"
            onClick={handleLogout} 
            title="Sign out of portal"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 cursor-pointer transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>

      {/* Main Content Layout Panel */}
      <main className="p-8 flex-grow flex flex-col gap-8">
        
        {/* Loading Indicator */}
        {loading && !assets.length && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Querying live platform registries...</p>
          </div>
        )}

        {/* TAB 1: ADMIN DASHBOARD */}
        {activeTab === "dashboard" && user.role === "ADMIN" && (
          <div className="flex flex-col gap-6" id="admin-dashboard-view">
            
            {/* KPI Counts Container */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Assets Catalogued</p>
                  <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{stats?.totalAssets ?? assets.length}</h3>
                </div>
                <div className="mt-3 flex items-center text-[10px] text-slate-400 gap-1.5 border-t border-slate-100 pt-3">
                  <Box className="h-3.5 w-3.5 text-blue-500" />
                  <span>Items pooled inside the Cultural Council</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Collateral Issues</p>
                  <h3 className="text-3xl font-extrabold text-indigo-600 tracking-tight">{stats?.activeBookings ?? allBookings.filter(b => b.status === "ISSUED").length}</h3>
                </div>
                <button 
                  onClick={() => setActiveTab("bookings")}
                  className="mt-3 font-semibold text-[10px] text-blue-500 text-left hover:underline uppercase tracking-wider border-t border-slate-100 pt-3 flex items-center gap-1 cursor-pointer"
                >
                  Review reservations <span className="font-bold">→</span>
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pending Approvals</p>
                  <h3 className="text-3xl font-extrabold text-amber-500 tracking-tight">{stats?.pendingApprovals ?? allBookings.filter(b => b.status === "PENDING").length}</h3>
                </div>
                <button 
                  onClick={() => setActiveTab("bookings")}
                  className="mt-3 font-semibold text-[10px] text-amber-600 text-left hover:underline uppercase tracking-wider border-t border-slate-100 pt-3 flex items-center gap-1 cursor-pointer"
                >
                  Verify authorization needs <span className="font-bold">→</span>
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Overdue Returns Count</p>
                  <h3 className="text-3xl font-extrabold text-red-500 tracking-tight">
                    {allBookings.filter(b => b.status === "ISSUED" && new Date(b.endDate) < new Date()).length}
                  </h3>
                </div>
                <div className="mt-3 flex items-center text-[10px] text-red-500 gap-1.5 border-t border-slate-100 pt-3 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Physical check-in deadlines violated</span>
                </div>
              </div>
            </div>

            {/* Quick Action Simulated handheld QR Code Beep checkin/checkout scanner */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-xl">
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[9px] uppercase tracking-widest font-black py-0.5 px-2 rounded-full">PHYSICAL HANDOVER SCAN ENGINE (MOCKED)</span>
                  <h2 className="font-extrabold text-xl mt-2 tracking-tight">Tag QR Code Scanner Desk</h2>
                  <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                    Instantly book handovers or confirm returns by typing the asset's tagged QR code ID (e.g. <b>asset-sony-fx3</b> or <b>asset-senn-mic</b>) or click <b>"Physical Beep Code"</b> next to any item in the Inventory Catalog.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <input 
                    id="scan-input-manual"
                    type="text" 
                    placeholder="Enter asset code: 'asset-sony-fx3'"
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 w-full sm:w-64 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSimulateQRScan((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById("scan-input-manual") as HTMLInputElement;
                      if (input && input.value) {
                        handleSimulateQRScan(input.value);
                        input.value = "";
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase px-4 py-2 text-white rounded-lg transition-all w-full sm:w-auto cursor-pointer"
                  >
                    Beep Scan Code
                  </button>
                </div>
              </div>
              <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-blue-600/10 rounded-full" />
            </div>

            {/* Recharts Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Utilization rates of assets */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-slate-800">Dynamic Asset Utilization Rates</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Calculated based on booking duration occupancy profiles</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span>Real-time pool rate</span>
                  </div>
                </div>

                <div className="h-64">
                  {stats?.assetUtilization && stats.assetUtilization.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.assetUtilization} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={30} unit="%" />
                        <Tooltip 
                          contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#fff", fontSize: "11px" }}
                          formatter={(value: any) => [`${value}% Utilization`, "Operational Rate"]}
                        />
                        <Bar dataKey="utilization" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                      Insufficient allocation history to compute statistics.
                    </div>
                  )}
                </div>
              </div>

              {/* Council Categories Pie Chart */}
              <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Category Allocation Shares</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Distribution of inventory total pieces</p>
                </div>

                <div className="h-44 my-4 flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats?.categoryDistribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {(stats?.categoryDistribution || []).map((entry, index) => {
                          const colors = ["#2563eb", "#6366f1", "#0ea5e9", "#f59e0b", "#10b981"];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5">
                  {(stats?.categoryDistribution || []).map((item, index) => {
                    const colors = ["bg-blue-600", "bg-indigo-500", "bg-sky-500", "bg-amber-500", "bg-emerald-500"];
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded ${colors[index % colors.length]}`} />
                          <span className="text-slate-600 font-medium truncate max-w-[140px]">{item.name}</span>
                        </div>
                        <span className="font-mono text-slate-500 font-bold">{item.value} units</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lower panel: Recent audits ticker for admin review */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-slate-800">Operational Log Feed</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Audited pipeline updates from security modules</p>
                </div>
                <button 
                  onClick={() => setActiveTab("audit")}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Inspect Complete Audit History (Full Logs)
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="flex gap-3">
                      <div className="bg-slate-100 rounded p-1.5 shrink-0 mt-0.5">
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-mono text-slate-800 text-xs font-semibold">
                          <span className="font-sans bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[10px] font-bold mr-1.5">{log.action}</span>
                          {log.details}
                        </p>
                        <p className="text-slate-400 mt-1 flex items-center gap-2 text-[10px]">
                          <span>Issuer: {log.userEmail}</span>
                          <span>•</span>
                          <span>Target: {log.targetName}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-slate-400 shrink-0 font-mono text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 1 STUDENT: USER GENERAL DASHBOARD */}
        {activeTab === "dashboard" && user.role === "USER" && (
          <div className="flex flex-col gap-6" id="student-dashboard-view">
            
            <div className="bg-zinc-900 text-white rounded-2xl p-8 relative overflow-hidden shadow-lg border border-zinc-800">
              <div className="relative z-10 max-w-2xl">
                <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 text-[9px] uppercase tracking-widest font-black py-0.5 px-2 rounded-full">IITR CULTURAL COUNCIL HUB</span>
                <h1 className="text-4xl font-black mt-3 tracking-tight">Welcome to Council Asset Allocator</h1>
                <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                  Avoid overlap clashes! Request camera kit, stage props, and wireless microphone audio systems directly. Handover authorization states are updated in real-time. Contact Admin at MAC Office for physical collections.
                </p>
                
                <div className="mt-6 flex flex-wrap gap-3">
                  <button 
                    onClick={() => setActiveTab("inventory")}
                    className="bg-white hover:bg-slate-100 text-zinc-900 font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Browse Equipment List
                  </button>
                  <button 
                    onClick={() => setActiveTab("my-bookings")}
                    className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 font-bold text-xs uppercase tracking-wider py-2.5 px-5 rounded-lg transition-all cursor-pointer"
                  >
                    My Active Bookings
                  </button>
                </div>
              </div>
              {/* Decorative design vector */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/5 rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-400/5 rounded-full" />
            </div>

            {/* Quick stats for students */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex items-start gap-4">
                <div className="bg-sky-100 text-sky-600 rounded-xl p-2 shrink-0">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Approved Reservoirs</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {myBookings.filter(b => b.status === "APPROVED").length} Units
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Ready for physical handover at Council Desk</p>
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex items-start gap-4">
                <div className="bg-amber-100 text-amber-600 rounded-xl p-2 shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pending Authorization</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {myBookings.filter(b => b.status === "PENDING").length} Units
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Awaiting coordinator availability verify check</p>
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex items-start gap-4">
                <div className="bg-indigo-100 text-indigo-600 rounded-xl p-2 shrink-0">
                  <ArrowRightLeft className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rentals On Hand (Active)</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {myBookings.filter(b => b.status === "ISSUED").length} Units
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Check return deadlines inside timeline logs</p>
                </div>
              </div>

            </div>

            {/* Personal timelines snapshot panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800">Your Current Booking Timeline Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Track collections, approvals, and physical statuses</p>
              
              <div className="mt-5 space-y-4">
                {myBookings.slice(0, 4).map((row) => {
                  const daysLeft = Math.max(0, Math.round((new Date(row.endDate).getTime() - new Date().getTime()) / (24*60*60*1000)));
                  return (
                    <div key={row.id} className="border border-slate-100 hover:border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 text-xs transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{row.assetName}</span>
                          <span className={`px-2 py-0.5 border text-[10px] font-mono rounded-full uppercase font-bold ${getBookingStatusStyle(row.status)}`}>
                            {row.status}
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Quantity requested: <b>{row.quantity}x</b></span>
                          <span>•</span>
                          <span>Start Date: {row.startDate}</span>
                          <span>•</span>
                          <span>End Date: {row.endDate}</span>
                        </p>
                      </div>

                      <div className="flex sm:items-center justify-between md:justify-end gap-4 shrink-0">
                        {row.status === "ISSUED" && (
                          <div className="text-right">
                            {new Date(row.endDate) < new Date() ? (
                              <span className="text-red-500 font-bold bg-red-50 border border-red-200 rounded px-2.5 py-1 uppercase text-[10px]">Overdue Return!</span>
                            ) : (
                              <span className="text-slate-500 font-medium">{daysLeft} days remaining</span>
                            )}
                          </div>
                        )}
                        
                        {(row.status === "APPROVED" || row.status === "PENDING") && (
                          <button 
                            onClick={async () => {
                              if(window.confirm("Cancel this booking application?")) {
                                handleUpdateBookingStatus(row.id, "REJECTED");
                              }
                            }}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 font-semibold px-3 py-1.5 rounded-lg text-slate-600 transition"
                          >
                            Cancel Application
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {myBookings.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No matching booking history found. Launch the Catalogue tab to secure a rental.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: INVENTORY CATALOG & RESERVATION SLOTS */}
        {activeTab === "inventory" && (
          <div className="flex flex-col gap-6" id="inventory-catalog-panel">
            
            {/* Catalog search and control headers */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              
              {/* Search bar inputs */}
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  id="catalog-search-field"
                  type="text" 
                  placeholder="Search cameras, audio equipment, stage props..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              {/* Filtering drop down pills */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-3 rounded-xl max-w-full">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select 
                    id="catalog-category-filter"
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs font-semibold text-slate-600 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-3 rounded-xl">
                  <span className="text-slate-400 text-xs">Status:</span>
                  <select 
                    id="catalog-status-filter"
                    value={selectedStatus} 
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="text-xs font-semibold text-slate-600 bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="HEALTHY">HEALTHY</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="RETIRED">RETIRED</option>
                  </select>
                </div>

                {user.role === "ADMIN" && (
                  <button 
                    id="add-asset-button"
                    onClick={() => {
                      setAssetForm({ id: "", name: "", category: "Cameras & Optics", description: "", totalQuantity: 2, condition: "Excellent" });
                      setActiveModal("add-asset");
                    }}
                    className="bg-blue-600 hover:bg-blue-500 font-bold text-xs uppercase tracking-wider py-2 px-4 rounded-xl text-white ml-auto flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Asset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inventory catalog dynamic list mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="assets-grid">
              {filteredAssets.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow transition-all flex flex-col justify-between">
                  <div>
                    {/* Upper Category Badges */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded px-2.5 py-1 text-xs truncate max-w-[150px]">
                        {item.category}
                      </span>
                      <span className={`border text-[9px] font-black uppercase rounded p-1 px-2 ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-extrabold text-slate-800 text-base leading-tight tracking-tight">{item.name}</h3>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed line-clamp-3 min-h-[48px]">{item.description}</p>
                    
                    {/* Metadata table constraints */}
                    <div className="mt-4 border-t border-b border-slate-50 py-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Physical Wear Standard:</span>
                        <span className="text-slate-700 font-semibold">{item.condition}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-100/50 p-1.5 rounded border border-slate-100">
                        <span className="text-slate-400 font-bold text-[10px]">SYSTEM TOTAL CAPACITY:</span>
                        <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.2 rounded">{item.totalQuantity} Units</span>
                      </div>
                      <div className="flex justify-between items-center p-1 font-semibold">
                        <span className="text-blue-600 font-bold text-[10px] uppercase">Immediate Available Count:</span>
                        <span className="font-mono text-sm font-black text-blue-700">{item.availableQuantity} Free</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    {/* QR Code trigger button */}
                    <button 
                      onClick={() => {
                        setSelectedAsset(item);
                        setActiveModal("qr-card");
                      }}
                      title="Inspect Asset QR System Tag"
                      className="border border-slate-200 hover:bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-slate-800 transition shrink-0 cursor-pointer"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>

                    {user.role === "ADMIN" && (
                      <button 
                        onClick={() => handleSimulateQRScan(item.id)}
                        className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white stroke-2 p-2 rounded-xl text-[10px] uppercase font-bold shrink-0 cursor-pointer flex items-center gap-1 leading-none"
                        title="Simulate hardware bar code beep gun scan"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                        <span>Beep Gun</span>
                      </button>
                    )}

                    {user.role === "ADMIN" ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <button 
                          onClick={() => {
                            setAssetForm({
                              id: item.id,
                              name: item.name,
                              category: item.category,
                              description: item.description,
                              totalQuantity: item.totalQuantity,
                              condition: item.condition
                            });
                            setActiveModal("add-asset");
                          }}
                          className="border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteAsset(item.id, item.name)}
                          className="border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-500 p-2 rounded-xl cursor-pointer transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setSelectedAsset(item);
                          setBookingForm({
                            quantity: 1,
                            startDate: new Date().toISOString().split("T")[0],
                            endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                            notes: ""
                          });
                          setActiveModal("booking");
                        }}
                        disabled={item.status === "RETIRED"}
                        className={`font-black text-xs uppercase py-2 px-4 rounded-xl ml-auto cursor-pointer shadow-sm transition-all flex items-center gap-2 ${
                          item.status === "MAINTENANCE" 
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200"
                          : item.status === "RETIRED"
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{item.status === "MAINTENANCE" ? "Reported Damage (Book Anyway)" : "Request Booking"}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredAssets.length === 0 && (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
                  No matching assets found within selected category/filter query.
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: ADMIN BOOKING APPROVAL WORKFLOWS */}
        {activeTab === "bookings" && user.role === "ADMIN" && (
          <div className="flex flex-col gap-6" id="bookings-administration-screen">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-800">Student Booking Requests & physical collection queues</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Approve incoming, dispatch physically, or record checkout returns</p>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <button 
                    id="button-export-excel"
                    onClick={exportReservationsToCSV}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Export to Excel</span>
                  </button>
                  <button 
                    id="button-sync-db"
                    onClick={loadData}
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-blue-600 cursor-pointer transition flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Sync DB</span>
                  </button>
                </div>
              </div>

              {/* Grid tabular layout */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-400 bg-slate-50 border-b border-slate-200 font-bold">
                      <th className="px-6 py-3 font-extrabold">Student Info</th>
                      <th className="px-6 py-3 font-extrabold">Asset & Shares</th>
                      <th className="px-6 py-3 font-extrabold">Proposed Timelines</th>
                      <th className="px-6 py-3 font-extrabold">Status Stage</th>
                      <th className="px-6 py-3 font-extrabold text-right">Workflow State Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {allBookings.map((b) => {
                      const isOverdue = b.status === "ISSUED" && new Date(b.endDate) < new Date();
                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 text-sm leading-tight">{b.userName}</p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">{b.userEmail}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{b.assetName}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Quantity demanded: <span className="font-bold font-mono bg-slate-100 rounded px-1">{b.quantity} item(s)</span></p>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium">
                            <div className="flex items-center gap-1 text-slate-600">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{b.startDate} to {b.endDate}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Requested on: {new Date(b.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-full uppercase ${getBookingStatusStyle(b.status)}`}>
                                {b.status}
                              </span>
                              {isOverdue && (
                                <span className="text-[9px] bg-red-100 text-red-600 font-bold border border-red-200 px-1.5 py-0.2 rounded uppercase animate-pulse">Overdue Return!</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {/* Workflow state transitions */}
                            <div className="flex items-center justify-end gap-1.5">
                              {b.status === "PENDING" && (
                                <>
                                  <button 
                                    onClick={() => handleUpdateBookingStatus(b.id, "APPROVED")}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateBookingStatus(b.id, "REJECTED")}
                                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-[11px] px-3 py-1.5 rounded-lg transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {b.status === "APPROVED" && (
                                <button 
                                  onClick={() => handleUpdateBookingStatus(b.id, "ISSUED")}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-lg transition"
                                >
                                  Physical Issue
                                </button>
                              )}

                              {b.status === "ISSUED" && (
                                <button 
                                  onClick={() => {
                                    setSelectedBooking(b);
                                    setReturnForm({ status: "EXCELLENT", damageDescription: "", notes: "" });
                                    setActiveModal("return-inspect");
                                  }}
                                  className="bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-lg transition"
                                >
                                  Collect Return
                                </button>
                              )}

                              {b.status === "RETURNED" && (
                                <span className="text-slate-400 font-medium text-xs italic">
                                  Closed Return ({b.returnStatus || "Excellent"})
                                </span>
                              )}

                              {b.status === "REJECTED" && (
                                <span className="text-red-400 font-medium text-xs">Declined / Revoked</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {allBookings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No booking records created in system.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3 STUDENT: USER BOOKING HISTORY AND TIMELINE */}
        {activeTab === "my-bookings" && user.role === "USER" && (
          <div className="flex flex-col gap-6" id="personal-bookings-tracker">
            
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-800">Your Cult-Council Allocation Logbook</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Personal tracking history of physical collections</p>
                </div>
                <button 
                  id="button-export-excel-student"
                  onClick={exportReservationsToCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Export to Excel</span>
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {myBookings.map((b) => (
                  <div key={b.id} className="border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition flex flex-col gap-4">
                    {/* Upper */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center font-bold text-slate-600 shrink-0">
                          {b.quantity}x
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm leading-none">{b.assetName}</h4>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest block mt-1">Ref ID No: {b.id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 border text-[10px] font-black rounded-full uppercase ${getBookingStatusStyle(b.status)}`}>
                          {b.status}
                        </span>
                      </div>
                    </div>

                    {/* Timeline bar animation to visualize full physical status cycle */}
                    <div className="mt-1 flex items-center w-full justify-between gap-2 relative bg-slate-100 rounded-full h-1.5 overflow-visible">
                      <div className={`h-full bg-blue-600 rounded-full transition-all`} style={{
                        width: b.status === "PENDING" ? "25%" : b.status === "APPROVED" ? "50%" : b.status === "ISSUED" ? "75%" : "100%"
                      }} />
                      
                      {/* Timeline Nodes */}
                      <span className="absolute left-[0%] -top-1.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" title="Requested" />
                      <span className={`absolute left-[33%] -top-1.5 w-4.5 h-4.5 rounded-full border-2 border-white shadow-xs ${
                        b.status !== "PENDING" && b.status !== "REJECTED" ? "bg-blue-600" : "bg-slate-300"
                      }`} title="Approved" />
                      <span className={`absolute left-[66%] -top-1.5 w-4.5 h-4.5 rounded-full border-2 border-white shadow-xs ${
                        b.status === "ISSUED" || b.status === "RETURNED" ? "bg-indigo-600" : "bg-slate-300"
                      }`} title="Physically Handed Over" />
                      <span className={`absolute left-[100%] -translate-x-[18px] -top-1.5 w-4.5 h-4.5 rounded-full border-2 border-white shadow-xs ${
                        b.status === "RETURNED" ? "bg-emerald-500" : "bg-slate-300"
                      }`} title="Returned Clean" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-500 mt-1 pt-3 border-t border-slate-50">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">LODGED ON:</span>
                        <span className="text-slate-700">{new Date(b.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">START PERIOD:</span>
                        <span className="text-slate-700">{b.startDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">END DEADLINE:</span>
                        <span className={`${new Date(b.endDate) < new Date() && b.status === 'ISSUED' ? 'text-red-500 font-bold' : 'text-slate-700'}`}>
                          {b.endDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">RESERVATION NOTES:</span>
                        <span className="text-slate-700 block truncate" title={b.notes}>{b.notes || "No notes."}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {myBookings.length === 0 && (
                  <div className="bg-slate-50 text-slate-400 text-xs text-center py-12 rounded-xl border border-slate-100">
                    No borrowing transactions on this profile yet. Use the <b>"Inventory Catalog"</b> tab at the top to apply for one.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: EQUIPMENT HEALTH & MAINTENANCE */}
        {activeTab === "health" && (
          <div className="flex flex-col gap-6" id="equipment-health-view-admin">
            
            {/* Active maintenance list logging updates */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-800">Asset Health & Damage Maintenance logs</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Inspect physical repair statuses of reported equipment</p>
                </div>
                
                <button 
                  onClick={() => {
                    setIssueForm({ assetId: assets[0]?.id || "", issueDescription: "" });
                    setActiveModal("report-issue");
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Report Damage Entry</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {maintenanceLogs.map((log) => (
                  <div key={log.id} className="py-4 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{log.assetName}</h4>
                        <span className={`px-2 py-0.5 border text-[9px] font-mono rounded uppercase font-bold ${
                          log.status === "OPEN" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      
                      <p className="text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 p-2.5 rounded-lg max-w-2xl text-xs flex items-start gap-1 font-mono">
                        <span className="font-sans font-bold text-slate-400 mr-2 uppercase block shrink-0 text-[10px] mt-0.5">Problem reported:</span>
                        <span>{log.issueDescription}</span>
                      </p>

                      <div className="text-[10px] text-slate-400 mt-2 flex flex-wrap items-center gap-3">
                        <span>Report Ref: {log.id}</span>
                        <span>•</span>
                        <span>Reported by: {log.reportedBy}</span>
                        <span>•</span>
                        <span>Date registered: {new Date(log.reportedAt).toLocaleString()}</span>
                        {log.resolvedAt && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-bold">Resolved At: {new Date(log.resolvedAt).toLocaleString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {log.status === "OPEN" && (
                      <button 
                        onClick={() => {
                          setSelectedLog(log);
                          setRepairConditionText("Excellent (Repaired)");
                          setActiveModal("resolve-maintenance");
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase px-3 py-2 rounded-lg transition shrink-0 cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" />
                        <span>Confirm Repaired</span>
                      </button>
                    )}
                  </div>
                ))}

                {maintenanceLogs.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No active maintenance log tickets registered with council database.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4 STUDENT: USER DAMAGE ISSUE REPORT ENTRY */}
        {((activeTab === "report-issue" && user.role === "USER") || activeTab === "report-issue") && (
          <div className="flex justify-center" id="report-damage-form-screen">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm w-full max-w-xl">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="font-extrabold text-slate-800 text-lg">Report Equipment Malfunction / Damage</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Are some camera sliders broken or has a speaker started humming? Register the specific defect instantly so administrators can withdraw items for maintenance checks. Keep IITR inventory clean and safe!
              </p>

              <form onSubmit={handleReportIssueSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Select Broken Equipment</label>
                  <select 
                    id="report-issue-asset-select"
                    value={issueForm.assetId}
                    onChange={(e) => setIssueForm({ ...issueForm, assetId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-slate-50 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose asset from list --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} (Total count: {a.totalQuantity})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Description of damage or missing components</label>
                  <textarea 
                    id="report-issue-description-input"
                    rows={4}
                    placeholder="Provide actionable information. Examples: Lens filter thread is broken; battery back latch does not stay locked; low power grid flickers..."
                    value={issueForm.issueDescription}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDescription: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <button 
                  id="report-issue-submit-button"
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition cursor-pointer"
                >
                  Submit Incident Damage Report
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: ADMIN AUDIT TRAILS LOG DATASTREAM */}
        {activeTab === "audit" && user.role === "ADMIN" && (
          <div className="flex flex-col gap-6" id="system-audit-history-screen">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-extrabold text-slate-800">Comprehensive System Audit History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Read-Only persistent tracking logs detailing database states and reservations</p>
                </div>
                <div className="bg-slate-100 border border-slate-200 text-slate-600 rounded-lg p-2 text-xs font-mono">
                  Current Session: Mock-Prisma DB lock live
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border border-slate-100 hover:border-slate-200 rounded-xl p-4 flex justify-between items-start gap-4 text-xs transition-all bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-slate-800 text-white px-2 py-0.5 rounded font-black text-[10px] tracking-wide uppercase">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-800 pr-2">Target: {log.targetName}</span>
                      </div>
                      
                      <p className="text-slate-600 mt-1.5 text-xs font-medium">{log.details}</p>
                      
                      <div className="text-[10px] text-slate-400 mt-1 flex gap-3">
                        <span>LODGED BY: {log.userEmail}</span>
                        <span>•</span>
                        <span>UID: {log.id}</span>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] shrink-0 text-slate-400 font-bold">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}

                {auditLogs.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No matching audit trails pooled.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer Info inside main context */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-medium font-sans gap-4 shrink-0">
        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>State Pipeline: 100% Operational (SQLite Emulated Sandbox)</span>
          </span>
          <span>Last Platform Audit: June 05, 2026</span>
        </div>
        <div>Managed by Cultural Council Board & Dean of Students Welfare (DoSW), IIT Roorkee</div>
      </footer>


      {/* ---------------------------- MODALS AND DRAWERS ---------------------------- */}

      {/* 1. Modal: Add & Edit Asset details panel drawer */}
      {activeModal === "add-asset" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100" id="add-asset-modal">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-base">
                {assetForm.id ? "Modify Inventory Asset Specifications" : "Register New Shared Council Equipment"}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssetFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Asset Name</label>
                <input 
                  id="asset-form-name"
                  type="text" 
                  placeholder="e.g. Sony FX3 Cinema Camera Body"
                  required
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({...assetForm, name: e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Inventory Category</label>
                  <select 
                    id="asset-form-category"
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({...assetForm, category: e.target.value})}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-slate-50 focus:outline-none"
                    required
                  >
                    <option value="Cameras & Optics">Cameras & Optics</option>
                    <option value="Audio Systems">Audio Systems</option>
                    <option value="Stage Props">Stage Props</option>
                    <option value="Lighting">Lighting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase">Max Capability (Total Quantity)</label>
                  <input 
                    id="asset-form-quantity"
                    type="number" 
                    min={1}
                    required
                    value={assetForm.totalQuantity}
                    onChange={(e) => setAssetForm({...assetForm, totalQuantity: Number(e.target.value)})}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Initial Wear / Visual Condition</label>
                <input 
                  id="asset-form-condition"
                  type="text" 
                  placeholder="e.g., Brand new out of the box / Light scuffing on chassis"
                  value={assetForm.condition}
                  onChange={(e) => setAssetForm({...assetForm, condition: e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Operational Asset Description</label>
                <textarea 
                  id="asset-form-description"
                  rows={3}
                  placeholder="Describe lenses, focal parameters, top-handles, microphones specifications..."
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({...assetForm, description: e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  id="asset-form-submit"
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl uppercase tracking-wider"
                >
                  Save Asset Detail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Booking Request & Overbooking prevention date scheduler (Student Users) */}
      {activeModal === "booking" && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100" id="booking-modal">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Schedule Asset Rental Reservation</h3>
                <p className="text-slate-400 text-xs mt-0.5">Asset: <span className="font-bold text-slate-600">{selectedAsset.name}</span></p>
              </div>
              <button onClick={() => { setActiveModal(null); setBookingClashMessage(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 space-y-4">
              
              {/* Asset quick status view */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Wear Index:</span>
                  <p className="text-slate-700 font-semibold mt-0.5">{selectedAsset.condition}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Imminent capacity:</span>
                  <p className="text-slate-700 font-bold mt-0.5">{selectedAsset.availableQuantity} of {selectedAsset.totalQuantity} units free</p>
                </div>
              </div>

              {/* OVERBOOKING PROTECTION RADAR */}
              {bookingClashMessage && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  bookingClashMessage.type === "clash" 
                  ? "bg-red-50 text-red-700 border-red-200" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {bookingClashMessage.type === "clash" ? (
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-black uppercase text-[10px] tracking-wider">Smart Calendar Overlap Radar</h4>
                    <p className="mt-1 font-medium leading-relaxed">{bookingClashMessage.text}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase">Hire Quantity Requested</label>
                  <input 
                    id="booking-form-quantity"
                    type="number" 
                    min={1}
                    max={selectedAsset.totalQuantity}
                    required
                    value={bookingForm.quantity}
                    onChange={(e) => setBookingForm({...bookingForm, quantity: Number(e.target.value)})}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Maximum library cap: {selectedAsset.totalQuantity} units</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Start reservation date</label>
                  <input 
                    id="booking-form-start-date"
                    type="date" 
                    required
                    value={bookingForm.startDate}
                    onChange={(e) => setBookingForm({...bookingForm, startDate: e.target.value})}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Estimated Return physical date</label>
                <input 
                  id="booking-form-end-date"
                  type="date" 
                  required
                  value={bookingForm.endDate}
                  onChange={(e) => setBookingForm({...bookingForm, endDate: e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Usage rationale or special notes for director approval</label>
                <textarea 
                  id="booking-form-notes"
                  rows={2}
                  placeholder="Specify event role (e.g. Thomso Promo shoot, MAC theatrical backdrops setup, debate anchoring...)"
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({...bookingForm, notes: e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setActiveModal(null); setBookingClashMessage(null); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  id="booking-form-submit-button"
                  type="submit"
                  disabled={bookingClashMessage?.type === "clash"}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
                >
                  Lodge Reservation File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Physical inspect check & Damage logger upon return handover (Admin) */}
      {activeModal === "return-inspect" && selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100" id="return-inspect-modal">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Record Physical Check-In / Handover Return</h3>
                <p className="text-slate-400 text-xs mt-0.5">Asset: <span className="font-bold text-slate-600">{selectedBooking.assetName}</span></p>
              </div>
              <button onClick={() => { setActiveModal(null); setSelectedBooking(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              
              <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3.5 rounded-xl text-xs flex gap-2.5 items-start">
                <Info className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold">Original reservation metadata:</p>
                  <p className="mt-1">
                    Borrowed by <b>{selectedBooking.userName}</b>. Quantity returned: <b>{selectedBooking.quantity} unit(s)</b>. Due deadline list was slated for {selectedBooking.endDate}.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Physical item wear status inspection</label>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <label className={`border rounded-xl p-3.5 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 transition ${
                    returnForm.status === "EXCELLENT" ? "border-emerald-500 bg-emerald-50/20" : "border-slate-200"
                  }`}>
                    <input 
                      id="return-status-excellent"
                      type="radio" 
                      name="return-wear" 
                      value="EXCELLENT"
                      checked={returnForm.status === "EXCELLENT"}
                      onChange={() => setReturnForm({ ...returnForm, status: "EXCELLENT" })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Excellent Condition</span>
                      <span className="text-[10px] text-slate-400">Clean, fully functional, minor/no scuffs</span>
                    </div>
                  </label>

                  <label className={`border rounded-xl p-3.5 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 transition ${
                    returnForm.status === "DAMAGED" ? "border-amber-500 bg-amber-50/20" : "border-slate-200"
                  }`}>
                    <input 
                      id="return-status-damaged"
                      type="radio" 
                      name="return-wear" 
                      value="DAMAGED"
                      checked={returnForm.status === "DAMAGED"}
                      onChange={() => setReturnForm({ ...returnForm, status: "DAMAGED" })}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-amber-700 block text-orange-600">Damaged / Broken</span>
                      <span className="text-[10px] text-slate-400">Needs bulb checks, glass scratches, locked locks</span>
                    </div>
                  </label>
                </div>
              </div>

              {returnForm.status === "DAMAGED" && (
                <div className="animate-in slide-in-from-top-2 duration-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Specify specific physical defects / breaks</label>
                  <textarea 
                    id="return-damage-description"
                    rows={2}
                    required
                    placeholder="e.g. Scratched lens body front element. LED panel stand locked slider knob is completely missing."
                    value={returnForm.damageDescription}
                    onChange={(e) => setReturnForm({ ...returnForm, damageDescription: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-amber-300 p-3 text-sm focus:border-amber-500 focus:outline-none bg-amber-50/10 placeholder-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Check-in comments</label>
                <input 
                  id="return-notes-input"
                  type="text" 
                  placeholder="e.g., Handed over physically to MAC coordinator office locker."
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setActiveModal(null); setSelectedBooking(null); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  id="return-submit"
                  type="submit"
                  className="px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl uppercase tracking-wider"
                >
                  Save Handover Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: High contrast asset specifications QR Card tag */}
      {activeModal === "qr-card" && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-center" id="qr-card-modal">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-left">
              <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">Physical Tag Tagging</span>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4">
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedAsset.name}</h3>
              <p className="text-[11px] text-slate-400 uppercase font-mono tracking-widest leading-none">Code: {selectedAsset.qrCode || `asset-${selectedAsset.id}`}</p>
              
              {/* Draw custom pure-react SVG design for high fidelity QR replication */}
              <div className="p-3 bg-slate-150 border border-slate-200 rounded-2xl flex items-center justify-center mt-3 bg-slate-50">
                {drawSimulatedQRCodeSVG(selectedAsset.qrCode || selectedAsset.id)}
              </div>

              <div className="text-xs text-slate-500 leading-relaxed max-w-xs mt-3">
                <span className="font-bold text-slate-700 block">IITR Cultural Council Serial Tag</span>
                Tape this printed tag onto the physical packaging. Admin checkout beep-guns scan this graphic to automate status transitions.
              </div>

              <div className="w-full flex gap-2 mt-4">
                <button 
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-xs uppercase py-2 py-2.5 rounded-xl text-xs"
                >
                  Print Tag
                </button>
                <button 
                  onClick={() => { 
                    handleSimulateQRScan(selectedAsset.qrCode || selectedAsset.id);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase py-2 py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 shadow"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Beep Gun Gun</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Resolve maintenance option form dialog */}
      {activeModal === "resolve-maintenance" && selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-100" id="resolve-maintenance-modal">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-left">
              <h3 className="font-extrabold text-slate-800 text-base">Complete Equipment Maintenance</h3>
              <button 
                onClick={() => { setActiveModal(null); setSelectedLog(null); }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 leading-relaxed">
                <p className="font-bold">Equipment: {selectedLog.assetName}</p>
                <p className="mt-1">Reported Issue: <span className="font-mono italic">"{selectedLog.issueDescription}"</span></p>
                <p className="mt-1 text-[10px] text-amber-600 font-bold uppercase">Lodged by: {selectedLog.reportedBy}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Restored Physical Condition / Repair Notes</label>
                <input 
                  id="repair-condition-input"
                  type="text" 
                  placeholder="e.g. Excellent (Serviced & checked standard operations)"
                  required
                  value={repairConditionText}
                  onChange={(e) => setRepairConditionText(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setActiveModal(null); setSelectedLog(null); }}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  id="btn-confirm-resolve-repair"
                  onClick={() => {
                    handleResolveMaintenance(selectedLog.id, repairConditionText);
                    setActiveModal(null);
                    setSelectedLog(null);
                  }}
                  className="px-6 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  Confirm Repaired
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
