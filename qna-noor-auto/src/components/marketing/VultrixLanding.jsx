"use client";
/* eslint-disable */
// Vultrix marketing landing page — self-contained drop-in for Next.js (App Router).
// Dependencies: Tailwind CSS (already in your repo) + lucide-react (already installed).
// No framer-motion needed (animations use IntersectionObserver + CSS).
// Place at: src/components/marketing/VultrixLanding.jsx (or components/marketing/).
// See README-VULTRIX-LANDING.md for wiring + the CSS snippet + Prisma model.

import { useEffect, useRef, useState } from "react";
import {
  Wrench, FileText, Car, Search, Boxes, Package, QrCode, Bell, Calendar,
  UserCog, Building2, Receipt, BarChart3, Upload, ClipboardList, Users,
  ShieldCheck, Smartphone, Download, HardHat, Bot, Globe, Store, MessageSquare,
  CreditCard, Clock, BadgeCheck, ArrowRight, ArrowUpRight, Quote, Check, X,
  Menu, Mail, Phone, MapPin, RefreshCw, Send, CheckCircle2, LayoutDashboard,
  ScanLine, Plus,
} from "lucide-react";
import VultrixAssistant from "./VultrixAssistant";

/* ----------------------------------------------------------------------------
   CONFIG — edit freely
---------------------------------------------------------------------------- */
const SITE = {
  brand: "Vultrix",
  owner: "M.S.A.M Enterprise",
  tagline: "Shop management powered by Vultrix",
  price: 45,
  trialDays: 14,
  annualMonthsFree: 2,
  supportEmail: "micron.alam18@gmail.com", // empty = hide email, route to the form
  phone: "571-320-9425",
  phoneHref: "+15713209425",
};

const URLS = {
  signup: "/signup", // internal Next routes (this runs ON vultrix.net)
  login: "/login",
  terms: "/terms",
  privacy: "/privacy",
  shopName: "QNA / Noor Auto Repair",
  shopUrl: "https://qna-noorautorepair.com", 
};

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#deep-dives" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const CREDIBILITY = [
  { icon: HardHat, label: "Built by a working mechanic" },
  { icon: ShieldCheck, label: "Secure billing by Stripe" },
  { icon: Smartphone, label: "Works on any device" },
  { icon: Download, label: "Export your data anytime" },
];

const WHAT_IS = [
  "Send estimates fast and get approvals without phone tag",
  "Track parts, labor, tech hours, and money owed in one place",
  "Know exactly what fits a vehicle before you order",
  "Keep customers coming back with automatic service reminders",
];

const FEATURES = [
  { icon: Wrench, title: "Repair & work orders", desc: "Full lifecycle from estimate to paid, with labor and parts lines and technician assignment." },
  { icon: FileText, title: "Invoices & estimates", desc: "Clean, professional PDFs and shareable links your customers can approve from their phone." },
  { icon: ScanLine, title: "On-the-go ticket intake", desc: "Techs scan a QR to start a ticket from their phone — out on a road call or busy in the bay. Capture the customer, vehicle, and what's wrong, and it lands in the office's queue to price, order parts, and invoice. No login, no trip to the desk." },
  { icon: CreditCard, title: "Online payments", desc: "Customers pay their invoice right from their phone or a shared link — get paid faster with a lot less chasing." },
  { icon: Car, title: "Customers & vehicles", desc: "A searchable history of every customer, vehicle, and job you've ever done." },
  { icon: Search, title: "VIN decode & plate search", desc: "Decode any VIN in seconds with open recalls included, or pull up a vehicle that's already in your records by its plate." },
  { icon: Boxes, title: "Parts that fit", desc: "See parts tagged to the vehicle and jump straight to your suppliers in one click." },
  { icon: Package, title: "Inventory", desc: "Track cost, price, and on-hand stock. It auto-deducts when a part is used on a repair order." },
  { icon: QrCode, title: "QR part labels", desc: "Print QR stickers for your shelves and scan to pull up a part instantly." },
  { icon: Bell, title: "Service reminders", desc: "Find customers who've gone quiet and win them back with one tap to text or email." },
  { icon: Calendar, title: "Scheduling", desc: "See today's bays and the week ahead at a glance." },
  { icon: UserCog, title: "Technicians & hours", desc: "Assign work and track logged hours for every tech." },
  { icon: Building2, title: "Business & fleet accounts", desc: "Handle B2B accounts and see exactly who owes what." },
  { icon: Receipt, title: "Expenses & financials", desc: "Log shop expenses by category and keep the numbers straight." },
  { icon: BarChart3, title: "Reports", desc: "Know your revenue, what's owed, and where the money is going." },
  { icon: ClipboardList, title: "Canned jobs & presets", desc: "Save your common jobs and drop them onto a repair order in seconds." },
  { icon: Upload, title: "Import & export", desc: "Bring your data in by CSV and take it with you anytime. No lock-in, ever." },
  { icon: Users, title: "Multi-user roles", desc: "Add your whole team with roles for owners, admins, and technicians." },
];

const STATS = [
  { value: 14, suffix: "", label: "Days free to try" },
  { value: 45, prefix: "$", suffix: "", label: "Per month, flat" },
  { value: 16, suffix: "+", label: "Tools in one place" },
  { value: 100, suffix: "%", label: "Of your data, exportable" },
];

const COMPARISON = {
  oldWay: [
    "Juggling several subscriptions and logins",
    "Paying $150–$400+ every month",
    "Clunky, dated screens that fight you",
    "Your data locked in — hard to leave",
    "Phone tag to get an estimate approved",
    "A steep learning curve for the team",
  ],
  vultrix: [
    "Everything in one place",
    "One flat $45 / month",
    "A fast, clean, modern interface",
    "Export your data whenever you want",
    "Customers approve and pay from their phone",
    "Up and running the same day",
  ],
};

const ROADMAP = [
  { icon: Bot, status: "Exploring", title: "AI shop assistant", note: "We're exploring a built-in assistant to help with day-to-day shop tasks. An early customer-support assistant is already live on the site." },
  { icon: Globe, status: "Planned", title: "Expanded worldwide vehicle data", note: "Broader vehicle coverage and deeper repair information beyond today's lookup sources." },
  { icon: Store, status: "Planned", title: "Customer-facing shop websites", note: "Give every shop a clean public website tied right to their Vultrix account." },
  { icon: Boxes, status: "Planned", title: "More supplier integrations", note: "Broader parts catalogs and live availability from more suppliers." },
  { icon: MessageSquare, status: "Planned", title: "Two-way customer texting", note: "Message customers and collect approvals right inside Vultrix." },
];

const DEEP_DIVES = [
  { id: "deep-dive-repair-orders", eyebrow: "Repair orders", title: "From estimate to paid — without the paperwork pile", points: ["Walk a job through estimate → approved → in progress → done → paid", "Add labor and parts lines and assign the right technician", "Send a clean PDF or a link the customer approves from their phone"], mock: "workorder" },
  { id: "deep-dive-intake", eyebrow: "Field intake", title: "Start the ticket from the bay or the road — not the office", points: ["Techs scan a QR and create a ticket from their phone — no login, no walk to the office", "Capture the customer, vehicle, mileage, and what's wrong while it's fresh", "It drops into the office's queue to price, order parts, and invoice"], mock: "intake" },
  { id: "deep-dive-vin-parts", eyebrow: "Lookup", title: "Decode the VIN, see what fits, order in one click", points: ["Decode any VIN in seconds and surface open recalls", "See parts tagged to that exact vehicle, plus universal parts", "A companion browser helper fills the VIN into your supplier's site"], mock: "lookup" },
  { id: "deep-dive-inventory", eyebrow: "Inventory", title: "Stock you can actually trust", points: ["Track cost, price, on-hand counts and reorder thresholds", "Stock auto-deducts the moment a part hits a repair order", "Print QR shelf labels and scan to find a part instantly"], mock: "inventory" },
  { id: "deep-dive-reminders", eyebrow: "Retention", title: "Keep the bays full with win-back reminders", points: ["Automatically surface customers who haven't been in for months", "One tap to text or email an invite back for service", "Bring in repeat work without blasting discounts"], mock: "reminder" },
];

const TIERS = [
  {
    id: "all", name: "Full access", monthly: 45, available: true, highlight: true, badge: "Everything included",
    tagline: "Every tool your shop runs on — one flat price.", cta: "Start free trial", href: URLS.signup,
    features: ["Unlimited repair orders & invoices", "On-the-go ticket intake", "Online payments from a phone or link", "Customers, vehicles & full history", "VIN decode + recalls, find saved by plate", "Inventory with QR labels", "Service reminders & scheduling", "Technicians, expenses & reports", "CSV import / export", "Multiple users & roles"],
  },
];

const FAQS = [
  { q: "Is there a contract?", a: "No. Vultrix is month-to-month and you can cancel anytime from your billing portal — no calls, no hoops." },
  { q: "How does the free trial work?", a: "You get 14 days free. You won't be charged until the trial ends, and you can cancel before then at no cost." },
  { q: "Can I export my data?", a: "Yes. You can import and export by CSV whenever you like. Your data is yours — there's no lock-in." },
  { q: "Does it work on a phone or tablet?", a: "Yes. Vultrix runs in any modern browser, so it works on the shop computer, your phone, or a tablet out in the bay." },
  { q: "Can my whole team use it?", a: "Absolutely. Add multiple users with roles for owners, admins, and technicians." },
  { q: "Is my payment secure?", a: "Billing is handled by Stripe, an industry-leading payment processor. We never see or store your card details." },
  { q: "Can my customers pay online?", a: "Yes. Customers can pay their invoice right from their phone or a shared link — no extra setup on your end." },
  { q: "Do you offer discounts?", a: "From time to time, yes. When we're running a promotion you'll get a code to enter at checkout, and the discount applies automatically." },
  { q: "What does it cost?", a: "A flat $45 per month with every feature included — no tiers and no per-feature upsells." },
];

const TRUST_BADGES = [
  { icon: Clock, label: "Set up in a day" },
  { icon: BadgeCheck, label: "No contract" },
  { icon: ShieldCheck, label: "Cancel anytime" },
];

/* ----------------------------------------------------------------------------
   ANIMATION PRIMITIVES (IntersectionObserver + CSS, no deps)
---------------------------------------------------------------------------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

function Reveal({ children, className = "", delay = 0, y = 20 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const visible = shown || reduced;
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: "opacity .6s ease, transform .6s ease",
        transitionDelay: `${delay}s`,
        opacity: visible ? 1 : 0,
        transform: visible || reduced ? "none" : `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Counter({ value, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (reduced) { setDisplay(value); return; }
      const start = performance.now();
      const dur = 1500;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        setDisplay(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, reduced]);
  return <span ref={ref}>{prefix}{Math.round(display).toLocaleString()}{suffix}</span>;
}

/* ----------------------------------------------------------------------------
   SMALL UI HELPERS (plain elements, no shadcn)
---------------------------------------------------------------------------- */
const btnBase = "inline-flex items-center justify-center font-semibold rounded-xl transition-colors";
const VultrixLogo = () => (
  <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500">
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#09090b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 16 8-16" />
    </svg>
  </span>
);

/* ----------------------------------------------------------------------------
   MOCKS (custom CSS UI — no screenshots / logos)
---------------------------------------------------------------------------- */
const WindowChrome = ({ children, label = "vultrix.net" }) => (
  <div className="rounded-[14px] bg-white border border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_60px_-20px_rgba(0,0,0,0.35)] overflow-hidden">
    <div className="flex items-center gap-2 px-4 h-10 border-b border-zinc-200 bg-zinc-50">
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <span className="h-3 w-3 rounded-full bg-zinc-300" />
      <div className="ml-3 flex-1 max-w-[220px] h-5 rounded-md bg-white border border-zinc-200 flex items-center px-2">
        <span className="text-[10px] text-zinc-400">{label}</span>
      </div>
    </div>
    {children}
  </div>
);

const StatCard = ({ label, value, accent }) => (
  <div className={`rounded-xl border p-3 ${accent ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
    <div className="text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</div>
    <div className={`mt-1 font-display text-lg font-extrabold ${accent ? "text-amber-700" : "text-zinc-900"}`}>{value}</div>
  </div>
);

const sideItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Customers" },
  { icon: Car, label: "Vehicles" },
  { icon: Search, label: "Lookup" },
  { icon: Wrench, label: "Repair Orders" },
  { icon: Bell, label: "Reminders" },
  { icon: Package, label: "Inventory" },
];

const DashboardMock = () => (
  <WindowChrome>
    <div className="flex h-[360px] text-left">
      <aside className="hidden sm:flex flex-col w-40 shrink-0 border-r border-zinc-200 bg-zinc-50/60 p-2 gap-0.5">
        <div className="px-2 py-2">
          <div className="text-[11px] font-bold text-zinc-900 leading-tight">QNA / Noor Auto</div>
          <div className="text-[9px] text-zinc-500">owner</div>
        </div>
        {sideItems.map((s) => (
          <div key={s.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] ${s.active ? "bg-zinc-900 text-white" : "text-zinc-600"}`}>
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </div>
        ))}
      </aside>
      <div className="flex-1 p-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-extrabold text-zinc-900">Dashboard</div>
            <div className="text-[10px] text-zinc-500">Overview of shop activity</div>
          </div>
          <div className="h-7 px-3 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold flex items-center gap-1">
            <Plus className="h-3 w-3" /> New Repair Order
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatCard label="Customers" value="733" />
          <StatCard label="Vehicles" value="4,976" />
          <StatCard label="Open ROs" value="8" />
          <StatCard label="Revenue (mo)" value="$28,095" />
          <StatCard label="Money owed" value="$11,118" accent />
          <StatCard label="Techs active" value="3" />
        </div>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-zinc-800">Recent repair orders</div>
            <div className="text-[9px] text-zinc-400">This week</div>
          </div>
          <div className="mt-2 space-y-1.5">
            {[
              { v: "2018 Honda Civic", s: "In progress", c: "bg-amber-100 text-amber-700", amt: "$420" },
              { v: "2014 Jeep Cherokee", s: "Approved", c: "bg-blue-100 text-blue-700", amt: "$1,180" },
              { v: "2009 Toyota Camry", s: "Paid", c: "bg-green-100 text-green-700", amt: "$265" },
            ].map((r) => (
              <div key={r.v} className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-700">{r.v}</span>
                <span className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded-full font-semibold ${r.c}`}>{r.s}</span>
                  <span className="font-semibold text-zinc-900 w-12 text-right">{r.amt}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </WindowChrome>
);

const WorkOrderMock = () => (
  <WindowChrome label="vultrix.net/repair-orders">
    <div className="p-4 text-left">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-zinc-500">Repair Order #1042</div>
          <div className="font-display text-base font-extrabold text-zinc-900">2018 Honda Civic LX</div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">In progress</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {["Estimate", "Approved", "In progress", "Done", "Paid"].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${i <= 2 ? "bg-zinc-900" : "bg-zinc-300"}`} />
            <span className={`text-[9px] ${i <= 2 ? "text-zinc-800 font-medium" : "text-zinc-400"}`}>{s}</span>
            {i < 4 && <span className="w-3 h-px bg-zinc-200" />}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-1.5 bg-zinc-50 text-[9px] font-semibold text-zinc-500 uppercase">
          <span className="col-span-6">Line</span><span className="col-span-2 text-right">Qty</span><span className="col-span-4 text-right">Total</span>
        </div>
        {[
          { n: "Front brake pads & rotors", q: "1", t: "$285.00" },
          { n: "Labor — brake service (1.5h)", q: "1.5", t: "$165.00" },
          { n: "Synthetic oil change", q: "1", t: "$79.00" },
        ].map((l) => (
          <div key={l.n} className="grid grid-cols-12 px-3 py-2 text-[10px] border-t border-zinc-100">
            <span className="col-span-6 text-zinc-700">{l.n}</span>
            <span className="col-span-2 text-right text-zinc-500">{l.q}</span>
            <span className="col-span-4 text-right font-semibold text-zinc-900">{l.t}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-7 px-2.5 rounded-lg border border-zinc-200 text-[10px] font-semibold text-zinc-700 flex items-center gap-1"><FileText className="h-3 w-3" /> Invoice PDF</span>
          <span className="h-7 px-2.5 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold flex items-center gap-1">Send approval link</span>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-zinc-500">Total</div>
          <div className="font-display text-base font-extrabold text-zinc-900">$529.00</div>
        </div>
      </div>
    </div>
  </WindowChrome>
);

const LookupMock = () => (
  <WindowChrome label="vultrix.net/lookup">
    <div className="p-4 text-left">
      <div className="font-display text-base font-extrabold text-zinc-900">Vehicle lookup</div>
      <div className="text-[10px] text-zinc-500">Decode any VIN — recalls included</div>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-9 rounded-lg border border-zinc-200 flex items-center px-3 gap-2">
          <ScanLine className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[11px] font-mono text-zinc-700">JTDBR32E652052821</span>
        </div>
        <span className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold flex items-center">Decode</span>
      </div>
      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex items-center justify-between">
        <div>
          <div className="text-[9px] text-zinc-500 uppercase">Vehicle</div>
          <div className="font-semibold text-zinc-900 text-sm">2005 Toyota Corolla LE</div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-red-50 text-red-600 border border-red-200">1 open recall</span>
      </div>
      <div className="mt-3">
        <div className="text-[10px] font-semibold text-zinc-800">Parts that fit</div>
        <div className="mt-2 space-y-1.5">
          {[
            { p: "Front brake pads", fit: "Direct fit", on: "In stock" },
            { p: "Oil filter", fit: "Direct fit", on: "In stock" },
            { p: "Cabin air filter", fit: "Universal", on: "Order" },
          ].map((r) => (
            <div key={r.p} className="flex items-center justify-between text-[10px] border border-zinc-100 rounded-lg px-2.5 py-1.5">
              <span className="text-zinc-700">{r.p}</span>
              <span className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{r.fit}</span>
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${r.on === "In stock" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{r.on}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </WindowChrome>
);

const InventoryMock = () => (
  <WindowChrome label="vultrix.net/inventory">
    <div className="p-4 text-left">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-base font-extrabold text-zinc-900">Inventory</div>
          <div className="text-[10px] text-zinc-500">Auto-deducts when used on a repair order</div>
        </div>
        <span className="h-7 px-2.5 rounded-lg border border-zinc-200 text-[10px] font-semibold text-zinc-700 flex items-center gap-1"><QrCode className="h-3 w-3" /> Print QR</span>
      </div>
      <div className="mt-3 rounded-xl border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-1.5 bg-zinc-50 text-[9px] font-semibold text-zinc-500 uppercase">
          <span className="col-span-5">Part</span><span className="col-span-2 text-right">Cost</span><span className="col-span-2 text-right">On hand</span><span className="col-span-3 text-right">Status</span>
        </div>
        {[
          { p: "Brake cleaner", c: "$12.99", h: "6", s: "In stock", ok: true },
          { p: "5W-30 synthetic", c: "$26.50", h: "18", s: "In stock", ok: true },
          { p: "Oil filter (common)", c: "$4.20", h: "2", s: "Low", ok: false },
        ].map((r) => (
          <div key={r.p} className="grid grid-cols-12 px-3 py-2 text-[10px] border-t border-zinc-100 items-center">
            <span className="col-span-5 text-zinc-700">{r.p}</span>
            <span className="col-span-2 text-right text-zinc-500">{r.c}</span>
            <span className="col-span-2 text-right text-zinc-700">{r.h}</span>
            <span className="col-span-3 text-right"><span className={`px-1.5 py-0.5 rounded-full font-semibold ${r.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{r.s}</span></span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-16 w-16 rounded-lg border border-zinc-200 grid place-items-center bg-white">
          <QrCode className="h-10 w-10 text-zinc-900" />
        </div>
        <div className="text-[10px] text-zinc-600">
          <div className="font-semibold text-zinc-800">Scan-to-find labels</div>
          Stick one on each shelf bin. Scan to pull the part up instantly.
        </div>
      </div>
    </div>
  </WindowChrome>
);

const ReminderMock = () => (
  <WindowChrome label="vultrix.net/reminders">
    <div className="p-4 text-left">
      <div className="font-display text-base font-extrabold text-zinc-900">Service reminders</div>
      <div className="text-[10px] text-zinc-500">Customers who haven't been in for 6+ months</div>
      <div className="mt-2 inline-flex items-center gap-2 text-[10px] text-zinc-600">
        <Calendar className="h-3.5 w-3.5" /> 271 customers due a nudge
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { n: "Robert S.", v: "2014 Jeep Cherokee", d: "61 months ago" },
          { n: "Carlos G.", v: "2017 Toyota Sienna", d: "58 months ago" },
          { n: "Sandy B.", v: "2013 Chrysler Town & Country", d: "54 months ago" },
        ].map((r) => (
          <div key={r.n} className="flex items-center justify-between border border-zinc-100 rounded-lg px-3 py-2">
            <div>
              <div className="text-[11px] font-semibold text-zinc-800">{r.n}</div>
              <div className="text-[9px] text-zinc-500">{r.v} · last visit {r.d}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-6 px-2 rounded-md bg-zinc-900 text-white text-[9px] font-semibold flex items-center">Text</span>
              <span className="h-6 px-2 rounded-md border border-zinc-200 text-zinc-700 text-[9px] font-semibold flex items-center">Email</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <CheckCircle2 className="h-3.5 w-3.5" /> 12 customers booked back in this month
      </div>
    </div>
  </WindowChrome>
);

const IntakeMock = () => (
  <WindowChrome label="vultrix.net/i/your-shop">
    <div className="p-4 text-left">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-base font-extrabold text-zinc-900">Ticket intake</div>
          <div className="text-[10px] text-zinc-500">No login · scan, fill, done</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-semibold"><ScanLine className="h-3 w-3" /> No login</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">Scan to start</div>
          <div className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-lg bg-white border border-zinc-200">
            <QrCode className="h-10 w-10 text-zinc-900" />
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-[9px] text-zinc-500"><Smartphone className="h-3 w-3" /> From the bay or road</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="text-[9px] font-semibold text-zinc-800">New service ticket</div>
          <div className="mt-2 space-y-1.5">
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="h-4 rounded-md bg-zinc-100" />
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600"><Car className="h-3 w-3" /> 2018 Honda Civic</div>
            <div className="h-8 rounded-md bg-zinc-100" />
          </div>
          <div className="mt-2 h-6 rounded-md bg-zinc-900 text-white text-[9px] font-semibold flex items-center justify-center">Create ticket</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <CheckCircle2 className="h-3.5 w-3.5" /> Ticket #1043 created — sent to the office queue
      </div>
    </div>
  </WindowChrome>
);

const MOCKS = { workorder: WorkOrderMock, lookup: LookupMock, inventory: InventoryMock, reminder: ReminderMock, intake: IntakeMock };

/* ----------------------------------------------------------------------------
   NAVBAR
---------------------------------------------------------------------------- */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? "bg-white/85 backdrop-blur-md border-b border-zinc-200" : "bg-transparent border-b border-transparent"}`}>
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <VultrixLogo />
          <span className={`font-display text-lg font-extrabold tracking-tight ${scrolled ? "text-zinc-900" : "text-white"}`}>{SITE.brand}</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${scrolled ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100" : "text-zinc-200 hover:text-white hover:bg-white/10"}`}>{l.label}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a href={URLS.login} className={`${btnBase} h-10 px-4 text-sm ${scrolled ? "text-zinc-700 hover:bg-zinc-100" : "text-white hover:bg-white/10"}`}>Log in</a>
          <a href={URLS.signup} className={`${btnBase} h-10 px-4 text-sm bg-zinc-900 text-white hover:bg-zinc-800`}>Sign up <ArrowRight className="ml-1.5 h-4 w-4" /></a>
        </div>
        <button className={`md:hidden p-2 rounded-lg ${scrolled ? "text-zinc-900 hover:bg-zinc-100" : "text-white hover:bg-white/10"}`} aria-label="Open menu" onClick={() => setOpen((o) => !o)}>
          <Menu className="h-6 w-6" />
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-white border-t border-zinc-200 px-4 py-4">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-3 rounded-lg text-base font-medium text-zinc-700 hover:bg-zinc-100">{l.label}</a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <a href={URLS.signup} className={`${btnBase} w-full h-11 bg-zinc-900 text-white hover:bg-zinc-800`}>Sign up</a>
            <a href={URLS.login} className={`${btnBase} w-full h-11 border border-zinc-300 text-zinc-800 hover:bg-zinc-50`}>Log in</a>
          </div>
        </div>
      )}
    </header>
  );
};

/* ----------------------------------------------------------------------------
   SECTIONS
---------------------------------------------------------------------------- */
const Hero = () => (
  <section id="top" className="relative overflow-hidden bg-zinc-950 text-white">
    <div className="absolute inset-0 vx-hero-glow" aria-hidden="true" />
    <div className="absolute inset-0 vx-dots opacity-60" aria-hidden="true" />
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        <Reveal className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
            <HardHat className="h-3.5 w-3.5" /> Built by a working mechanic
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.05]">
            Run your whole shop from <span className="text-amber-400">one screen.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-zinc-300 leading-relaxed max-w-xl">
            Repair orders, invoices, the parts that fit, inventory, reminders, and reporting — all in one place. {SITE.brand} replaces the clunky, overpriced legacy tools with something fast, clean, and made for the bay.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={URLS.signup} className={`${btnBase} h-12 px-6 bg-amber-500 text-zinc-950 hover:bg-amber-400 text-base`}>Start your {SITE.trialDays}-day free trial <ArrowRight className="ml-2 h-4 w-4" /></a>
            <a href="#features" className={`${btnBase} h-12 px-6 border border-zinc-700 text-white hover:bg-white/10 text-base`}>See everything it does</a>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            <span className="font-semibold text-white">${SITE.price}/mo</span>
            {TRUST_BADGES.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1.5"><b.icon className="h-4 w-4 text-amber-400" /> {b.label}</span>
            ))}
          </div>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={0.1}>
          <DashboardMock />
        </Reveal>
      </div>
    </div>
  </section>
);

const CredibilityStrip = () => (
  <section className="border-b border-zinc-200 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CREDIBILITY.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><c.icon className="h-5 w-5" /></span>
            <span className="text-sm font-medium text-zinc-700">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const WhatIs = () => (
  <section id="about" className="scroll-anchor bg-[#fafafa]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <Reveal className="lg:col-span-6">
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">What is {SITE.brand}?</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">The shop management system mechanics actually want to use</h2>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 leading-relaxed">{SITE.brand} is an all-in-one platform for independent auto repair shops. Write up a repair order, see the parts that fit the vehicle, send a professional invoice, track your inventory, and keep customers coming back — without bouncing between five different tools or paying enterprise prices.</p>
          <p className="mt-4 text-base text-zinc-600 leading-relaxed">It runs in any browser, on the shop computer, your phone, or a tablet in the bay. Your data is always yours, and you can export it anytime.</p>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={0.1}>
          <div className="rounded-[18px] bg-white border border-zinc-200 shadow-sm p-6 sm:p-8">
            <div className="text-sm font-semibold text-zinc-900">What you get out of the box</div>
            <ul className="mt-4 space-y-4">
              {WHAT_IS.map((w) => (
                <li key={w} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" /><span className="text-zinc-700">{w}</span></li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

const FounderStory = () => (
  <section className="bg-white border-y border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <Reveal className="lg:col-span-7">
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Why I built it</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">I got tired of clunky, overpriced tools. So I built a better one.</h2>
          <div className="mt-5 space-y-4 text-base text-zinc-600 leading-relaxed">
            <p>I work on cars. The software I was stuck with was slow, confusing, and cost a small fortune every month — and it still couldn't do half of what a busy shop actually needs.</p>
            <p>So I built {SITE.brand}: the system I wish I'd had on day one. Everything a shop touches in a day — estimates, parts, inventory, customers, reminders, and the money — in one fast, clean place. No fluff, no lock-in, no enterprise price tag.</p>
          </div>
        </Reveal>
        <Reveal className="lg:col-span-5" delay={0.1}>
          <figure className="relative rounded-[18px] bg-zinc-950 text-white p-8 overflow-hidden">
            <div className="absolute inset-0 vx-dots opacity-50" aria-hidden="true" />
            <Quote className="relative h-8 w-8 text-amber-400" />
            <blockquote className="relative mt-4 font-display text-xl font-bold leading-snug">“If it doesn't make the day in the bay faster, it doesn't belong in the software.”</blockquote>
            <figcaption className="relative mt-5 text-sm text-zinc-400">— The {SITE.brand} founder, {SITE.owner}</figcaption>
          </figure>
        </Reveal>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section id="features" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Everything in one place</div>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">One subscription. Every tool your shop runs on.</h2>
        <p className="mt-4 text-zinc-600 max-w-2xl">{SITE.brand} brings the whole shop together — no more juggling logins, spreadsheets, and sticky notes.</p>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.05}>
            <div className="group h-full rounded-[14px] bg-white border border-zinc-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:border-zinc-300 transition-shadow">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors"><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-display text-base font-bold text-zinc-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const DeepDives = () => (
  <section id="deep-dives" className="scroll-anchor bg-[#fafafa] border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16 sm:space-y-24">
      {DEEP_DIVES.map((d, i) => {
        const Mock = MOCKS[d.mock];
        const reverse = i % 2 === 1;
        return (
          <div key={d.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <Reveal className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
              <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">{d.eyebrow}</div>
              <h3 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">{d.title}</h3>
              <ul className="mt-5 space-y-3">
                {d.points.map((p) => (
                  <li key={p} className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></span><span className="text-zinc-700">{p}</span></li>
                ))}
              </ul>
            </Reveal>
            <Reveal className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`} delay={0.1}><Mock /></Reveal>
          </div>
        );
      })}
    </div>
  </section>
);

const Stats = () => (
  <section className="bg-zinc-950 text-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-amber-400"><Counter value={s.value} prefix={s.prefix || ""} suffix={s.suffix || ""} /></div>
            <div className="mt-2 text-sm text-zinc-400">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ImportSection = () => {
  const STEPS = [
    { icon: Upload, title: "Import by CSV", desc: "Bring your customers, vehicles, and history straight in." },
    { icon: RefreshCw, title: "Pick up where you left off", desc: "Your jobs, parts, and numbers organized from day one." },
    { icon: ShieldCheck, title: "Your data stays yours", desc: "Export anytime. No lock-in, no holding your shop hostage." },
  ];
  return (
    <section className="bg-[#fafafa] border-t border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Make the switch</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">Switch in minutes. Your data stays yours.</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="h-full rounded-[14px] bg-white border border-zinc-200 p-6 shadow-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900"><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-display text-lg font-bold text-zinc-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const ShopRecommendation = () => {
  const live = Boolean(URLS.shopUrl);
  return (
    <section className="bg-[#fafafa]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <Reveal>
          <div className="rounded-[18px] bg-zinc-950 text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-0 vx-hero-glow opacity-70" aria-hidden="true" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300"><Store className="h-3.5 w-3.5" /> Proven in a real, working shop</div>
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold tracking-tight">{SITE.brand} runs the floor at {URLS.shopName}</h2>
                <p className="mt-3 text-zinc-300">Every feature here is battle-tested in a busy shop, day in and day out. Want to see the shop behind the software?</p>
              </div>
              <div className="shrink-0">
                {live ? (
                  <a href={URLS.shopUrl} target="_blank" rel="noopener noreferrer" className={`${btnBase} h-12 px-6 bg-amber-500 text-zinc-950 hover:bg-amber-400`}>Visit {URLS.shopName} <ArrowUpRight className="ml-2 h-4 w-4" /></a>
                ) : (
                  <span className={`${btnBase} h-12 px-6 bg-zinc-800 text-zinc-400 cursor-not-allowed`}><MapPin className="mr-2 h-4 w-4" /> Shop site coming soon</span>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Roadmap = () => (
  <section id="roadmap" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">The road ahead</div>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">What's coming to {SITE.brand}</h2>
        <p className="mt-4 text-zinc-600 max-w-2xl">{SITE.brand} keeps getting better. Here's what's on the roadmap — these are planned features in active thinking, not promises on specific dates.</p>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {ROADMAP.map((r, i) => {
          const soon = r.status === "Coming soon";
          return (
            <Reveal key={r.title} delay={(i % 3) * 0.05}>
              <div className="h-full rounded-[14px] bg-[#fafafa] border border-zinc-200 p-6 hover:border-zinc-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900"><r.icon className="h-5 w-5" /></span>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${soon ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-700"}`}>{r.status}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-zinc-900">{r.title}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{r.note}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={0.1}><p className="mt-8 text-xs text-zinc-500">Roadmap items are subject to change. Have a request? <a href="#contact" className="font-medium text-zinc-700 underline underline-offset-2">Tell us what you'd build.</a></p></Reveal>
    </div>
  </section>
);

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
const Pricing = () => {
  const [billing, setBilling] = useState("monthly");
  const annual = billing === "annual";
  const annualTotal = (m) => m * (12 - SITE.annualMonthsFree);
  const perMo = (m) => annualTotal(m) / 12;
  return (
    <section id="pricing" className="scroll-anchor bg-[#fafafa] border-t border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Reveal>
          <div className="text-center">
            <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Simple, affordable pricing</div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">One plan. Everything included.</h2>
            <p className="mt-4 text-zinc-600 max-w-xl mx-auto">No tiers to decode, no per-feature upsells. One flat price with every tool Vultrix has — and a free trial to start.</p>
            <div className="flex justify-center">
              <div className="mt-7 inline-flex items-center rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
                <button onClick={() => setBilling("monthly")} className={`px-4 h-9 rounded-full text-sm font-semibold transition-colors ${!annual ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}>Monthly</button>
                <button onClick={() => setBilling("annual")} className={`px-4 h-9 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-2 ${annual ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}>Annual <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annual ? "bg-amber-400 text-zinc-950" : "bg-amber-100 text-amber-700"}`}>{SITE.annualMonthsFree} months free</span></button>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 grid grid-cols-1 gap-6 max-w-md mx-auto">
            {TIERS.map((t) => (
              <div key={t.id} className={`relative flex flex-col rounded-[20px] p-7 sm:p-8 bg-white ${t.highlight ? "border-2 border-amber-400 shadow-[0_18px_50px_-18px_rgba(245,158,11,0.45)]" : "border border-zinc-200 shadow-sm"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-extrabold tracking-tight text-zinc-900">{t.name}</h3>
                  {t.badge && <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${t.available ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-600"}`}>{t.badge}</span>}
                </div>
                <p className="mt-1.5 text-sm text-zinc-600">{t.tagline}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="font-display text-5xl font-extrabold tracking-tight text-zinc-900">{annual ? money(annualTotal(t.monthly)) : money(t.monthly)}</span>
                  <span className="mb-1.5 text-zinc-500">{annual ? "/yr" : "/mo"}</span>
                </div>
                <div className="mt-1 h-5 text-xs text-zinc-500">{annual ? `Just ${money(perMo(t.monthly))}/mo — ${SITE.annualMonthsFree} months free` : "Billed monthly"}</div>
                <a href={t.href} {...(t.available ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`${btnBase} mt-6 w-full h-12 ${t.available ? "bg-zinc-900 text-white hover:bg-zinc-800" : "border border-zinc-300 text-zinc-800 hover:bg-zinc-50"}`}>{t.cta}{t.available && <ArrowRight className="ml-2 h-4 w-4" />}</a>
                <ul className="mt-7 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></span><span className="text-sm text-zinc-700">{f}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {TRUST_BADGES.map((b) => (<span key={b.label} className="inline-flex items-center gap-1.5 text-sm text-zinc-600"><b.icon className="h-4 w-4 text-amber-500" /> {b.label}</span>))}
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-md">{SITE.trialDays}-day free trial. You won't be charged until your trial ends. Billing is securely handled by Stripe.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Comparison = () => (
  <section className="bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal><h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 text-center">{SITE.brand} vs. the old way</h2></Reveal>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Reveal>
          <div className="rounded-[18px] border border-zinc-200 bg-[#fafafa] p-7">
            <div className="font-display text-lg font-bold text-zinc-500">The old way</div>
            <ul className="mt-5 space-y-3.5">{COMPARISON.oldWay.map((o) => (<li key={o} className="flex items-start gap-3 text-zinc-500"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 shrink-0"><X className="h-3.5 w-3.5" /></span><span className="text-sm">{o}</span></li>))}</ul>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-[18px] border-2 border-amber-400 bg-white p-7 shadow-[0_10px_40px_-16px_rgba(245,158,11,0.5)]">
            <div className="font-display text-lg font-bold text-zinc-900">With {SITE.brand}</div>
            <ul className="mt-5 space-y-3.5">{COMPARISON.vultrix.map((v) => (<li key={v} className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></span><span className="text-sm text-zinc-800 font-medium">{v}</span></li>))}</ul>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

const Faq = () => {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section id="faq" className="scroll-anchor bg-[#fafafa] border-t border-zinc-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Reveal>
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Questions</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">Frequently asked</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            {FAQS.map((f, i) => (
              <div key={f.q}>
                <button onClick={() => setOpenIdx(openIdx === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 py-4 text-left font-display text-base font-semibold text-zinc-900">
                  {f.q}
                  <ArrowRight className={`h-4 w-4 shrink-0 transition-transform ${openIdx === i ? "rotate-90 text-amber-600" : "text-zinc-400"}`} />
                </button>
                {openIdx === i && <p className="pb-4 -mt-1 text-zinc-600 text-[15px] leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const ContactForm = () => {
  const [form, setForm] = useState({ name: "", shop: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError("Please add your name and email."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, source: "contact" }) });
      if (!res.ok) throw new Error();
      setDone(true);
      setForm({ name: "", shop: "", email: "", phone: "", message: "" });
    } catch { setError("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  const inputCls = "mt-1.5 w-full h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400";
  if (done) {
    return (
      <div className="rounded-[14px] bg-white border border-zinc-200 shadow-sm p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center"><CheckCircle2 className="h-7 w-7 text-green-600" /></div>
        <h3 className="mt-4 font-display text-xl font-bold text-zinc-900">Message received</h3>
        <p className="mt-2 text-sm text-zinc-600">Thanks for reaching out. We'll get back to you at the email you provided.</p>
        <button onClick={() => setDone(false)} className={`${btnBase} mt-5 h-10 px-4 border border-zinc-300 text-zinc-800 hover:bg-zinc-50`}>Send another message</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="rounded-[14px] bg-white border border-zinc-200 shadow-sm p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm text-zinc-700">Name</label><input value={form.name} onChange={upd("name")} placeholder="Your name" className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">Shop name</label><input value={form.shop} onChange={upd("shop")} placeholder="Your shop" className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">Email</label><input type="email" value={form.email} onChange={upd("email")} placeholder="you@yourshop.com" className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">Phone <span className="text-zinc-400">(optional)</span></label><input value={form.phone} onChange={upd("phone")} placeholder="(555) 555-5555" className={inputCls} /></div>
      </div>
      <div className="mt-4"><label className="text-sm text-zinc-700">How can we help?</label><textarea value={form.message} onChange={upd("message")} placeholder="Tell us about your shop or ask a question…" className="mt-1.5 w-full min-h-[120px] rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={`${btnBase} mt-5 w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 text-base`}>{busy ? "Sending…" : (<>Send message <Send className="ml-2 h-4 w-4" /></>)}</button>
      <p className="mt-3 text-xs text-zinc-500 text-center">We'll never share your details. No spam, ever.</p>
    </form>
  );
};

const Contact = () => (
  <section id="contact" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <Reveal className="lg:col-span-5">
          <div className="text-sm font-semibold text-amber-600 uppercase tracking-wide">Get in touch</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">Talk to a real person</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">Questions about {SITE.brand}, want a walkthrough, or thinking about switching your shop over? Send a note or give us a call.</p>
          <ul className="mt-6 space-y-4">
            <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Phone className="h-5 w-5" /></span><a href={`tel:${SITE.phoneHref}`} className="hover:text-zinc-900 font-medium">{SITE.phone}</a></li>
            {SITE.supportEmail ? (
              <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Mail className="h-5 w-5" /></span><a href={`mailto:${SITE.supportEmail}`} className="hover:text-zinc-900">{SITE.supportEmail}</a></li>
            ) : (
              <li className="flex items-start gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 shrink-0"><Mail className="h-5 w-5" /></span><span>Reach us through the form — we'll reply by email.</span></li>
            )}
            <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Clock className="h-5 w-5" /></span>We usually reply within one business day</li>
          </ul>
          <div className="mt-8 rounded-[14px] bg-[#fafafa] border border-zinc-200 p-5">
            <div className="text-sm font-semibold text-zinc-900">Ready to jump in?</div>
            <p className="mt-1 text-sm text-zinc-600">Start your {SITE.trialDays}-day free trial — no card charged until it ends.</p>
            <a href={URLS.signup} className={`${btnBase} mt-3 h-11 px-4 bg-zinc-900 text-white hover:bg-zinc-800`}>Start free trial <ArrowRight className="ml-2 h-4 w-4" /></a>
          </div>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.1}><ContactForm /></Reveal>
      </div>
    </div>
  </section>
);

const FinalCta = () => (
  <section className="bg-zinc-950 text-white relative overflow-hidden">
    <div className="absolute inset-0 vx-hero-glow" aria-hidden="true" />
    <div className="absolute inset-0 vx-dots opacity-50" aria-hidden="true" />
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <Reveal>
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">Run your shop like a system.</h2>
        <p className="mt-4 text-lg text-zinc-300 max-w-xl mx-auto">Try {SITE.brand} free for {SITE.trialDays} days. ${SITE.price}/month after that. Cancel anytime.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a href={URLS.signup} className={`${btnBase} h-12 px-7 bg-amber-500 text-zinc-950 hover:bg-amber-400 text-base`}>Start your free trial <ArrowRight className="ml-2 h-4 w-4" /></a>
          <a href={URLS.login} className={`${btnBase} h-12 px-7 border border-zinc-700 text-white hover:bg-white/10 text-base`}>Log in</a>
        </div>
      </Reveal>
    </div>
  </section>
);

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-zinc-950 text-zinc-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2"><VultrixLogo /><span className="font-display text-xl font-extrabold tracking-tight text-white">{SITE.brand}</span></div>
            <p className="mt-4 text-sm text-zinc-400 max-w-sm leading-relaxed">{SITE.tagline}. The all-in-one shop management platform built by a working mechanic, for working shops.</p>
          </div>
          <div className="md:col-span-3">
            <div className="text-sm font-semibold text-white">Product</div>
            <ul className="mt-4 space-y-3 text-sm">{NAV_LINKS.map((l) => (<li key={l.href}><a href={l.href} className="text-zinc-400 hover:text-white transition-colors">{l.label}</a></li>))}</ul>
          </div>
          <div className="md:col-span-4">
            <div className="text-sm font-semibold text-white">Get started</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href={URLS.signup} className="text-zinc-400 hover:text-white transition-colors">Start free trial</a></li>
              <li><a href={URLS.login} className="text-zinc-400 hover:text-white transition-colors">Log in</a></li>
              <li><a href="#contact" className="text-zinc-400 hover:text-white transition-colors">Contact us</a></li>
              <li><a href={`tel:${SITE.phoneHref}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"><Phone className="h-4 w-4" /> {SITE.phone}</a></li>
              {SITE.supportEmail && (<li><a href={`mailto:${SITE.supportEmail}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"><Mail className="h-4 w-4" /> {SITE.supportEmail}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">© {year} {SITE.owner}. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href={URLS.terms} className="text-zinc-400 hover:text-white">Terms</a>
            <a href={URLS.privacy} className="text-zinc-400 hover:text-white">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ----------------------------------------------------------------------------
   PAGE
---------------------------------------------------------------------------- */
export default function VultrixLanding() {
  return (
    <div className="min-h-screen bg-[#fafafa] overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <CredibilityStrip />
        <WhatIs />
        <FounderStory />
        <Features />
        <DeepDives />
        <Stats />
        <ImportSection />
        <ShopRecommendation />
        <Roadmap />
        <Pricing />
        <Comparison />
        <Faq />
        <Contact />
        <FinalCta />
      </main>
      <Footer />
      <VultrixAssistant
        brand={SITE.brand}
        price={SITE.price}
        trialDays={SITE.trialDays}
        phone={SITE.phone}
        phoneHref={SITE.phoneHref}
        shopName={URLS.shopName}
        shopUrl={URLS.shopUrl}
        signupUrl={URLS.signup}
      />
    </div>
  );
}
