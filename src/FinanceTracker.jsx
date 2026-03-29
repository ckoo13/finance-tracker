import { useState, useEffect, useCallback } from "react";
import Papa from 'papaparse';
import { supabase } from './lib/supabase';

const CATEGORIES = [
  "Housing", "Utilities", "Transportation", "Health", "Groceries",
  "Subscription", "Friends", "Education", "Entertainment", "Sports",
  "Eating Out", "Shopping", "Travel", "Family", "Girlfriend", "Income", "Other"
];

const CATEGORY_COLORS = {
  Housing: "#E8524A", Utilities: "#F59E42", Transportation: "#F7C948",
  Health: "#47B881", Groceries: "#38BEC9", Subscription: "#5B8DEF",
  Friends: "#A78BFA", Education: "#E879A8", Entertainment: "#F472B6",
  Sports: "#34D399", "Eating Out": "#FB923C", Shopping: "#C084FC",
  Travel: "#2DD4BF", Family: "#FDA4AF", Girlfriend: "#F9A8D4", Income: "#10B981", Other: "#94A3B8"
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ASSET_FIELDS = [
  { key: "401k", label: "401K" },
  { key: "coinbase", label: "Coinbase" },
  { key: "sunstone_coinvest", label: "Sunstone Co-Invest" },
  { key: "bofa_checking", label: "BofA Checking" },
  { key: "schwab", label: "Charles Schwab" },
  { key: "bofa_savings", label: "BofA Savings" },
  { key: "hsa_alphasights", label: "HSA (AlphaSights)" },
  { key: "hsa_sunstone", label: "HSA (Sunstone)" },
];

const LIABILITY_FIELDS = [
  { key: "bilt_card", label: "BILT Card" },
  { key: "amex_delta", label: "AMEX Delta" },
];

const LIQUID_KEYS = ["bofa_checking", "schwab", "bofa_savings"];

// Storage handled by Supabase

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function getMonthKey(dateStr) {
  const cleaned = dateStr.replace(/\s+/g, " ").trim();
  // MM/DD/YYYY or MM-DD-YYYY or MM/DD/YY
  const m1 = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m1) { let [, month, , year] = m1; if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year; return `${year}-${month.padStart(2, "0")}`; }
  // YYYY-MM-DD
  const m2 = cleaned.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}`;
  // MM/DD (no year) — default to current year
  const m3 = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m3) return `${new Date().getFullYear()}-${m3[1].padStart(2, "0")}`;
  return null;
}

function guessCategory(desc) {
  const d = desc.toLowerCase();
  if (/soyeon/i.test(d)) return "Girlfriend";
  if (/uber|lyft|waymo|bart|caltrain|parking|gas|fuel|shell|chevron|fastrak|muni/i.test(d)) return "Transportation";
  if (/safeway|trader|whole foods|grocery|suruki|good earth|costco|walmart/i.test(d)) return "Groceries";
  if (/doordash|grubhub|ubereats|starbucks|coffee|restaurant|cafe|pizza|chipotle|sushi|pho/i.test(d)) return "Eating Out";
  if (/netflix|spotify|hulu|disney|apple\.com\/bill|youtube|claude|chatgpt|openai|subscription/i.test(d)) return "Subscription";
  if (/amazon|target|nordstrom|nike|uniqlo|zara|best buy|apple store/i.test(d)) return "Shopping";
  if (/golf|topgolf|gym|fitness|peloton|sport/i.test(d)) return "Sports";
  if (/rent|mortgage|hoa/i.test(d)) return "Housing";
  if (/electric|pg&e|water|internet|comcast|xfinity|att|verizon|t-mobile/i.test(d)) return "Utilities";
  if (/doctor|pharmacy|cvs|walgreens|dental|medical|hospital|health|insurance/i.test(d)) return "Health";
  if (/flight|airline|hotel|airbnb|booking|expedia|united|delta|southwest/i.test(d)) return "Travel";
  if (/venmo|zelle|paypal.*friend|splitwise/i.test(d)) return "Friends";
  if (/tuition|udemy|coursera|book/i.test(d)) return "Education";
  if (/movie|concert|ticket|game|museum|show/i.test(d)) return "Entertainment";
  return "Other";
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 24px", border: "none", cursor: "pointer",
      background: active ? "#1a1a2e" : "transparent",
      color: active ? "#e0e0e0" : "#6b7280",
      fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 600,
      letterSpacing: "0.5px", textTransform: "uppercase",
      borderBottom: active ? "2px solid #5B8DEF" : "2px solid transparent",
      transition: "all 0.2s"
    }}>{children}</button>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: "#16162a", borderRadius: "12px", padding: "24px",
      border: "1px solid #252545", ...style
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <Card style={{ flex: 1, minWidth: "160px" }}>
      <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: accent || "#e0e0e0", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{sub}</div>}
    </Card>
  );
}

function BarChart({ data, height = 200, onBarClick }) {
  if (!data.length) return <div style={{ color: "#6b7280", textAlign: "center", padding: "40px" }}>No data yet</div>;
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height, padding: "0 8px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", cursor: onBarClick ? "pointer" : "default" }}
          onClick={() => onBarClick && d.value > 0 && onBarClick(d)}>
          <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}>
            {d.value >= 1000 ? `${(d.value/1000).toFixed(1)}k` : d.value.toFixed(0)}
          </div>
          <div style={{
            width: "100%", maxWidth: "48px",
            height: `${Math.max((Math.abs(d.value) / max) * (height - 40), 4)}px`,
            background: d.color || "linear-gradient(180deg, #5B8DEF, #3B6BCF)",
            borderRadius: "4px 4px 0 0", transition: "height 0.4s ease"
          }} />
          <div style={{ fontSize: "10px", color: "#6b7280", fontFamily: "'DM Sans', sans-serif" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function FinanceTracker({ session, onChangePassword }) {
  const userId = session?.user?.id;
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterCat, setFilterCat] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [sortMode, setSortMode] = useState("date-desc");
  const [editingTxn, setEditingTxn] = useState(null);
  const [notification, setNotification] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Net worth form
  const [nwDate, setNwDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nwAssets, setNwAssets] = useState({});
  const [nwLiabilities, setNwLiabilities] = useState({});
  const [nwPendingCredits, setNwPendingCredits] = useState([{ label: "SP Expenses", amount: "" }]);

  const resetNWForm = () => { setNwDate(new Date().toISOString().slice(0, 10)); setNwAssets({}); setNwLiabilities({}); setNwPendingCredits([{ label: "SP Expenses", amount: "" }]); };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: txns }, { data: nwh }] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('net_worth_snapshots').select('*').eq('user_id', userId).order('date', { ascending: true })
      ]);
      setTransactions((txns || []).map(t => ({
        id: t.id, date: t.date, description: t.description,
        amount: parseFloat(t.amount), category: t.category, monthKey: t.month_key
      })));
      setNetWorthHistory((nwh || []).map(n => ({
        id: n.id, date: n.date, assets: n.assets, liabilities: n.liabilities,
        pendingCredits: n.pending_credits, totalAssets: parseFloat(n.total_assets),
        totalLiabilities: parseFloat(n.total_liabilities), pendingTotal: parseFloat(n.pending_total),
        netWorth: parseFloat(n.net_worth), liquidTotal: parseFloat(n.liquid_total)
      })));
      setLoading(false);
    })();
  }, [userId]);

  const saveTxns = useCallback(async (txns) => { setTransactions(txns); }, []);
  const saveNW = useCallback(async (nwh) => { setNetWorthHistory(nwh); }, []);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const notify = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const generateAiInsights = async (spendingData, monthsOfData, savingsRate, monthlySurplus, avgMonthlySpend, monthlyNet) => {
    setAiLoading(true);
    setAiError(null);
    setAiInsights(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spendingData, monthsOfData, savingsRate, monthlySurplus, avgMonthlySpend, monthlyNet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate insights');
      setAiInsights(data.insights);
    } catch (err) {
      setAiError(err.message);
    }
    setAiLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  const handleFileUpload = async (file) => {
    setUploadError(null);
    setParsedPreview([]);
    setCategoryMap({});
    try {
      const text = await file.text();
      const result = Papa.parse(text, { skipEmptyLines: true });
      let rows = result.data || [];

      // Skip header row if present
      if (rows.length > 0 && /date/i.test(String(rows[0][0] || ""))) {
        rows = rows.slice(1);
      }

      const parsed = [];
      const cm = {};
      let idx = 0;
      for (const r of rows) {
        if (r.length < 3) continue;
        const rawDate = String(r[0] || "").trim();
        const desc = String(r[1] || "").trim();
        const amtStr = String(r[2] || "").trim();
        const cat = r.length >= 4 ? String(r[3] || "").trim() : null;

        const amt = parseFloat(amtStr.replace(/[$,]/g, ""));
        if (!rawDate || !desc || isNaN(amt) || amt <= 0) continue;

        let date = rawDate;
        if (/^\d{1,2}\/\d{1,2}$/.test(date)) date = date + "/" + new Date().getFullYear();

        parsed.push({ date, description: desc, amount: amt });
        cm[idx] = (cat && CATEGORIES.includes(cat)) ? cat : guessCategory(desc);
        idx++;
      }

      if (parsed.length === 0) {
        setUploadError("No transactions found. Make sure your CSV has columns: Date, Description, Amount, Category.");
        return;
      }

      setParsedPreview(parsed);
      setCategoryMap(cm);
      notify(`${parsed.length} transactions loaded from ${file.name}`);
    } catch (err) {
      setUploadError(`Error reading file: ${err.message}`);
    }
  };

  const handleImport = async () => {
    const rows = parsedPreview.map((t, i) => ({
      user_id: userId, date: t.date, description: t.description, amount: t.amount,
      category: categoryMap[i] || "Other", month_key: getMonthKey(t.date)
    }));
    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) { notify("Import error: " + error.message); return; }
    const newTxns = (data || []).map(t => ({
      id: t.id, date: t.date, description: t.description,
      amount: parseFloat(t.amount), category: t.category, monthKey: t.month_key
    }));
    setTransactions([...transactions, ...newTxns]);
    setParsedPreview([]); setCategoryMap({});
    notify(`${newTxns.length} transactions imported`);
  };

  const handleAddNetWorth = async () => {
    if (!nwDate) { notify("Please select a date"); return; }
    const assets = {}; let totalAssets = 0;
    ASSET_FIELDS.forEach(f => { const v = parseFloat(nwAssets[f.key]) || 0; assets[f.key] = v; totalAssets += v; });
    const liabilities = {}; let totalLiabilities = 0;
    LIABILITY_FIELDS.forEach(f => { const v = parseFloat(nwLiabilities[f.key]) || 0; liabilities[f.key] = v; totalLiabilities += v; });
    const pendingCredits = nwPendingCredits.filter(pc => pc.label.trim() && parseFloat(pc.amount)).map(pc => ({ label: pc.label.trim(), amount: parseFloat(pc.amount) }));
    const totalPending = pendingCredits.reduce((s, pc) => s + pc.amount, 0);
    const liquidTotal = LIQUID_KEYS.reduce((s, k) => s + (assets[k] || 0), 0);
    const netWorth = totalAssets - totalLiabilities + totalPending;
    const { data, error } = await supabase.from('net_worth_snapshots').insert({
      user_id: userId, date: nwDate, assets, liabilities, pending_credits: pendingCredits,
      total_assets: totalAssets, total_liabilities: totalLiabilities, pending_total: totalPending,
      net_worth: netWorth, liquid_total: liquidTotal
    }).select();
    if (error) { notify("Save error: " + error.message); return; }
    const entry = data[0];
    const mapped = {
      id: entry.id, date: entry.date, assets: entry.assets, liabilities: entry.liabilities,
      pendingCredits: entry.pending_credits, totalAssets: parseFloat(entry.total_assets),
      totalLiabilities: parseFloat(entry.total_liabilities), pendingTotal: parseFloat(entry.pending_total),
      netWorth: parseFloat(entry.net_worth), liquidTotal: parseFloat(entry.liquid_total)
    };
    const updated = [...netWorthHistory, mapped].sort((a, b) => a.date.localeCompare(b.date));
    setNetWorthHistory(updated);
    resetNWForm();
    notify("Net worth snapshot saved");
  };

  const deleteTransaction = async (id) => {
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(transactions.filter(t => t.id !== id));
    notify("Transaction deleted");
  };
  const updateTransaction = async (id, updates) => {
    const dbUpdates = {};
    if (updates.category) dbUpdates.category = updates.category;
    await supabase.from('transactions').update(dbUpdates).eq('id', id);
    setTransactions(transactions.map(t => t.id === id ? { ...t, ...updates } : t));
    setEditingTxn(null); notify("Updated");
  };
  const deleteNetWorth = async (id) => {
    await supabase.from('net_worth_snapshots').delete().eq('id', id);
    setNetWorthHistory(netWorthHistory.filter(n => n.id !== id));
    notify("Entry deleted");
  };

  const addPendingCredit = () => setNwPendingCredits([...nwPendingCredits, { label: "", amount: "" }]);
  const removePendingCredit = (i) => setNwPendingCredits(nwPendingCredits.filter((_, idx) => idx !== i));
  const updatePendingCredit = (i, field, val) => { const u = [...nwPendingCredits]; u[i] = { ...u[i], [field]: val }; setNwPendingCredits(u); };

  // Computed
  const years = [...new Set(transactions.map(t => t.monthKey?.slice(0, 4)).filter(Boolean))].sort();
  const filteredTxns = transactions.filter(t => t.monthKey?.startsWith(filterYear));
  const yearTotal = filteredTxns.reduce((s, t) => s + t.amount, 0);
  const monthlyTotals = {};
  filteredTxns.forEach(t => { if (t.monthKey) monthlyTotals[t.monthKey] = (monthlyTotals[t.monthKey] || 0) + t.amount; });
  const categoryTotals = {};
  filteredTxns.forEach(t => { categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount; });
  const monthBarData = Array.from({ length: 12 }, (_, i) => {
    const key = `${filterYear}-${String(i + 1).padStart(2, "0")}`;
    return { label: MONTHS[i], value: monthlyTotals[key] || 0, color: "linear-gradient(180deg, #5B8DEF, #3B6BCF)", monthKey: String(i + 1).padStart(2, "0") };
  });
  const latestNW = netWorthHistory.length ? netWorthHistory[netWorthHistory.length - 1] : null;
  const nwChartData = netWorthHistory.map(n => ({ label: n.date.slice(5, 7) + "/" + n.date.slice(2, 4), value: n.netWorth, color: "linear-gradient(180deg, #34D399, #10B981)" }));

  const inputStyle = { background: "#1a1a2e", border: "1px solid #252545", borderRadius: "8px", padding: "10px 14px", color: "#e0e0e0", fontSize: "14px", fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box" };
  const monoInput = { ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" };
  const btnStyle = { background: "#5B8DEF", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", transition: "background 0.2s" };
  const selectStyle = { ...inputStyle, cursor: "pointer", appearance: "auto" };
  const sectionLabel = { fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", marginTop: "20px" };
  const fieldRow = { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" };
  const fieldLabel = { fontSize: "13px", color: "#9ca3af", width: "160px", flexShrink: 0 };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f1e", color: "#5B8DEF", fontFamily: "'DM Sans', sans-serif" }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1e", color: "#e0e0e0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      {notification && <div style={{ position: "fixed", top: "20px", right: "20px", background: "#1e3a2f", border: "1px solid #34D399", borderRadius: "8px", padding: "12px 20px", color: "#34D399", fontSize: "14px", fontWeight: 500, zIndex: 1000, animation: "fadeIn 0.3s ease" }}>{notification}</div>}

      {/* Header */}
      <div style={{ padding: "24px 32px 0", borderBottom: "1px solid #252545" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34D399" }} />
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}>Finance Tracker</h1>
          <button onClick={onChangePassword} style={{ marginLeft: "auto", background: "none", border: "1px solid #252545", borderRadius: "6px", color: "#6b7280", cursor: "pointer", padding: "6px 14px", fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>Change Password</button>
          <button onClick={handleSignOut} style={{ background: "none", border: "1px solid #252545", borderRadius: "6px", color: "#6b7280", cursor: "pointer", padding: "6px 14px", fontSize: "12px", fontFamily: "'DM Sans', sans-serif" }}>Sign Out</button>
          <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>{transactions.length} txns · {netWorthHistory.length} snapshots</span>
        </div>
        <div style={{ display: "flex" }}>
          {["dashboard", "analysis", "import", "transactions", "networth"].map(t => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === "networth" ? "Net Worth" : t.charAt(0).toUpperCase() + t.slice(1)}
            </TabButton>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "1100px" }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
                {(years.length ? years : [new Date().getFullYear().toString()]).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <StatCard label="Year Total" value={formatCurrency(yearTotal)} accent="#E8524A" />
              <StatCard label="Monthly Avg" value={formatCurrency(yearTotal / (Object.keys(monthlyTotals).length || 1))} accent="#F59E42" sub={`across ${Object.keys(monthlyTotals).length} month${Object.keys(monthlyTotals).length !== 1 ? "s" : ""}`} />
              <StatCard label="Net Worth" value={latestNW ? formatCurrency(latestNW.netWorth) : "—"} accent="#34D399" sub={latestNW ? `as of ${latestNW.date}` : "No data"} />
              <StatCard label="Cash Liquidity" value={latestNW ? formatCurrency(latestNW.liquidTotal) : "—"} accent="#5B8DEF" sub={latestNW ? `${((latestNW.liquidTotal / latestNW.netWorth) * 100).toFixed(1)}% of NW` : ""} />
            </div>

            {latestNW && (
              <Card>
                <div style={sectionLabel}>Latest Snapshot — {latestNW.date}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", fontSize: "13px" }}>
                  <div>
                    <div style={{ ...sectionLabel, marginTop: 0, color: "#34D399" }}>Assets</div>
                    {ASSET_FIELDS.map(f => (
                      <div key={f.key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1a1a2e" }}>
                        <span style={{ color: "#9ca3af" }}>{f.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{formatCurrency(latestNW.assets?.[f.key] || 0)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
                      <span>Total</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#34D399" }}>{formatCurrency(latestNW.totalAssets)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...sectionLabel, marginTop: 0, color: "#E8524A" }}>Liabilities</div>
                    {LIABILITY_FIELDS.map(f => (
                      <div key={f.key} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1a1a2e" }}>
                        <span style={{ color: "#9ca3af" }}>{f.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#E8524A" }}>{formatCurrency(latestNW.liabilities?.[f.key] || 0)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
                      <span>Total</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#E8524A" }}>{formatCurrency(latestNW.totalLiabilities)}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ ...sectionLabel, marginTop: 0, color: "#A78BFA" }}>Pending Credits</div>
                    {(latestNW.pendingCredits || []).map((pc, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1a1a2e" }}>
                        <span style={{ color: "#9ca3af" }}>{pc.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#A78BFA" }}>{formatCurrency(pc.amount)}</span>
                      </div>
                    ))}
                    {!(latestNW.pendingCredits || []).length && <div style={{ color: "#4b5563", fontSize: "12px", padding: "4px 0" }}>None</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
                      <span>Total</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA" }}>{formatCurrency(latestNW.totalPending)}</span>
                    </div>
                    <div style={{ marginTop: "16px", padding: "12px", background: "#1a1a2e", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Net Worth</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: "#34D399", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>{formatCurrency(latestNW.netWorth)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <div style={sectionLabel}>Monthly Expenses — {filterYear}</div>
              <BarChart data={monthBarData} height={180} onBarClick={(d) => { setFilterMonth(d.monthKey); setFilterCat("All"); setTab("transactions"); }} />
            </Card>

            {Object.keys(categoryTotals).length > 0 && (
              <Card>
                <div style={sectionLabel}>Category Breakdown — {filterYear}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "4px 0", borderRadius: "4px" }}
                      onClick={() => { setFilterCat(cat); setTab("transactions"); }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: CATEGORY_COLORS[cat] || "#5B8DEF", flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", width: "120px" }}>{cat}</span>
                      <div style={{ flex: 1, height: "6px", background: "#1a1a2e", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "3px", background: CATEGORY_COLORS[cat] || "#5B8DEF", width: `${(val / Math.max(...Object.values(categoryTotals))) * 100}%`, transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af", width: "90px", textAlign: "right" }}>{formatCurrency(val)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {nwChartData.length > 1 && (
              <Card>
                <div style={sectionLabel}>Net Worth Over Time</div>
                <BarChart data={nwChartData} height={160} />
              </Card>
            )}
          </div>
        )}

        {/* ═══ ANALYSIS ═══ */}
        {tab === "analysis" && (() => {
          // Real income from paystubs (Nov 2025 - Feb 2026)
          // Regular biweekly take-home: $2,462.45 avg across 7 regular paychecks
          // Bonus quarter paycheck: $5,908.61 net (includes $6,250 gross bonus)
          // Bonus extra net vs regular paycheck: $3,446.16
          const REG_PAYCHECK_NET = 2462;
          const BONUS_EXTRA_NET = 3446; // extra net on bonus paycheck vs regular
          const PAYCHECKS_PER_MONTH = 26 / 12; // 26 biweekly pays per year
          const REG_MONTHLY_NET = Math.round(REG_PAYCHECK_NET * PAYCHECKS_PER_MONTH); // ~$5,335
          const BONUS_MONTHS = [1, 4, 7, 10]; // Jan, Apr, Jul, Oct
          const ANNUAL_NET = (REG_PAYCHECK_NET * 26) + (BONUS_EXTRA_NET * 4); // ~$77,796
          const AVG_MONTHLY_NET = Math.round(ANNUAL_NET / 12); // ~$6,483

          // Recommended budget benchmarks (% of regular monthly net ~$5,317)
          const benchmarks = {
            Housing: { pct: 0.30, label: "Housing" },
            Utilities: { pct: 0.05, label: "Utilities" },
            Transportation: { pct: 0.10, label: "Transportation" },
            Groceries: { pct: 0.10, label: "Groceries" },
            "Eating Out": { pct: 0.08, label: "Eating Out" },
            Health: { pct: 0.05, label: "Health" },
            Subscription: { pct: 0.03, label: "Subscriptions" },
            Shopping: { pct: 0.05, label: "Shopping" },
            Sports: { pct: 0.05, label: "Sports/Golf" },
            Entertainment: { pct: 0.03, label: "Entertainment" },
            Friends: { pct: 0.05, label: "Friends" },
            Girlfriend: { pct: 0.05, label: "Girlfriend" },
            Travel: { pct: 0.05, label: "Travel" },
          };

          const monthsWithData = Object.keys(monthlyTotals).length || 1;
          const totalSpent = filteredTxns.reduce((s, t) => s + t.amount, 0);
          const monthlyAvgSpend = totalSpent / monthsWithData;
          const annualizedSpend = monthlyAvgSpend * 12;
          const monthlySurplus = AVG_MONTHLY_NET - monthlyAvgSpend;
          const annualSavings = monthlySurplus * 12;
          const savingsRate = ANNUAL_NET > 0 ? (annualSavings / ANNUAL_NET) * 100 : 0;

          // Per-month income tracking
          const monthlyIncome = {};
          Object.keys(monthlyTotals).forEach(mk => {
            const mo = parseInt(mk.split("-")[1]);
            monthlyIncome[mk] = BONUS_MONTHS.includes(mo) ? REG_MONTHLY_NET + BONUS_EXTRA_NET : REG_MONTHLY_NET;
          });

          // Per-category monthly averages
          const catMonthlyAvg = {};
          Object.entries(categoryTotals).forEach(([cat, total]) => {
            catMonthlyAvg[cat] = total / monthsWithData;
          });

          // Category analysis with benchmarks against regular month income
          const catAnalysis = Object.entries(catMonthlyAvg)
            .map(([cat, avg]) => {
              const bench = benchmarks[cat];
              const recommended = bench ? bench.pct * REG_MONTHLY_NET : null;
              const overBy = recommended ? avg - recommended : null;
              const pctOfNet = (avg / REG_MONTHLY_NET) * 100;
              return { cat, avg, recommended, overBy, pctOfNet };
            })
            .sort((a, b) => b.avg - a.avg);



          // Find top individual expenses
          const topExpenses = [...filteredTxns]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

          // Monthly surplus/deficit tracking
          const monthlySurplusData = Object.keys(monthlyTotals).sort().map(mk => {
            const income = monthlyIncome[mk] || REG_MONTHLY_NET;
            const spent = monthlyTotals[mk] || 0;
            const surplus = income - spent;
            const moIdx = parseInt(mk.split("-")[1]) - 1;
            const isBonus = BONUS_MONTHS.includes(parseInt(mk.split("-")[1]));
            return { label: MONTHS[moIdx], spent, income, surplus, isBonus };
          });

          const statusColor = savingsRate >= 20 ? "#34D399" : savingsRate >= 10 ? "#F59E42" : "#E8524A";
          const statusLabel = savingsRate >= 20 ? "Strong" : savingsRate >= 10 ? "Moderate" : "#E8524A";
          const statusText = savingsRate >= 20 ? "On track for goals" : savingsRate >= 10 ? "Room to improve" : "Spending exceeds safe threshold";

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Income context */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
                  {(years.length ? years : [new Date().getFullYear().toString()]).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {monthsWithData} month{monthsWithData > 1 ? "s" : ""} of data · Regular: ~{formatCurrency(REG_MONTHLY_NET)}/mo · Bonus Qtr: +{formatCurrency(BONUS_EXTRA_NET)} · Annual Net: ~{formatCurrency(ANNUAL_NET)}
                </span>
              </div>

              {filteredTxns.length === 0 ? (
                <Card><div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>No transaction data for {filterYear}. Import transactions first.</div></Card>
              ) : (<>

              {/* Key metrics */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <StatCard label="Avg Monthly Net" value={formatCurrency(AVG_MONTHLY_NET)} accent="#34D399" sub={`${formatCurrency(REG_MONTHLY_NET)} base + bonus qtrs`} />
                <StatCard label="Avg Monthly Spend" value={formatCurrency(monthlyAvgSpend)} accent="#E8524A" sub={`${formatCurrency(totalSpent)} over ${monthsWithData}mo`} />
                <StatCard label="Monthly Surplus" value={formatCurrency(monthlySurplus)} accent={monthlySurplus > 0 ? "#34D399" : "#E8524A"} sub={`${savingsRate.toFixed(1)}% savings rate`} />
                <Card style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Health Check</div>
                  <div style={{ fontSize: "26px", fontWeight: 700, color: statusColor, fontFamily: "'JetBrains Mono', monospace" }}>
                    {savingsRate >= 20 ? "Strong" : savingsRate >= 10 ? "Moderate" : "At Risk"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{statusText}</div>
                </Card>
              </div>

              {/* Monthly Income vs Spend */}
              {monthlySurplusData.length > 1 && (
                <Card>
                  <div style={sectionLabel}>Monthly Income vs Spend</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "180px", padding: "0 8px" }}>
                    {monthlySurplusData.map((d, i) => {
                      const maxVal = Math.max(...monthlySurplusData.map(m => Math.max(m.income, m.spent)), 1);
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                          <div style={{ fontSize: "10px", color: d.surplus >= 0 ? "#34D399" : "#E8524A", fontFamily: "'JetBrains Mono', monospace" }}>
                            {d.surplus >= 0 ? "+" : ""}{d.surplus >= 1000 ? `${(d.surplus/1000).toFixed(1)}k` : d.surplus.toFixed(0)}
                          </div>
                          <div style={{ width: "100%", display: "flex", gap: "2px", alignItems: "flex-end", justifyContent: "center" }}>
                            <div style={{
                              width: "45%", maxWidth: "24px",
                              height: `${Math.max((d.income / maxVal) * 140, 4)}px`,
                              background: d.isBonus ? "linear-gradient(180deg, #34D399, #10B981)" : "#2a3a2e",
                              borderRadius: "3px 3px 0 0"
                            }} />
                            <div style={{
                              width: "45%", maxWidth: "24px",
                              height: `${Math.max((d.spent / maxVal) * 140, 4)}px`,
                              background: d.spent > d.income ? "linear-gradient(180deg, #E8524A, #c0392b)" : "linear-gradient(180deg, #5B8DEF, #3B6BCF)",
                              borderRadius: "3px 3px 0 0"
                            }} />
                          </div>
                          <div style={{ fontSize: "10px", color: "#6b7280" }}>{d.label}{d.isBonus ? "*" : ""}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: "8px", display: "flex", gap: "16px", justifyContent: "center", fontSize: "11px", color: "#6b7280" }}>
                    <span><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "#2a3a2e", marginRight: "4px" }} />Income</span>
                    <span><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "#34D399", marginRight: "4px" }} />Bonus Month</span>
                    <span><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "#5B8DEF", marginRight: "4px" }} />Spend</span>
                    <span>* = bonus quarter</span>
                  </div>
                </Card>
              )}

              {/* Budget vs Actual */}
              <Card>
                <div style={sectionLabel}>Budget vs Actual (Monthly Average)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {catAnalysis.map(({ cat, avg, recommended, overBy, pctOfNet }) => {
                    const isOver = overBy && overBy > 0;
                    const maxVal = Math.max(avg, recommended || 0);
                    const barMax = Math.max(...catAnalysis.map(c => Math.max(c.avg, c.recommended || 0)), 1);
                    return (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: CATEGORY_COLORS[cat] || "#5B8DEF", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", width: "110px", flexShrink: 0 }}>{cat}</span>
                        <div style={{ flex: 1, position: "relative", height: "20px" }}>
                          {recommended && (
                            <div style={{
                              position: "absolute", top: 0, height: "100%",
                              width: `${(recommended / barMax) * 100}%`,
                              background: "#252545", borderRadius: "4px"
                            }} />
                          )}
                          <div style={{
                            position: "absolute", top: "2px", height: "16px",
                            width: `${(avg / barMax) * 100}%`,
                            background: isOver ? `linear-gradient(90deg, ${CATEGORY_COLORS[cat] || "#5B8DEF"}, #E8524A)` : (CATEGORY_COLORS[cat] || "#5B8DEF"),
                            borderRadius: "3px", opacity: 0.9, transition: "width 0.4s ease"
                          }} />
                        </div>
                        <div style={{ width: "140px", textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: isOver ? "#E8524A" : "#9ca3af" }}>
                            {formatCurrency(avg)}
                          </span>
                          {recommended && (
                            <span style={{ fontSize: "10px", color: "#4b5563", marginLeft: "6px" }}>
                              / {formatCurrency(recommended)}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "10px", color: "#4b5563", width: "40px", textAlign: "right" }}>{pctOfNet.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "12px", fontSize: "11px", color: "#4b5563" }}>
                  Gray bar = recommended budget · Colored bar = your actual spend · Percentage = share of net income
                </div>
              </Card>



              {/* AI Insights */}
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={sectionLabel}>AI Insights</div>
                  <button
                    onClick={() => generateAiInsights(catMonthlyAvg, monthsWithData, savingsRate, monthlySurplus, monthlyAvgSpend, AVG_MONTHLY_NET)}
                    disabled={aiLoading}
                    style={{ background: aiLoading ? "#252545" : "#5B8DEF", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: aiLoading ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: aiLoading ? 0.6 : 1 }}
                  >
                    {aiLoading ? "Analyzing..." : aiInsights ? "Regenerate" : "Generate Insights"}
                  </button>
                </div>
                {aiError && (
                  <div style={{ padding: "12px", background: "#2a1a1e", border: "1px solid #E8524A", borderRadius: "8px", fontSize: "13px", color: "#E8524A" }}>{aiError}</div>
                )}
                {!aiInsights && !aiLoading && !aiError && (
                  <div style={{ textAlign: "center", padding: "32px", color: "#4b5563", fontSize: "13px" }}>
                    Click "Generate Insights" to get AI-powered analysis of your spending patterns.
                  </div>
                )}
                {aiLoading && (
                  <div style={{ textAlign: "center", padding: "32px", color: "#6b7280", fontSize: "13px" }}>
                    Analyzing your spending data...
                  </div>
                )}
                {aiInsights && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {aiInsights.map((insight, i) => {
                      const borderColor = insight.severity === "warning" ? "#E8524A" : insight.severity === "positive" ? "#34D399" : "#5B8DEF";
                      return (
                        <div key={i} style={{ padding: "14px", background: "#1a1a2e", borderRadius: "8px", borderLeft: `3px solid ${borderColor}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <div style={{ fontSize: "13px", fontWeight: 600 }}>{insight.title}</div>
                            {insight.amount && <div style={{ fontSize: "12px", color: borderColor, fontFamily: "'JetBrains Mono', monospace" }}>{insight.amount}</div>}
                          </div>
                          <div style={{ fontSize: "12px", color: "#9ca3af", lineHeight: 1.6 }}>{insight.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Top expenses */}
              <Card>
                <div style={sectionLabel}>Top 10 Largest Transactions — {filterYear}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {topExpenses.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #1a1a2e" }}>
                      <span style={{ fontSize: "12px", color: "#4b5563", width: "20px" }}>#{i + 1}</span>
                      <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: CATEGORY_COLORS[t.category] || "#5B8DEF", flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", flex: 1 }}>{t.description}</span>
                      <span style={{ fontSize: "11px", color: "#6b7280" }}>{t.category}</span>
                      <span style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#E8524A", width: "90px", textAlign: "right" }}>{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              </>)}
            </div>
          );
        })()}

        {/* ═══ IMPORT ═══ */}
        {tab === "import" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Card>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Upload CSV File</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
                Upload a .csv file with columns: Date, Description, Amount, Category.
                Workflow: paste raw statements into Claude → get a cleaned table → save as CSV → upload here.
              </div>
              <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#5B8DEF"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = "#252545"; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#252545";
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => document.getElementById('file-upload').click()}
                style={{
                  border: "2px dashed #252545", borderRadius: "12px", padding: "40px",
                  textAlign: "center", cursor: "pointer", transition: "border-color 0.2s",
                  background: "#1a1a2e"
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                <div style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "4px" }}>
                  Drop .csv file here, or click to browse
                </div>
                <div style={{ fontSize: "12px", color: "#4b5563" }}>
                  Expected columns: Date, Description, Amount, Category
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
                />
              </div>
              {uploadError && (
                <div style={{ marginTop: "12px", padding: "12px", background: "#2a1a1e", border: "1px solid #E8524A", borderRadius: "8px", fontSize: "13px", color: "#E8524A" }}>
                  {uploadError}
                </div>
              )}
            </Card>
            {parsedPreview.length > 0 && (
              <Card>
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Preview — {parsedPreview.length} transactions</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>Review categories and adjust before importing.</div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead><tr style={{ borderBottom: "1px solid #252545" }}>
                      <th style={{ textAlign: "left", padding: "8px", color: "#6b7280", fontWeight: 500 }}>Date</th>
                      <th style={{ textAlign: "left", padding: "8px", color: "#6b7280", fontWeight: 500 }}>Description</th>
                      <th style={{ textAlign: "right", padding: "8px", color: "#6b7280", fontWeight: 500 }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "8px", color: "#6b7280", fontWeight: 500 }}>Category</th>
                    </tr></thead>
                    <tbody>
                      {parsedPreview.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #1a1a2e" }}>
                          <td style={{ padding: "8px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{t.date}</td>
                          <td style={{ padding: "8px" }}>{t.description}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(t.amount)}</td>
                          <td style={{ padding: "8px" }}>
                            <select value={categoryMap[i] || "Other"} onChange={e => setCategoryMap({ ...categoryMap, [i]: e.target.value })} style={{ ...selectStyle, padding: "4px 8px", fontSize: "12px" }}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                  <button onClick={handleImport} style={btnStyle}>Import {parsedPreview.length} Transactions</button>
                  <button onClick={() => { setParsedPreview([]); setCategoryMap({}); }} style={{ ...btnStyle, background: "transparent", border: "1px solid #252545", color: "#9ca3af" }}>Cancel</button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ TRANSACTIONS ═══ */}
        {tab === "transactions" && (() => {
          let displayTxns = filteredTxns;
          if (filterMonth !== "All") displayTxns = displayTxns.filter(t => t.monthKey === `${filterYear}-${filterMonth}`);
          if (filterCat !== "All") displayTxns = displayTxns.filter(t => t.category === filterCat);
          const displayTotal = displayTxns.reduce((s, t) => s + t.amount, 0);
          const activeCats = [...new Set(filteredTxns.map(t => t.category))].sort();
          const activeMonths = [...new Set(filteredTxns.map(t => t.monthKey?.slice(5)))].sort();
          const hasFilters = filterCat !== "All" || filterMonth !== "All";
          return (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("All"); }} style={{ ...selectStyle, width: "auto" }}>
                {(years.length ? years : [new Date().getFullYear().toString()]).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
                <option value="All">All Months</option>
                {activeMonths.map(m => <option key={m} value={m}>{MONTHS[parseInt(m) - 1]}</option>)}
              </select>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
                <option value="All">All Categories</option>
                {activeCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {hasFilters && (
                <button onClick={() => { setFilterCat("All"); setFilterMonth("All"); }} style={{ background: "none", border: "1px solid #252545", borderRadius: "6px", color: "#9ca3af", cursor: "pointer", padding: "4px 10px", fontSize: "12px" }}>✕ Clear All</button>
              )}
              <span style={{ fontSize: "13px", color: "#6b7280" }}>{displayTxns.length} transaction{displayTxns.length !== 1 ? "s" : ""}</span>
              <span style={{ marginLeft: "auto", fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", color: "#E8524A" }}>{formatCurrency(displayTotal)}</span>
            </div>

            {/* Month-over-month comparison when a specific month is selected */}
            {filterMonth !== "All" && (() => {
              const moIdx = parseInt(filterMonth);
              const currKey = `${filterYear}-${filterMonth}`;
              const prevMonth = String(moIdx - 1).padStart(2, "0");
              const prevKey = moIdx > 1 ? `${filterYear}-${prevMonth}` : `${parseInt(filterYear) - 1}-12`;
              const currTxns = filteredTxns.filter(t => t.monthKey === currKey);
              const prevTxns = transactions.filter(t => t.monthKey === prevKey);
              const currTotal = currTxns.reduce((s, t) => s + t.amount, 0);
              const prevTotal = prevTxns.reduce((s, t) => s + t.amount, 0);
              const diff = currTotal - prevTotal;

              // Category comparison
              const currByCat = {};
              const prevByCat = {};
              currTxns.forEach(t => { currByCat[t.category] = (currByCat[t.category] || 0) + t.amount; });
              prevTxns.forEach(t => { prevByCat[t.category] = (prevByCat[t.category] || 0) + t.amount; });
              const allCats = [...new Set([...Object.keys(currByCat), ...Object.keys(prevByCat)])];
              const catDiffs = allCats.map(cat => ({
                cat,
                curr: currByCat[cat] || 0,
                prev: prevByCat[cat] || 0,
                diff: (currByCat[cat] || 0) - (prevByCat[cat] || 0)
              })).sort((a, b) => b.diff - a.diff);

              const prevLabel = moIdx > 1 ? MONTHS[moIdx - 2] : "Dec " + (parseInt(filterYear) - 1);
              const currLabel = MONTHS[moIdx - 1];

              return prevTotal > 0 ? (
                <Card>
                  <div style={sectionLabel}>{currLabel} vs {prevLabel} — {diff >= 0 ? "+" : ""}{formatCurrency(diff)}</div>
                  <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "13px" }}>
                      <span style={{ color: "#6b7280" }}>{prevLabel}: </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(prevTotal)}</span>
                    </div>
                    <div style={{ fontSize: "13px" }}>
                      <span style={{ color: "#6b7280" }}>{currLabel}: </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(currTotal)}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: diff >= 0 ? "#E8524A" : "#34D399", fontWeight: 600 }}>
                      {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {catDiffs.filter(c => Math.abs(c.diff) > 1).map(c => (
                      <div key={c.cat} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: CATEGORY_COLORS[c.cat] || "#5B8DEF", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", width: "110px" }}>{c.cat}</span>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "11px", color: "#6b7280", fontFamily: "'JetBrains Mono', monospace", width: "70px", textAlign: "right" }}>{formatCurrency(c.prev)}</span>
                          <span style={{ fontSize: "11px", color: "#4b5563" }}>→</span>
                          <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", width: "70px" }}>{formatCurrency(c.curr)}</span>
                        </div>
                        <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: "80px", textAlign: "right",
                          color: c.diff > 0 ? "#E8524A" : c.diff < 0 ? "#34D399" : "#6b7280"
                        }}>
                          {c.diff > 0 ? "+" : ""}{formatCurrency(c.diff)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null;
            })()}

            {(filterCat !== "All" || filterMonth !== "All") && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#1a1a2e", borderRadius: "8px", borderLeft: `3px solid ${filterCat !== "All" ? (CATEGORY_COLORS[filterCat] || "#5B8DEF") : "#5B8DEF"}` }}>
                {filterCat !== "All" && <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: CATEGORY_COLORS[filterCat] || "#5B8DEF" }} />}
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  {filterMonth !== "All" ? MONTHS[parseInt(filterMonth) - 1] : ""}{filterMonth !== "All" && filterCat !== "All" ? " · " : ""}{filterCat !== "All" ? filterCat : ""}
                </span>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  {formatCurrency(displayTotal)} total · {displayTxns.length} transactions
                </span>
              </div>
            )}
            <Card style={{ padding: "0", overflow: "hidden" }}>
              <div style={{ maxHeight: "600px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead><tr style={{ background: "#1a1a2e", position: "sticky", top: 0, zIndex: 1 }}>
                    <th onClick={() => setSortMode(sortMode === "date-desc" ? "date-asc" : "date-desc")} style={{ textAlign: "left", padding: "12px 16px", color: sortMode.startsWith("date") ? "#e0e0e0" : "#6b7280", fontWeight: 500, cursor: "pointer", userSelect: "none" }}>
                      Date {sortMode === "date-desc" ? "↓" : sortMode === "date-asc" ? "↑" : ""}
                    </th>
                    <th style={{ textAlign: "left", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Description</th>
                    <th style={{ textAlign: "left", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Category</th>
                    <th onClick={() => setSortMode(sortMode === "amt-desc" ? "amt-asc" : "amt-desc")} style={{ textAlign: "right", padding: "12px 16px", color: sortMode.startsWith("amt") ? "#e0e0e0" : "#6b7280", fontWeight: 500, cursor: "pointer", userSelect: "none" }}>
                      Amount {sortMode === "amt-desc" ? "↓" : sortMode === "amt-asc" ? "↑" : ""}
                    </th>
                    <th style={{ padding: "12px 16px", width: "60px" }}></th>
                  </tr></thead>
                  <tbody>
                    {[...displayTxns].sort((a, b) => {
                      if (sortMode === "date-desc") return (b.date || "").localeCompare(a.date || "");
                      if (sortMode === "date-asc") return (a.date || "").localeCompare(b.date || "");
                      if (sortMode === "amt-desc") return b.amount - a.amount;
                      if (sortMode === "amt-asc") return a.amount - b.amount;
                      return 0;
                    }).map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #1a1a2e" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#9ca3af" }}>{t.date}</td>
                        <td style={{ padding: "10px 16px" }}>{t.description}</td>
                        <td style={{ padding: "10px 16px" }}>
                          {editingTxn === t.id ? (
                            <select value={t.category} onChange={e => updateTransaction(t.id, { category: e.target.value })} style={{ ...selectStyle, padding: "4px 8px", fontSize: "12px" }} autoFocus onBlur={() => setEditingTxn(null)}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span onClick={() => setEditingTxn(t.id)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: CATEGORY_COLORS[t.category] || "#5B8DEF" }} /> {t.category}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{formatCurrency(t.amount)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "center" }}>
                          <button onClick={() => deleteTransaction(t.id)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "16px" }} title="Delete">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!displayTxns.length && <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>No transactions{filterCat !== "All" ? ` in ${filterCat}` : ""} for {filterYear}</div>}
              </div>
            </Card>
          </div>
          );
        })()}

        {/* ═══ NET WORTH ═══ */}
        {tab === "networth" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Card>
              <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Add Net Worth Snapshot</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px" }}>Enter balances for each account. Leave blank for $0.</div>
              <div>
                <label style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</label>
                <input type="date" value={nwDate} onChange={e => setNwDate(e.target.value)} style={{ ...inputStyle, marginTop: "4px", maxWidth: "220px" }} />
              </div>

              <div style={sectionLabel}>Assets</div>
              {ASSET_FIELDS.map(f => (
                <div key={f.key} style={fieldRow}>
                  <span style={fieldLabel}>{f.label}</span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: "13px" }}>$</span>
                    <input type="number" step="0.01" value={nwAssets[f.key] || ""} onChange={e => setNwAssets({ ...nwAssets, [f.key]: e.target.value })} placeholder="0.00" style={{ ...monoInput, paddingLeft: "24px" }} />
                  </div>
                </div>
              ))}
              <div style={{ ...fieldRow, paddingTop: "8px", borderTop: "1px solid #252545", marginTop: "4px" }}>
                <span style={{ ...fieldLabel, fontWeight: 600, color: "#e0e0e0" }}>Total Assets</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: "#34D399", fontWeight: 600 }}>
                  {formatCurrency(ASSET_FIELDS.reduce((s, f) => s + (parseFloat(nwAssets[f.key]) || 0), 0))}
                </span>
              </div>

              <div style={sectionLabel}>Liabilities</div>
              {LIABILITY_FIELDS.map(f => (
                <div key={f.key} style={fieldRow}>
                  <span style={fieldLabel}>{f.label}</span>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: "13px" }}>$</span>
                    <input type="number" step="0.01" value={nwLiabilities[f.key] || ""} onChange={e => setNwLiabilities({ ...nwLiabilities, [f.key]: e.target.value })} placeholder="0.00" style={{ ...monoInput, paddingLeft: "24px" }} />
                  </div>
                </div>
              ))}
              <div style={{ ...fieldRow, paddingTop: "8px", borderTop: "1px solid #252545", marginTop: "4px" }}>
                <span style={{ ...fieldLabel, fontWeight: 600, color: "#e0e0e0" }}>Total Liabilities</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: "#E8524A", fontWeight: 600 }}>
                  {formatCurrency(LIABILITY_FIELDS.reduce((s, f) => s + (parseFloat(nwLiabilities[f.key]) || 0), 0))}
                </span>
              </div>

              <div style={sectionLabel}>Pending Credits</div>
              {nwPendingCredits.map((pc, i) => (
                <div key={i} style={fieldRow}>
                  <input value={pc.label} onChange={e => updatePendingCredit(i, "label", e.target.value)} placeholder="Label (e.g. Friend owes me)" style={{ ...inputStyle, width: "160px", flexShrink: 0 }} />
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: "13px" }}>$</span>
                    <input type="number" step="0.01" value={pc.amount} onChange={e => updatePendingCredit(i, "amount", e.target.value)} placeholder="0.00" style={{ ...monoInput, paddingLeft: "24px" }} />
                  </div>
                  {nwPendingCredits.length > 1 && (
                    <button onClick={() => removePendingCredit(i)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={addPendingCredit} style={{ background: "none", border: "1px dashed #252545", borderRadius: "8px", padding: "8px 16px", color: "#6b7280", cursor: "pointer", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", marginTop: "4px" }}>+ Add Pending Credit</button>

              <div style={{ marginTop: "24px", padding: "16px", background: "#1a1a2e", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Calculated Net Worth</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Assets − Liabilities + Pending</div>
                </div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#34D399", fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatCurrency(
                    ASSET_FIELDS.reduce((s, f) => s + (parseFloat(nwAssets[f.key]) || 0), 0)
                    - LIABILITY_FIELDS.reduce((s, f) => s + (parseFloat(nwLiabilities[f.key]) || 0), 0)
                    + nwPendingCredits.reduce((s, pc) => s + (parseFloat(pc.amount) || 0), 0)
                  )}
                </div>
              </div>
              <div style={{ marginTop: "8px", padding: "10px 16px", background: "#1a1a2e", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: "#5B8DEF" }}>Cash Liquidity (BofA + Schwab)</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#5B8DEF", fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatCurrency(LIQUID_KEYS.reduce((s, k) => s + (parseFloat(nwAssets[k]) || 0), 0))}
                </div>
              </div>

              <button onClick={handleAddNetWorth} style={{ ...btnStyle, marginTop: "16px" }}>Save Snapshot</button>
            </Card>

            {nwChartData.length > 0 && (
              <Card>
                <div style={sectionLabel}>Net Worth Over Time</div>
                <BarChart data={nwChartData} height={180} />
              </Card>
            )}

            <Card style={{ padding: "0", overflow: "hidden" }}>
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead><tr style={{ background: "#1a1a2e", position: "sticky", top: 0, zIndex: 1 }}>
                    <th style={{ textAlign: "left", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Date</th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Assets</th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Liabilities</th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Pending</th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Net Worth</th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: "#6b7280", fontWeight: 500 }}>Liquid</th>
                    <th style={{ padding: "12px 16px", width: "40px" }}></th>
                  </tr></thead>
                  <tbody>
                    {[...netWorthHistory].reverse().map(n => (
                      <tr key={n.id} style={{ borderBottom: "1px solid #1a1a2e" }}>
                        <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{n.date}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>{formatCurrency(n.totalAssets)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#E8524A" }}>{formatCurrency(n.totalLiabilities)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#A78BFA" }}>{formatCurrency(n.totalPending)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", fontWeight: 600, color: "#34D399" }}>{formatCurrency(n.netWorth)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#5B8DEF" }}>{formatCurrency(n.liquidTotal)}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <button onClick={() => deleteNetWorth(n.id)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!netWorthHistory.length && <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>No snapshots yet</div>}
              </div>
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        * { scrollbar-width: thin; scrollbar-color: #252545 transparent; }
        *::-webkit-scrollbar { width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: #252545; border-radius: 3px; }
        select option { background: #1a1a2e; color: #e0e0e0; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>
    </div>
  );
}
