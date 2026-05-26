import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* =========================
   Utils
========================= */
const money = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const pad2 = (n) => String(n).padStart(2, "0");

const toISO = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const parseISO = (s) => {
  const [y, m, d] = String(s)
    .split("-")
    .map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
};

const inRange = (iso, start, end) => {
  const t = parseISO(iso).getTime();
  const startTime = parseISO(start).getTime();
  const endTime = parseISO(end).getTime();
  return t >= startTime && t <= endTime;
};

function nextSequentialId(prefix, items) {
  const max = items.reduce((acc, item) => {
    const raw = String(item.id || "");
    const match = raw.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) return acc;
    const num = Number(match[1]);
    return Number.isFinite(num) ? Math.max(acc, num) : acc;
  }, 0);

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

function downloadText(filename, text) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const head = headers.map(esc).join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

/* =========================
   Strategy
========================= */
function commissionStrategies(config) {
  return {
    percentage: (amount) => {
      const pct = Math.max(0, Number(config.percentage || 0)) / 100;
      return Math.max(0, amount) * pct;
    },
    fixed: () => {
      const fixed = Math.max(0, Number(config.fixedValue || 0));
      return fixed;
    },
    tiered: (amount) => {
      const a = Math.max(0, amount);
      const tiers = (config.tiers || [])
        .map((t) => ({
          upTo: Number(t.upTo),
          percentage: Number(t.percentage),
        }))
        .filter((t) => Number.isFinite(t.upTo) && Number.isFinite(t.percentage))
        .sort((x, y) => x.upTo - y.upTo);

      if (!tiers.length) return 0;

      const tier = tiers.find((t) => a <= t.upTo) || tiers[tiers.length - 1];
      const pct = Math.max(0, tier.percentage) / 100;
      return a * pct;
    },
  };
}

function calcCommission(amount, config) {
  const strategies = commissionStrategies(config);
  const fn = strategies[config.type] || strategies.percentage;
  return fn(Number(amount) || 0);
}

/* =========================
   Seed data
========================= */
function seedData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const businesses = [
    {
      id: "NEG-001",
      name: "Restaurante Demo",
      qr: "QR-NEG-001",
      payLink: "/pay/NEG-001",
      commissionConfig: {
        type: "percentage",
        percentage: 8,
        fixedValue: 3000,
        tiers: [
          { upTo: 50000, percentage: 6 },
          { upTo: 100000, percentage: 8 },
          { upTo: 999999999, percentage: 10 },
        ],
      },
    },
    {
      id: "NEG-002",
      name: "Café Central",
      qr: "QR-NEG-002",
      payLink: "/pay/NEG-002",
      commissionConfig: {
        type: "fixed",
        percentage: 10,
        fixedValue: 4000,
        tiers: [
          { upTo: 40000, percentage: 5 },
          { upTo: 90000, percentage: 7 },
          { upTo: 999999999, percentage: 9 },
        ],
      },
    },
  ];

  const customers = [
    "Juan",
    "Ana",
    "Sofía",
    "Carlos",
    "Mateo",
    "Laura",
    "Valentina",
    "Andrés",
    "Camila",
    "Paula",
  ];
  const statuses = ["Confirmada", "Confirmada", "Confirmada", "Reversada"];

  const sales = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(monthStart);
    d.setDate(1 + i);
    const amount = [39000, 54000, 120000, 82000, 27000, 65000, 98000][i % 7];
    const businessId = i % 2 === 0 ? "NEG-001" : "NEG-002";

    sales.push({
      id: `V-${String(i + 1).padStart(4, "0")}`,
      businessId,
      date: toISO(d),
      customer: customers[i % customers.length],
      amount,
      status: statuses[i % statuses.length],
    });
  }

  const payments = [
    { id: "P-0001", businessId: "NEG-001", date: "2026-04-30", amount: 520000, status: "Pagado" },
    { id: "P-0002", businessId: "NEG-001", date: "2026-03-31", amount: 410000, status: "Pagado" },
  ];

  return { businesses, sales, payments };
}

/* =========================
   UI components
========================= */
function Pill({ tone = "neutral", children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <div className="modalTitle">{title}</div>
          <button className="btn ghost" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className="modalBody">{children}</div>
        {footer ? <div className="modalFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

function BusinessDropdown({ businesses, selectedId, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = businesses.find((b) => b.id === selectedId) || businesses[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="customSelect" ref={wrapRef}>
      <button
        className={`customSelectBtn ${open ? "open" : ""}`}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="leftGroup">
          <span className="emoji">🏪</span>
          <span className="selectedText">
            {selected?.name} <span className="selectedMuted">({selected?.id})</span>
          </span>
        </span>
        <span className={`caret ${open ? "rotate" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="customSelectMenu">
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`customSelectItem ${b.id === selectedId ? "selected" : ""}`}
              onClick={() => {
                onChange(b.id);
                setOpen(false);
              }}
            >
              <div className="csTitle">{b.name}</div>
              <div className="csMeta">
                {b.id} • {b.qr}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SalesTable({ rows, cfg }) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>ID</th>
            <th>Cliente</th>
            <th className="right">Monto</th>
            <th className="right">Comisión</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((s) => {
              const c = Math.round(calcCommission(s.amount, cfg));
              return (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td className="mono">{s.id}</td>
                  <td>{s.customer}</td>
                  <td className="right">{money(s.amount)}</td>
                  <td className="right">{money(c)}</td>
                  <td>
                    {s.status === "Confirmada" ? (
                      <Pill tone="ok">✅ Confirmada</Pill>
                    ) : (
                      <Pill tone="warn">⛔ Reversada</Pill>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="muted center">
                No hay resultados con los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function labelStrategy(cfg) {
  if (cfg.type === "percentage") return `Porcentaje (${cfg.percentage}%)`;
  if (cfg.type === "fixed") return `Fijo (${money(cfg.fixedValue)})`;
  if (cfg.type === "tiered") return `Escalonada (${(cfg.tiers || []).length} rangos)`;
  return "Porcentaje";
}

/* =========================
   Main app
========================= */
const tabs = [
  { key: "dashboard", label: "Resumen", icon: "📊" },
  { key: "sales", label: "Ventas", icon: "🧾" },
  { key: "commissions", label: "Comisiones", icon: "💸" },
  { key: "payments", label: "Pagos", icon: "💳" },
  { key: "settings", label: "Configuración", icon: "⚙️" },
];

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("aqr_theme") || "dark");
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("aqr_data");
    try {
      return saved ? JSON.parse(saved) : seedData();
    } catch {
      return seedData();
    }
  });

  const { businesses, sales, payments } = data;

  const [route, setRoute] = useState("dashboard");
  const [businessId, setBusinessId] = useState(
    () => localStorage.getItem("aqr_business") || businesses[0]?.id || "NEG-001"
  );

  const business = businesses.find((b) => b.id === businessId) || businesses[0];

  const now = new Date();
  const monthStartISO = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayISO = toISO(now);

  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [minAmount, setMinAmount] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newSale, setNewSale] = useState({
    date: todayISO,
    customer: "",
    amount: "",
    status: "Confirmada",
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aqr_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("aqr_data", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("aqr_business", businessId);
  }, [businessId]);

  useEffect(() => {
    return () => clearTimeout(toastTimer.current);
  }, []);

  const notify = (msg, tone = "ok") => {
    setToast({ msg, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minAmount === "" ? null : Number(minAmount);

    let rows = sales
      .filter((s) => s.businessId === businessId)
      .filter((s) => inRange(s.date, startDate, endDate))
      .filter((s) => (statusFilter === "Todos" ? true : s.status === statusFilter))
      .filter((s) => (min == null || Number.isNaN(min) ? true : Number(s.amount) >= min))
      .filter((s) => {
        if (!q) return true;
        return (
          s.id.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q) ||
          String(s.amount).includes(q)
        );
      });

    const cmp =
      {
        date_desc: (a, b) => parseISO(b.date) - parseISO(a.date),
        date_asc: (a, b) => parseISO(a.date) - parseISO(b.date),
        amount_desc: (a, b) => b.amount - a.amount,
        amount_asc: (a, b) => a.amount - b.amount,
      }[sortBy] || ((a, b) => parseISO(b.date) - parseISO(a.date));

    rows.sort(cmp);
    return rows;
  }, [sales, businessId, startDate, endDate, statusFilter, minAmount, query, sortBy]);

  const businessPayments = useMemo(
    () => payments.filter((p) => p.businessId === businessId),
    [payments, businessId]
  );

  const filteredPayments = useMemo(
    () => businessPayments.filter((p) => inRange(p.date, startDate, endDate)),
    [businessPayments, startDate, endDate]
  );

  const totals = useMemo(() => {
    const cfg = business.commissionConfig;
    const confirmed = filteredSales.filter((s) => s.status === "Confirmada");

    const totalSales = confirmed.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const totalCommission = confirmed.reduce((acc, s) => acc + calcCommission(s.amount, cfg), 0);
    const reversedCount = filteredSales.filter((s) => s.status === "Reversada").length;

    const totalPaid = filteredPayments
      .filter((p) => p.status === "Pagado")
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const pending = Math.max(0, totalCommission - totalPaid);

    return {
      totalSales,
      totalCommission,
      totalPaid,
      pending,
      txCount: filteredSales.length,
      reversedCount,
    };
  }, [filteredSales, filteredPayments, business]);

  const chartData = useMemo(() => {
    const cfg = business.commissionConfig;
    const map = new Map();

    for (const s of filteredSales) {
      if (s.status !== "Confirmada") continue;
      map.set(s.date, (map.get(s.date) || 0) + Number(s.amount || 0));
    }

    return Array.from(map.entries())
      .sort((a, b) => parseISO(a[0]) - parseISO(b[0]))
      .map(([date, amount]) => ({
        day: date.slice(5),
        amount,
        commission: calcCommission(amount, cfg),
      }));
  }, [filteredSales, business]);

  const addSale = () => {
    if (!newSale.customer.trim()) return notify("Escribe el nombre del cliente.", "warn");

    const amt = Number(newSale.amount);
    if (!Number.isFinite(amt) || amt <= 0) return notify("Ingresa un monto válido.", "warn");

    const row = {
      id: nextSequentialId("V", sales),
      businessId,
      date: newSale.date,
      customer: newSale.customer.trim(),
      amount: amt,
      status: newSale.status,
    };

    setData((d) => ({ ...d, sales: [...d.sales, row] }));
    setAddOpen(false);
    setNewSale({ date: todayISO, customer: "", amount: "", status: "Confirmada" });
    notify("Venta agregada ✅", "ok");
  };

  const exportSalesCSV = () => {
    const rows = filteredSales.map((s) => ({
      id: s.id,
      date: s.date,
      customer: s.customer,
      amount: s.amount,
      status: s.status,
    }));

    const csv = toCSV(rows, ["id", "date", "customer", "amount", "status"]);
    downloadText(`ventas_${businessId}_${startDate}_a_${endDate}.csv`, csv);
    notify("CSV de ventas descargado ✅", "ok");
  };

  const exportStatementCSV = () => {
    const cfg = business.commissionConfig;
    const confirmed = filteredSales.filter((s) => s.status === "Confirmada");

    const rows = confirmed.map((s) => ({
      businessId,
      businessName: business.name,
      id: s.id,
      date: s.date,
      customer: s.customer,
      amount: s.amount,
      commissionType: business.commissionConfig.type,
      commission: Math.round(calcCommission(s.amount, cfg)),
    }));

    const csv = toCSV(rows, [
      "businessId",
      "businessName",
      "id",
      "date",
      "customer",
      "amount",
      "commissionType",
      "commission",
    ]);

    downloadText(`estado_cuenta_${businessId}_${startDate}_a_${endDate}.csv`, csv);
    notify("Estado de cuenta descargado ✅", "ok");
  };

  const markPaid = () => {
    const amountToPay = Math.round(totals.pending);

    if (amountToPay <= 0) {
      return notify("No hay saldo pendiente por pagar.", "warn");
    }

    const row = {
      id: nextSequentialId("P", payments),
      businessId,
      date: todayISO,
      amount: amountToPay,
      status: "Pagado",
    };

    setData((d) => ({
      ...d,
      payments: [row, ...d.payments],
    }));

    notify("Pago registrado ✅", "ok");
  };

  const updateCommission = (patch) => {
    setData((d) => ({
      ...d,
      businesses: d.businesses.map((b) =>
        b.id === businessId ? { ...b, commissionConfig: { ...b.commissionConfig, ...patch } } : b
      ),
    }));
  };

  const updateTier = (idx, patch) => {
    const tiers = [...(business.commissionConfig.tiers || [])];
    tiers[idx] = { ...tiers[idx], ...patch };
    updateCommission({ tiers });
  };

  const addTier = () => {
    const tiers = [...(business.commissionConfig.tiers || [])];
    tiers.push({ upTo: 150000, percentage: 10 });
    updateCommission({ tiers });
  };

  const removeTier = () => {
    const tiers = [...(business.commissionConfig.tiers || [])];
    if (tiers.length <= 1) return notify("Debe existir al menos 1 rango.", "warn");
    tiers.pop();
    updateCommission({ tiers });
  };

  if (!business) {
    return (
      <div className="app">
        <style>{CSS}</style>
        <div style={{ padding: 24 }}>No se encontró un negocio válido.</div>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{CSS}</style>

      <header className="topbar">
        <div className="brand">
          <div className="logoBox">📎</div>
          <div className="brandText">
            <div className="title">Afiliados QR</div>
            <div className="subtitle">Dashboard de comisiones</div>
          </div>
        </div>

        <div className="topActions">
          <BusinessDropdown businesses={businesses} selectedId={businessId} onChange={setBusinessId} />

          <div className="dateWrap">
            <span className="emoji">📅</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="dash">—</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className="searchWrap">
            <span className="emoji">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente o ID…"
            />
          </div>

          <button
            className="btn icon"
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            type="button"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="bizCard">
            <div className="bizRow">
              <div className="bizName">{business.name}</div>
              <Pill tone="ok">Activo</Pill>
            </div>
            <div className="bizMeta">
              <span className="mono">{business.id}</span> • <span className="mono">{business.qr}</span>
            </div>
            <div className="bizPay">
              <span className="emoji">🔗</span>
              <span className="mono">{business.payLink}</span>
            </div>
          </div>

          <nav className="nav">
            {tabs.map((t) => {
              const active = route === t.key;
              return (
                <button
                  key={t.key}
                  className={`navItem ${active ? "active" : ""}`}
                  onClick={() => setRoute(t.key)}
                  type="button"
                >
                  <span className="emoji">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="main">
          <div className="toolbar">
            <div className="leftTools">
              <div className="chipGroup">
                <label>Estado</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Confirmada">Confirmada</option>
                  <option value="Reversada">Reversada</option>
                </select>
              </div>

              <div className="chipGroup">
                <label>Mín. monto</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="Ej. 50000"
                />
              </div>

              <div className="chipGroup">
                <label>Orden</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="date_desc">Fecha ↓</option>
                  <option value="date_asc">Fecha ↑</option>
                  <option value="amount_desc">Monto ↓</option>
                  <option value="amount_asc">Monto ↑</option>
                </select>
              </div>
            </div>

            <div className="rightTools">
              <button className="btn" onClick={() => setAddOpen(true)} type="button">
                ➕ Agregar venta
              </button>
              <button className="btn ghost" onClick={exportSalesCSV} type="button">
                ⬇️ CSV ventas
              </button>
              <button className="btn ghost" onClick={exportStatementCSV} type="button">
                ⬇️ Estado de cuenta
              </button>
            </div>
          </div>

          {route === "dashboard" && (
            <>
              <section className="kpis">
                <div className="card">
                  <div className="cardLabel">Ventas confirmadas</div>
                  <div className="cardValue">{money(totals.totalSales)}</div>
                  <div className="cardHint">Según filtros actuales</div>
                </div>

                <div className="card">
                  <div className="cardLabel">Comisión acumulada</div>
                  <div className="cardValue">{money(totals.totalCommission)}</div>
                  <div className="cardHint">Strategy: {labelStrategy(business.commissionConfig)}</div>
                </div>

                <div className="card">
                  <div className="cardLabel">Pendiente por pagar</div>
                  <div className="cardValue">{money(totals.pending)}</div>
                  <div className="cardHint">Pagado en el periodo: {money(totals.totalPaid)}</div>
                </div>

                <div className="card">
                  <div className="cardLabel">Transacciones</div>
                  <div className="cardValue">{totals.txCount}</div>
                  <div className="cardHint">
                    Reversadas: <b>{totals.reversedCount}</b>
                  </div>
                </div>
              </section>

              <section className="grid2">
                <div className="panel">
                  <div className="panelHead">
                    <div className="panelTitle">Ventas por día</div>
                    <div className="panelMeta">Confirmadas</div>
                  </div>
                  <div className="panelBody chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                        <Tooltip
                          formatter={(value, name) => [money(value), name === "amount" ? "Ventas" : "Comisión"]}
                          labelFormatter={(label) => `Día ${label}`}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#7c6cff" fill="#7c6cff" fillOpacity={0.2} />
                        <Area
                          type="monotone"
                          dataKey="commission"
                          stroke="#11c78a"
                          fill="#11c78a"
                          fillOpacity={0.14}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="panel">
                  <div className="panelHead">
                    <div className="panelTitle">Acciones rápidas</div>
                    <div className="panelMeta">Pago & seguimiento</div>
                  </div>
                  <div className="panelBody">
                    <div className="quickCard">
                      <div className="quickRow">
                        <div>
                          <div className="muted">Estrategia actual</div>
                          <div className="strong">{labelStrategy(business.commissionConfig)}</div>
                        </div>
                        <Pill tone="ok">Activa</Pill>
                      </div>
                    </div>

                    <div className="quickCard">
                      <div className="quickRow">
                        <div>
                          <div className="muted">Adeudo al día</div>
                          <div className="strong">{money(totals.pending)}</div>
                        </div>
                        <button className="btn" onClick={markPaid} type="button">
                          💳 Marcar pagado
                        </button>
                      </div>
                      <div className="payLink">
                        🔗 <span className="mono">{business.payLink}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panelHead">
                  <div className="panelTitle">Últimas ventas</div>
                  <div className="panelMeta">{filteredSales.length} resultados</div>
                </div>
                <div className="panelBody">
                  <SalesTable rows={filteredSales.slice(0, 10)} cfg={business.commissionConfig} />
                </div>
              </section>
            </>
          )}

          {route === "sales" && (
            <section className="panel">
              <div className="panelHead">
                <div className="panelTitle">Ventas</div>
                <div className="panelMeta">Filtradas por periodo y búsqueda</div>
              </div>
              <div className="panelBody">
                <SalesTable rows={filteredSales} cfg={business.commissionConfig} />
              </div>
            </section>
          )}

          {route === "commissions" && (
            <section className="grid2">
              <div className="panel">
                <div className="panelHead">
                  <div className="panelTitle">Comisiones (Strategy)</div>
                  <div className="panelMeta">Selecciona el algoritmo</div>
                </div>
                <div className="panelBody">
                  <div className="formRow">
                    <label>Tipo</label>
                    <select
                      value={business.commissionConfig.type}
                      onChange={(e) => updateCommission({ type: e.target.value })}
                    >
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Valor fijo</option>
                      <option value="tiered">Escalonada</option>
                    </select>
                  </div>

                  {business.commissionConfig.type === "percentage" && (
                    <div className="formRow">
                      <label>Porcentaje (%)</label>
                      <input
                        type="number"
                        value={business.commissionConfig.percentage}
                        onChange={(e) => updateCommission({ percentage: e.target.value })}
                      />
                    </div>
                  )}

                  {business.commissionConfig.type === "fixed" && (
                    <div className="formRow">
                      <label>Valor fijo (COP)</label>
                      <input
                        type="number"
                        value={business.commissionConfig.fixedValue}
                        onChange={(e) => updateCommission({ fixedValue: e.target.value })}
                      />
                    </div>
                  )}

                  {business.commissionConfig.type === "tiered" && (
                    <>
                      <div className="tiers">
                        <div className="tiersHead">
                          <span>Hasta (COP)</span>
                          <span>%</span>
                        </div>
                        {business.commissionConfig.tiers.map((t, idx) => (
                          <div key={idx} className="tiersRow">
                            <input
                              type="number"
                              value={t.upTo}
                              onChange={(e) => updateTier(idx, { upTo: e.target.value })}
                            />
                            <input
                              type="number"
                              value={t.percentage}
                              onChange={(e) => updateTier(idx, { percentage: e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="btnRow">
                        <button className="btn ghost" onClick={addTier} type="button">
                          ➕ Agregar rango
                        </button>
                        <button className="btn ghost" onClick={removeTier} type="button">
                          ➖ Quitar último
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panelHead">
                  <div className="panelTitle">Impacto en el periodo</div>
                  <div className="panelMeta">Se recalcula en tiempo real</div>
                </div>
                <div className="panelBody">
                  <div className="impact">
                    <div className="impactRow">
                      <span>Ventas confirmadas</span>
                      <b>{money(totals.totalSales)}</b>
                    </div>
                    <div className="impactRow">
                      <span>Comisión generada</span>
                      <b>{money(totals.totalCommission)}</b>
                    </div>
                    <div className="impactRow">
                      <span>Pagado en el periodo</span>
                      <b>{money(totals.totalPaid)}</b>
                    </div>
                    <div className="impactRow">
                      <span>Pendiente por pagar</span>
                      <b>{money(totals.pending)}</b>
                    </div>
                  </div>

                  <div className="divider" />

                  <div className="panelTitleSm">Detalle (ventas confirmadas)</div>
                  <SalesTable rows={filteredSales.filter((s) => s.status === "Confirmada")} cfg={business.commissionConfig} />
                </div>
              </div>
            </section>
          )}

          {route === "payments" && (
            <section className="grid2">
              <div className="panel">
                <div className="panelHead">
                  <div className="panelTitle">Pagos</div>
                  <div className="panelMeta">Adeudo y enlace</div>
                </div>
                <div className="panelBody">
                  <div className="payBox">
                    <div className="payTop">
                      <div>
                        <div className="muted">Adeudo al día</div>
                        <div className="payValue">{money(totals.pending)}</div>
                      </div>
                      <button className="btn" onClick={markPaid} type="button">
                        💳 Marcar pagado
                      </button>
                    </div>
                    <div className="payLink">
                      🔗 <span className="mono">{business.payLink}</span>
                    </div>
                  </div>

                  <div className="divider" />

                  <div className="panelTitleSm">Historial</div>
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Fecha</th>
                          <th className="right">Monto</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {businessPayments.length ? (
                          businessPayments.map((p) => (
                            <tr key={p.id}>
                              <td className="mono">{p.id}</td>
                              <td>{p.date}</td>
                              <td className="right">{money(p.amount)}</td>
                              <td>
                                <Pill tone="ok">✅ {p.status}</Pill>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="muted center">
                              Sin pagos registrados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panelHead">
                  <div className="panelTitle">Reversos / auditoría</div>
                  <div className="panelMeta">Control y trazabilidad</div>
                </div>
                <div className="panelBody">
                  <div className="auditBox">
                    <div className="auditRow">
                      <span className="emoji">⛔</span>
                      <div>
                        <div className="strong">Ventas reversadas</div>
                        <div className="muted small">
                          Total en el periodo: <b>{totals.reversedCount}</b>
                        </div>
                      </div>
                    </div>
                    <div className="small muted">Las reversadas no generan comisión.</div>
                  </div>

                  <div className="divider" />

                  <div className="panelTitleSm">Listado reversadas</div>
                  <SalesTable rows={filteredSales.filter((s) => s.status === "Reversada")} cfg={business.commissionConfig} />
                </div>
              </div>
            </section>
          )}

          {route === "settings" && (
            <section className="panel">
              <div className="panelHead">
                <div className="panelTitle">Configuración</div>
                <div className="panelMeta">Negocio, QR, enlace de pago</div>
              </div>
              <div className="panelBody">
                <div className="grid2">
                  <div className="formRow">
                    <label>Nombre del negocio</label>
                    <input
                      value={business.name}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          businesses: d.businesses.map((b) =>
                            b.id === businessId ? { ...b, name: e.target.value } : b
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="formRow">
                    <label>Código QR</label>
                    <input
                      value={business.qr}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          businesses: d.businesses.map((b) =>
                            b.id === businessId ? { ...b, qr: e.target.value } : b
                          ),
                        }))
                      }
                    />
                  </div>

                  <div className="formRow" style={{ gridColumn: "1 / -1" }}>
                    <label>Enlace de pago</label>
                    <input
                      value={business.payLink}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          businesses: d.businesses.map((b) =>
                            b.id === businessId ? { ...b, payLink: e.target.value } : b
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      <Modal
        open={addOpen}
        title="Agregar venta"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => setAddOpen(false)} type="button">
              Cancelar
            </button>
            <button className="btn" onClick={addSale} type="button">
              Guardar
            </button>
          </>
        }
      >
        <div className="grid2">
          <div className="formRow">
            <label>Fecha</label>
            <input
              type="date"
              value={newSale.date}
              onChange={(e) => setNewSale((s) => ({ ...s, date: e.target.value }))}
            />
          </div>

          <div className="formRow">
            <label>Estado</label>
            <select
              value={newSale.status}
              onChange={(e) => setNewSale((s) => ({ ...s, status: e.target.value }))}
            >
              <option value="Confirmada">Confirmada</option>
              <option value="Reversada">Reversada</option>
            </select>
          </div>

          <div className="formRow">
            <label>Cliente</label>
            <input
              value={newSale.customer}
              onChange={(e) => setNewSale((s) => ({ ...s, customer: e.target.value }))}
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div className="formRow">
            <label>Monto (COP)</label>
            <input
              type="number"
              value={newSale.amount}
              onChange={(e) => setNewSale((s) => ({ ...s, amount: e.target.value }))}
              placeholder="Ej. 75000"
            />
          </div>
        </div>
      </Modal>

      {toast ? (
        <div className={`toast ${toast.tone}`}>
          {toast.tone === "ok" ? "✅ " : toast.tone === "warn" ? "⚠️ " : "ℹ️ "}
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   CSS
========================= */
const CSS = `
:root{
  --bg:#070d1c;
  --bg2:#0b1224;
  --panel:rgba(255,255,255,.06);
  --panel2:rgba(255,255,255,.08);
  --panel3:rgba(255,255,255,.035);
  --border:rgba(255,255,255,.11);
  --text:rgba(255,255,255,.94);
  --muted:rgba(255,255,255,.68);
  --shadow:0 16px 50px rgba(0,0,0,.35);
  --brand:#7c6cff;
  --brand2:#b260ff;
  --ok:#11c78a;
  --warn:#ffb020;
  --focus:0 0 0 3px rgba(124,108,255,.20);
}
:root[data-theme="light"]{
  --bg:#f6f8fc;
  --bg2:#eef2fb;
  --panel:rgba(20,24,40,.05);
  --panel2:rgba(20,24,40,.07);
  --panel3:rgba(20,24,40,.03);
  --border:rgba(20,24,40,.10);
  --text:rgba(20,24,40,.94);
  --muted:rgba(20,24,40,.62);
  --shadow:0 16px 50px rgba(20,24,40,.10);
  --brand:#5b4df0;
  --brand2:#964afc;
  --ok:#08a46f;
  --warn:#c67a00;
  --focus:0 0 0 3px rgba(91,77,240,.15);
}

*{ box-sizing:border-box; }
html,body,#root{ height:100%; }
body{
  margin:0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  background:
    radial-gradient(circle at top center, rgba(124,108,255,.12), transparent 20%),
    linear-gradient(180deg, var(--bg), var(--bg2));
  color:var(--text);
}

button, input, select{ font:inherit; }
select, input[type="date"]{ color-scheme: dark; }
:root[data-theme="light"] select,
:root[data-theme="light"] input[type="date"]{ color-scheme: light; }

input, select{
  border:none;
  outline:none;
  background:transparent;
  color:var(--text);
}
input:focus, select:focus{ box-shadow:var(--focus); }

.app{ min-height:100%; }
.emoji{ display:inline-flex; align-items:center; justify-content:center; width:18px; font-size:15px; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.muted{ color:var(--muted); }
.center{text-align:center;}
.right{text-align:right;}

.topbar{
  position:sticky; top:0; z-index:20;
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px;
  background:linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0));
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);
}
.brand{ display:flex; gap:12px; align-items:center; }
.logoBox{
  width:50px; height:50px; border-radius:16px;
  display:grid; place-items:center;
  background:linear-gradient(135deg, var(--brand), var(--brand2));
  box-shadow:0 12px 36px rgba(124,108,255,.30);
  color:#fff;
  font-weight:900;
  font-size:20px;
}
.brandText .title{ font-weight:900; font-size:18px; letter-spacing:.2px; }
.brandText .subtitle{ font-size:12px; color:var(--muted); margin-top:2px; }

.topActions{
  display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:flex-end;
}

.searchWrap, .dateWrap{
  display:flex; align-items:center; gap:8px;
  min-height:54px;
  padding:0 14px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  border-radius:18px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}
.searchWrap input{ min-width:260px; }
.dateWrap input{ width:auto; }
.dateWrap .dash{ color:var(--muted); }

.customSelect{ position:relative; min-width:370px; }
.customSelectBtn{
  width:100%;
  display:flex; align-items:center; justify-content:space-between;
  min-height:54px;
  padding:0 14px;
  border:1px solid var(--border);
  border-radius:18px;
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  color:var(--text);
  cursor:pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
  transition:.2s ease;
}
.customSelectBtn:hover{
  border-color:rgba(124,108,255,.35);
  transform: translateY(-1px);
}
.customSelectBtn.open{
  border-color:rgba(124,108,255,.45);
  box-shadow: var(--focus);
}
.leftGroup{ display:flex; align-items:center; gap:10px; }
.selectedText{ font-weight:700; }
.selectedMuted{ color:var(--muted); font-weight:500; }
.caret{ transition:.18s ease; color:var(--muted); }
.caret.rotate{ transform: rotate(180deg); }

.customSelectMenu{
  position:absolute;
  top:calc(100% + 8px);
  left:0;
  right:0;
  z-index:30;
  border:1px solid var(--border);
  border-radius:18px;
  overflow:hidden;
  background:linear-gradient(180deg, rgba(15,20,38,.98), rgba(10,14,28,.98));
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow);
}
:root[data-theme="light"] .customSelectMenu{
  background:rgba(255,255,255,.96);
}
.customSelectItem{
  width:100%;
  text-align:left;
  padding:14px 16px;
  background:transparent;
  color:var(--text);
  border:none;
  border-bottom:1px solid var(--border);
  cursor:pointer;
  transition:.18s ease;
}
.customSelectItem:last-child{ border-bottom:none; }
.customSelectItem:hover{
  background:rgba(124,108,255,.12);
}
.customSelectItem.selected{
  background:linear-gradient(135deg, rgba(124,108,255,.18), rgba(178,96,255,.08));
}
.csTitle{ font-weight:800; }
.csMeta{ margin-top:4px; font-size:12px; color:var(--muted); }

.layout{
  display:grid;
  grid-template-columns: 280px 1fr;
  gap:14px;
  padding:14px 14px 22px;
}
.sidebar{
  position:sticky; top:84px;
  height:calc(100vh - 100px);
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03));
  border-radius:22px;
  padding:14px;
  box-shadow: var(--shadow);
  display:flex; flex-direction:column; gap:12px;
}
.bizCard{
  padding:14px;
  border:1px solid var(--border);
  background:linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
  border-radius:18px;
}
.bizRow{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
.bizName{ font-weight:900; font-size:16px; }
.bizMeta, .bizPay{
  margin-top:8px; font-size:12px; color:var(--muted);
  display:flex; align-items:center; gap:8px;
}

.nav{ display:flex; flex-direction:column; gap:8px; }
.navItem{
  display:flex; align-items:center; gap:10px;
  width:100%;
  padding:12px 12px;
  border:1px solid transparent;
  background:transparent;
  color:var(--muted);
  border-radius:16px;
  cursor:pointer;
  transition:.18s ease;
}
.navItem:hover{
  background:rgba(255,255,255,.05);
  color:var(--text);
}
.navItem.active{
  background:linear-gradient(135deg, rgba(124,108,255,.22), rgba(178,96,255,.10));
  border-color:rgba(124,108,255,.35);
  color:var(--text);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.main{
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.025));
  border-radius:22px;
  padding:12px;
  box-shadow: var(--shadow);
}

.toolbar{
  display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;
  padding:10px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--panel2), rgba(255,255,255,.03));
  border-radius:18px;
}
.leftTools, .rightTools{
  display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;
}
.chipGroup{ display:flex; flex-direction:column; gap:6px; }
.chipGroup label{ font-size:12px; color:var(--muted); }
.chipGroup input, .chipGroup select{
  min-height:46px;
  padding:0 12px;
  border-radius:16px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  color:var(--text);
}
.chipGroup input::placeholder{ color:var(--muted); }

.btn{
  display:inline-flex; align-items:center; gap:8px;
  min-height:46px;
  padding:0 14px;
  border-radius:16px;
  border:1px solid rgba(124,108,255,.35);
  background:linear-gradient(135deg, rgba(124,108,255,.92), rgba(178,96,255,.74));
  color:white; cursor:pointer;
  box-shadow:0 12px 30px rgba(124,108,255,.22);
  transition:.18s ease;
}
.btn:hover{ transform:translateY(-1px); }
.btn.ghost{
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  color:var(--text);
  border-color:var(--border);
  box-shadow:none;
}
.btn.icon{
  min-width:54px;
  justify-content:center;
  padding:0;
}

.kpis{
  display:grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap:12px;
  margin-top:12px;
}
.card{
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.025));
  border-radius:20px;
  padding:16px;
}
.cardLabel{ color:var(--muted); font-size:12px; }
.cardValue{ font-size:28px; font-weight:900; margin-top:8px; letter-spacing:.2px; }
.cardHint{ color:var(--muted); font-size:12px; margin-top:8px; }

.grid2{
  display:grid;
  grid-template-columns: 1.2fr .8fr;
  gap:12px;
  margin-top:12px;
}
.panel{
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
  border-radius:20px;
  overflow:hidden;
  margin-top:12px;
}
.panelHead{
  padding:16px 16px 12px;
  display:flex; justify-content:space-between; align-items:flex-end; gap:10px;
  border-bottom:1px solid var(--border);
  background:rgba(255,255,255,.02);
}
.panelTitle{ font-weight:900; font-size:15px; }
.panelMeta{ color:var(--muted); font-size:12px; }
.panelBody{ padding:16px; }
.panelBody.chart{ height:290px; }
.panelTitleSm{ font-weight:800; margin-bottom:10px; }

.tableWrap{
  width:100%;
  overflow:auto;
  max-height:420px;
  border:1px solid var(--border);
  border-radius:16px;
}
.table{
  width:100%;
  border-collapse: collapse;
  min-width:760px;
}
.table th, .table td{
  padding:12px 12px;
  border-bottom:1px solid rgba(255,255,255,.08);
  font-size:13px;
}
.table th{
  text-align:left;
  color:var(--muted);
  font-weight:700;
  background:rgba(255,255,255,.02);
  position:sticky;
  top:0;
  z-index:2;
}

.pill{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 10px;
  border-radius:999px;
  font-size:12px;
  border:1px solid var(--border);
  background:var(--panel);
  color:var(--text);
}
.pill.ok{ border-color:rgba(17,199,138,.35); background:rgba(17,199,138,.10); }
.pill.warn{ border-color:rgba(255,176,32,.35); background:rgba(255,176,32,.12); }

.quickCard{
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.025));
  border-radius:18px;
  padding:16px;
  margin-bottom:12px;
}
.quickRow{
  display:flex; justify-content:space-between; gap:10px; align-items:flex-start;
}
.strong{ font-weight:900; font-size:16px; margin-top:6px; }
.small{ font-size:12px; line-height:1.45; }

.payBox{
  border:1px solid rgba(124,108,255,.25);
  background:linear-gradient(135deg, rgba(124,108,255,.18), rgba(178,96,255,.08));
  border-radius:18px;
  padding:16px;
}
.payTop{
  display:flex; justify-content:space-between; align-items:center; gap:10px;
}
.payValue{ font-size:28px; font-weight:900; margin-top:6px; }
.payLink{
  margin-top:12px; display:flex; gap:8px; align-items:center; color:var(--muted); font-size:12px;
}

.auditBox{
  border:1px solid rgba(255,176,32,.25);
  background:rgba(255,176,32,.08);
  border-radius:18px;
  padding:16px;
}
.auditRow{ display:flex; gap:10px; align-items:flex-start; }

.formRow{
  display:flex; flex-direction:column; gap:6px; margin-bottom:10px;
}
.formRow label{ font-size:12px; color:var(--muted); }
.formRow input, .formRow select{
  min-height:46px;
  padding:0 12px;
  border-radius:16px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  color:var(--text);
}
.formRow input::placeholder{ color:var(--muted); }

.divider{
  height:1px; background:var(--border); margin:14px 0;
}

.impact{
  display:grid; gap:10px;
}
.impactRow{
  display:flex; align-items:center; justify-content:space-between;
  border:1px solid var(--border);
  border-radius:16px;
  padding:12px 14px;
  background:var(--panel3);
}

.tiers{
  border:1px solid var(--border);
  border-radius:16px;
  overflow:hidden;
}
.tiersHead{
  display:grid; grid-template-columns: 1fr 1fr;
  gap:8px;
  padding:10px 12px;
  color:var(--muted);
  font-size:12px;
  background:rgba(255,255,255,.02);
  border-bottom:1px solid var(--border);
}
.tiersRow{
  display:grid; grid-template-columns: 1fr 1fr;
  gap:8px;
  padding:10px 12px;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.tiersRow input{
  min-height:42px;
  padding:0 12px;
  border-radius:14px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, var(--panel), rgba(255,255,255,.02));
  color:var(--text);
}
.btnRow{ display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }

.modalOverlay{
  position:fixed; inset:0; background:rgba(0,0,0,.55);
  display:grid; place-items:center; z-index:60;
  padding:16px;
}
.modal{
  width:min(760px, 96vw);
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(10,14,28,.97), rgba(7,10,22,.98));
  border-radius:22px;
  box-shadow: var(--shadow);
  overflow:hidden;
}
:root[data-theme="light"] .modal{
  background:rgba(255,255,255,.98);
}
.modalHead{
  padding:16px; display:flex; justify-content:space-between; align-items:center;
  border-bottom:1px solid var(--border);
  background:rgba(255,255,255,.02);
}
.modalTitle{ font-weight:900; }
.modalBody{ padding:16px; }
.modalFoot{
  padding:16px; display:flex; justify-content:flex-end; gap:10px;
  border-top:1px solid var(--border);
}

.toast{
  position:fixed; right:16px; bottom:16px;
  padding:12px 14px;
  border-radius:16px;
  border:1px solid var(--border);
  background:rgba(10,15,30,.94);
  box-shadow:var(--shadow);
  font-size:13px;
  z-index:70;
}
.toast.ok{ border-color:rgba(17,199,138,.35); }
.toast.warn{ border-color:rgba(255,176,32,.35); }

@media (max-width: 1180px){
  .topActions{ width:100%; justify-content:flex-start; margin-top:10px; }
  .topbar{ align-items:flex-start; flex-direction:column; }
}

@media (max-width: 980px){
  .layout{ grid-template-columns:1fr; }
  .sidebar{ position:relative; top:0; height:auto; }
  .kpis{ grid-template-columns:1fr 1fr; }
  .grid2{ grid-template-columns:1fr; }
  .searchWrap input{ min-width:180px; }
  .customSelect{ min-width: 100%; }
  .dateWrap{ width:100%; }
}

@media (max-width: 640px){
  .kpis{ grid-template-columns:1fr; }
  .rightTools, .leftTools{ width:100%; }
  .toolbar{ align-items:stretch; }
  .searchWrap, .dateWrap, .customSelect{ width:100%; }
}
`;
