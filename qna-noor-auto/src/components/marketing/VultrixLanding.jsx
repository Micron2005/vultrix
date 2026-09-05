"use client";
/* eslint-disable */
// Vultrix marketing landing page — self-contained drop-in for Next.js (App Router).
// Dependencies: Tailwind CSS (already in your repo) + lucide-react (already installed).
// No framer-motion needed (animations use IntersectionObserver + CSS).
// Place at: src/components/marketing/VultrixLanding.jsx (or components/marketing/).
// See README-VULTRIX-LANDING.md for wiring + the CSS snippet + Prisma model.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { accentVarsFromHex } from "@/lib/appearance";
import { DEFAULT_LANDING_CONFIG } from "@/lib/landingConfig";
import { SUPPORT_EMAIL } from "@/lib/branding";
import {
  Wrench, FileText, Car, Search, Boxes, Package, QrCode, Bell, Calendar,
  UserCog, Building2, Receipt, BarChart3, Upload, ClipboardList, Users,
  ShieldCheck, Smartphone, Download, HardHat, Bot, Globe, Store, MessageSquare,
  CreditCard, Clock, BadgeCheck, ArrowRight, ArrowUpRight, Check, X,
  Menu, Mail, Phone, MapPin, RefreshCw, Send, CheckCircle2, LayoutDashboard,
  ScanLine, Plus, Home,
  Star, Heart, Zap, Target, Sparkles,
} from "lucide-react";
import VultrixAssistant from "./VultrixAssistant";
import { VultrixMark } from "../VultrixMark";

const LandingConfigContext = createContext(DEFAULT_LANDING_CONFIG);
const ICONS = {
  Wrench, FileText, Car, Search, Boxes, Package, QrCode, Bell, Calendar,
  UserCog, Building2, Receipt, BarChart3, Upload, ClipboardList, Users,
  ShieldCheck, Smartphone, Download, HardHat, Bot, Globe, Store, MessageSquare,
  CreditCard, Clock, BadgeCheck, CheckCircle2, LayoutDashboard, ScanLine, Home,
  RefreshCw, Star, Heart, Zap, Target, Sparkles,
};
const useLandingConfig = () => useContext(LandingConfigContext);
const text = (value, cfg, trialDays) =>
  String(value ?? "")
    .replaceAll("{brand}", cfg.site.brand)
    .replaceAll("{shopName}", cfg.site.shopName)
    .replaceAll("{tagline}", cfg.site.tagline)
    .replaceAll("{trialDays}", String(trialDays));
const icon = (name) => ICONS[name] || Star;

/* ----------------------------------------------------------------------------
   CONFIG — edit freely
---------------------------------------------------------------------------- */
const SITE = {
  brand: "Vultrix",
  owner: "M.S.A.M Enterprise",
  tagline: "One system to run your business — and your life.",
  trialDays: 60,
  annualMonthsFree: 2,
  supportEmail: SUPPORT_EMAIL, // empty = hide email, route to the form
  phone: "571-320-9425",
  phoneHref: "+15713209425",
};

// Plan pricing — the single source of truth for every price shown on the page.
// Personal is a base price with an optional invoices add-on.
const PRICING = {
  auto: 35,
  business: 25,
  personalBase: 15,
  invoicesAddon: 10, // Personal: turns on invoices + customer management
  startingPrice: 15, // lowest entry point, used for "plans from $X" copy
};

const URLS = {
  signup: "/signup", // internal Next routes (this runs ON vultrix.net)
  login: "/login",
  demo: "/demo", // live, self-resetting demo sandbox
  terms: "/terms",
  privacy: "/privacy",
  status: "/status",
  shopName: "QNA / Noor Auto Repair",
  shopUrl: "https://qna-noorautorepair.com", 
};

const NAV_LINKS = [
  { label: "Who it's for", href: "#who" },
  { label: "Features", href: "#features" },
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

// Who Vultrix is for — mirrors the account types you pick at sign-up.
const AUDIENCES = [
  {
    icon: Wrench,
    kicker: "Auto repair shops",
    title: "The shop, fully handled",
    desc: "The flagship toolkit Vultrix was born in — the complete workflow for a busy bay.",
    points: [
      "Estimates → approved → in progress → paid",
      "VIN decode, parts that fit & inventory",
      "Technicians, reminders & scheduling",
    ],
  },
  {
    icon: Store,
    kicker: "Small businesses",
    title: "Any business, your way",
    desc: "Switch off the auto-specific parts and keep exactly what your business needs.",
    points: [
      "Professional invoices & online payments",
      "Inventory & expense tracking",
      "Clear financial reports",
    ],
  },
  {
    icon: Home,
    kicker: "Personal use",
    title: "Life, organized",
    desc: "Track your money, plan your week, and capture ideas — with an AI assistant that does it for you.",
    points: [
      "Income & expense tracking",
      "Calendar, reminders & notes",
      "Built-in voice & chat AI assistant",
    ],
  },
];

// Features available across accounts. Invoicing & customers are built in for
// auto shops and businesses, and an optional add-on for personal accounts.
const GENERAL_FEATURES = [
  { icon: FileText, title: "Invoices & estimates", desc: "Clean, professional PDFs and shareable links your customers can approve and pay from their phone.", tag: "Optional on Personal" },
  { icon: CreditCard, title: "Online payments", desc: "Get paid faster — customers pay from a phone or a shared link, securely through Stripe.", tag: "Optional on Personal" },
  { icon: Users, title: "Customers & contacts", desc: "A searchable record of everyone you do business with, with full job and invoice history.", tag: "Optional on Personal" },
  { icon: Package, title: "Inventory", desc: "Track cost, price, and on-hand stock with QR shelf labels and low-stock alerts. Optional." },
  { icon: Receipt, title: "Income & expenses", desc: "Log money in and money out by category so your numbers always stay straight." },
  { icon: BarChart3, title: "Reports", desc: "See revenue, what's owed, and where the money's going — all at a glance." },
  { icon: Calendar, title: "Scheduling & calendar", desc: "Plan your day and week and set reminders so nothing important slips through." },
  { icon: ClipboardList, title: "Notes & knowledge", desc: "Capture notes, checklists, and reference info you can search back through later." },
  { icon: Upload, title: "Import & export", desc: "Bring your data in by CSV and take it with you anytime. No lock-in, ever." },
  { icon: UserCog, title: "Multi-user roles", desc: "Add your whole team with roles for owners, managers, and staff." },
];

// Features that only make sense for — and are only shown to — auto repair shops.
const AUTO_FEATURES = [
  { icon: Wrench, title: "Repair & work orders", desc: "Full lifecycle from estimate to paid, with labor and parts lines and technician assignment." },
  { icon: ScanLine, title: "On-the-go ticket intake", desc: "Techs scan a QR to start a ticket from their phone — no login. It lands in the office queue to price, order parts, and invoice." },
  { icon: Car, title: "Vehicles & history", desc: "Every vehicle gets a searchable history of past jobs, parts, and invoices." },
  { icon: Search, title: "VIN decode & plate search", desc: "Decode any VIN in seconds with open recalls included, or pull up a saved vehicle by its plate." },
  { icon: Boxes, title: "Parts that fit", desc: "See parts tagged to the exact vehicle and jump straight to your suppliers in one click." },
  { icon: Bell, title: "Service reminders", desc: "Find customers who've gone quiet and win them back with one tap to text or email." },
  { icon: HardHat, title: "Technicians & hours", desc: "Assign work and track logged hours for every technician." },
  { icon: BadgeCheck, title: "Canned jobs & presets", desc: "Save your common jobs and drop them onto a repair order in seconds." },
];

const STATS = [
  { value: 60, suffix: "", label: "Days free to try" },
  { value: PRICING.startingPrice, prefix: "$", suffix: "", label: "To start, per month" },
  { value: GENERAL_FEATURES.length + AUTO_FEATURES.length, suffix: "+", label: "Tools in one place" },
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
    "Plans from $15/month",
    "A fast, clean, modern interface",
    "Export your data whenever you want",
    "Customers approve and pay from their phone",
    "Up and running the same day",
  ],
};

const ROADMAP = [
  { icon: Bot, status: "Live for Personal", title: "AI assistant for every account", note: "The built-in AI assistant is live on Personal accounts today — connect your own OpenAI or Anthropic key at no extra cost. Rolling out to business and shop accounts next." },
  { icon: Globe, status: "Planned", title: "Expanded worldwide vehicle data", note: "Broader vehicle coverage and deeper repair information beyond today's lookup sources." },
  { icon: Store, status: "Planned", title: "Customer-facing websites", note: "Give every account a clean public website tied right to their Vultrix data." },
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

// Three plans mirroring the account types you pick at sign-up. Personal is a
// base price with an optional invoices add-on handled on the card itself.
const PLANS = [
  {
    id: "auto",
    icon: Wrench,
    name: "Auto Repair Shop",
    monthly: PRICING.auto,
    badge: "Full shop toolkit",
    tagline: "The complete workflow Vultrix was born in — everything a busy bay runs on.",
    cta: "Start free trial",
    aiNote: "AI assistant coming soon",
    intro: "Everything in Business, plus:",
    features: [
      "Repair orders — estimate → approved → paid",
      "VIN decode, plate search & open recalls",
      "Parts that fit + QR inventory labels",
      "Technicians, logged hours & scheduling",
      "On-the-go QR ticket intake (no login)",
      "Service reminders to win customers back",
    ],
  },
  {
    id: "business",
    icon: Store,
    name: "Business",
    monthly: PRICING.business,
    badge: "Most popular",
    highlight: true,
    tagline: "Run any small business your way — turn off the auto-specific parts and keep what fits.",
    cta: "Start free trial",
    aiNote: "AI assistant coming soon",
    intro: "Everything you need to run day to day:",
    features: [
      "Professional invoices & online payments",
      "Customers & optional inventory",
      "Income, expenses & clear reports",
      "Scheduling & calendar",
      "Notes & searchable knowledge base",
      "CSV import / export — your data stays yours",
    ],
  },
  {
    id: "personal",
    icon: Home,
    name: "Personal",
    monthly: PRICING.personalBase,
    badge: "Life, organized",
    tagline: "Track your money, plan your week, and capture ideas — with an AI assistant that does it for you.",
    cta: "Start free trial",
    personal: true, // renders the interactive invoices toggle
    intro: "Built for everyday life:",
    features: [
      "Income & expense tracking",
      "Calendar, reminders & to-dos",
      "Notes & knowledge base",
      "CSV import / export",
    ],
  },
];

const FAQS = [
  { q: "Is there a contract?", a: "No. Vultrix is month-to-month and you can cancel anytime from your billing portal — no calls, no hoops." },
  { q: "How does the free trial work?", a: "You get 60 days free. You won't be charged until the trial ends, and you can cancel before then at no cost." },
  { q: "What does it cost?", a: "It depends on your account: an Auto Repair Shop is $35/month, a Business is $25/month, and a Personal account is $15/month. Personal accounts can add invoices & customers for $10/month. The Vultrix AI assistant is included on Personal when you connect your own OpenAI/Anthropic key at no extra cost." },
  { q: "Which account type should I pick?", a: "Pick Auto Repair Shop for the full shop workflow (repair orders, VIN/parts lookup, technicians). Pick Business to run any other small business with invoices, inventory, and reports. Pick Personal to organize your own money, calendar, and notes." },
  { q: "How does the AI assistant work?", a: "It's a built-in voice & chat assistant that can add calendar events, take notes, and answer questions. It's included on Personal accounts when you connect your own OpenAI/Anthropic key at no extra cost. Support for business and shop accounts is coming next." },
  { q: "Can I export my data?", a: "Yes. You can import and export by CSV whenever you like. Your data is yours — there's no lock-in." },
  { q: "Does it work on a phone or tablet?", a: "Yes. Vultrix runs in any modern browser, so it works on a computer, your phone, or a tablet." },
  { q: "Can my whole team use it?", a: "Absolutely. Add multiple users with roles for owners, managers, and staff." },
  { q: "Is my payment secure?", a: "Billing is handled by Stripe, an industry-leading payment processor. We never see or store your card details." },
  { q: "Can my customers pay online?", a: "Yes. On accounts with invoicing, customers can pay right from their phone or a shared link — no extra setup on your end." },
  { q: "Do you offer discounts?", a: "From time to time, yes. When we're running a promotion you'll get a code to enter at checkout, and the discount applies automatically." },
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
  const cfg = useLandingConfig();
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
          <VultrixMark variant="dark" className="h-9 w-9" />
          <span className={`font-display text-lg font-extrabold tracking-tight ${scrolled ? "text-zinc-900" : "text-white"}`}>{cfg.site.brand}</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {cfg.nav.map((l) => (
            <a key={l.href} href={l.href} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${scrolled ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100" : "text-zinc-200 hover:text-white hover:bg-white/10"}`}>{l.label}</a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a href={URLS.login} className={`${btnBase} h-10 px-4 text-sm ${scrolled ? "text-zinc-700 hover:bg-zinc-100" : "text-white hover:bg-white/10"}`}>{cfg.site.loginLabel}</a>
          <a href={URLS.signup} className={`${btnBase} h-10 px-4 text-sm bg-zinc-900 text-white hover:bg-zinc-800`}>{cfg.site.signupLabel} <ArrowRight className="ml-1.5 h-4 w-4" /></a>
        </div>
        <button className={`md:hidden p-2 rounded-lg ${scrolled ? "text-zinc-900 hover:bg-zinc-100" : "text-white hover:bg-white/10"}`} aria-label="Open menu" onClick={() => setOpen((o) => !o)}>
          <Menu className="h-6 w-6" />
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-white border-t border-zinc-200 px-4 py-4">
          <div className="flex flex-col gap-1">
          {cfg.nav.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-3 rounded-lg text-base font-medium text-zinc-700 hover:bg-zinc-100">{l.label}</a>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <a href={URLS.signup} className={`${btnBase} w-full h-11 bg-zinc-900 text-white hover:bg-zinc-800`}>{cfg.site.signupLabel}</a>
            <a href={URLS.login} className={`${btnBase} w-full h-11 border border-zinc-300 text-zinc-800 hover:bg-zinc-50`}>{cfg.site.loginLabel}</a>
          </div>
        </div>
      )}
    </header>
  );
};

/* ----------------------------------------------------------------------------
   SECTIONS
---------------------------------------------------------------------------- */
const Hero = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const hero = cfg.hero;
  return (
  <section id="top" className="relative overflow-hidden bg-[var(--vx-dark)] text-white">
    <div className="absolute inset-0 vx-hero-glow" aria-hidden="true" />
    {cfg.theme.pattern === "dots" && <div className="absolute inset-0 vx-dots opacity-60" aria-hidden="true" />}
    {cfg.theme.pattern === "grid" && <div className="absolute inset-0 vx-grid opacity-60" aria-hidden="true" />}
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        <Reveal className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--vx-accent)_10%,transparent)] px-3 py-1 text-xs font-medium text-[var(--vx-accent-soft)]">
            <HardHat className="h-3.5 w-3.5" /> {hero.badge}
          </div>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.05]">
            {hero.headline} <span className="text-[var(--vx-accent-soft)]">{hero.headlineAccent}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-zinc-300 leading-relaxed max-w-xl">
            {text(hero.body, cfg, trialDays)}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={URLS.signup} className={`${btnBase} h-12 px-6 bg-[var(--vx-accent)] text-[var(--vx-accent-fg)] hover:bg-[color-mix(in_srgb,var(--vx-accent)_85%,black)] text-base`}>{text(hero.ctaLabel, cfg, trialDays)} <ArrowRight className="ml-2 h-4 w-4" /></a>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            {hero.showFromPrice && <span className="font-semibold text-white">Plans from ${PRICING.startingPrice}/mo</span>}
            {hero.trustBadges.map((b) => {
              const Badge = icon(b.icon);
              return <span key={b.label} className="inline-flex items-center gap-1.5"><Badge className="h-4 w-4 text-[var(--vx-accent-soft)]" /> {b.label}</span>;
            })}
          </div>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={0.1}>
          <DashboardMock />
        </Reveal>
      </div>
    </div>
  </section>
  );
};

const CredibilityStrip = () => {
  const cfg = useLandingConfig();
  return (
  <section className="border-b border-zinc-200 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cfg.credibility.map((c) => {
          const CIcon = icon(c.icon);
          return (
          <div key={c.label} className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700"><CIcon className="h-5 w-5" /></span>
            <span className="text-sm font-medium text-zinc-700">{c.label}</span>
          </div>
          );
            })}
      </div>
    </div>
  </section>
  );
};

const WhatIs = () => {
  const cfg = useLandingConfig();
  const section = cfg.whatIs;
  return (
  <section id="about" className="scroll-anchor bg-[var(--vx-light)]">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <Reveal className="lg:col-span-6">
          <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{text(section.kicker, cfg)}</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">{section.title}</h2>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 leading-relaxed">{text(section.p1, cfg)}</p>
          <p className="mt-4 text-base text-zinc-600 leading-relaxed">{section.p2}</p>
        </Reveal>
        <Reveal className="lg:col-span-6" delay={0.1}>
          <div className="rounded-[18px] bg-white border border-zinc-200 shadow-sm p-6 sm:p-8">
            <div className="text-sm font-semibold text-zinc-900">{section.boxTitle}</div>
            <ul className="mt-4 space-y-4">
              {section.items.map((w) => (
                <li key={w} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" /><span className="text-zinc-700">{w}</span></li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
  );
};

const Audiences = () => {
  const cfg = useLandingConfig();
  const section = cfg.audiences;
  return (
  <section id="who" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">{section.title}</h2>
        <p className="mt-4 text-zinc-600 max-w-2xl">{text(section.body, cfg)}</p>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {section.cards.map((a, i) => {
          const AIcon = icon(a.icon);
          return (
          <Reveal key={a.kicker} delay={(i % 3) * 0.06}>
            <div className="h-full rounded-[16px] bg-white border border-zinc-200 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:border-zinc-300 transition-shadow">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-[var(--vx-accent-soft)]"><AIcon className="h-6 w-6" /></span>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--vx-accent)]">{a.kicker}</div>
              <h3 className="mt-1 font-display text-xl font-extrabold text-zinc-900">{a.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{a.desc}</p>
              <ul className="mt-4 space-y-2">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-zinc-700"><Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />{p}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          );
        })}
      </div>
      <Reveal delay={0.1}>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href={URLS.signup} className={`${btnBase} h-11 px-5 bg-zinc-900 text-white hover:bg-zinc-800 text-sm`}>{section.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" /></a>
        </div>
      </Reveal>
    </div>
  </section>
  );
};

const FounderStory = () => {
  const cfg = useLandingConfig();
  const section = cfg.founder;
  return (
  <section className="bg-white border-y border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-3xl">
        <Reveal>
          <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">{section.title}</h2>
          <div className="mt-5 space-y-4 text-base text-zinc-600 leading-relaxed">
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{text(paragraph, cfg)}</p>)}
          </div>
        </Reveal>
      </div>
    </div>
  </section>
  );
};

const FeatureCard = ({ f, i }) => (
  <Reveal delay={(i % 3) * 0.05} className="h-full">
    <div className="group h-full rounded-[14px] bg-white border border-zinc-200 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:border-zinc-300 transition-shadow">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-[var(--vx-accent-soft)] group-hover:bg-[var(--vx-accent)] group-hover:text-[var(--vx-accent-fg)] transition-colors"><f.icon className="h-5 w-5" /></span>
      <h3 className="mt-4 font-display text-base font-bold text-zinc-900">{f.title}</h3>
      <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
      {f.tag && <span className="mt-3 inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--vx-accent)_10%,white)] border border-[color-mix(in_srgb,var(--vx-accent)_25%,white)] px-2 py-0.5 text-[11px] font-semibold text-[var(--vx-accent)]">{f.tag}</span>}
    </div>
  </Reveal>
);

const Features = () => {
  const cfg = useLandingConfig();
  const section = cfg.features;
  return (
  <section id="features" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">{section.title}</h2>
        <p className="mt-4 text-zinc-600 max-w-2xl">{text(section.body, cfg)}</p>
      </Reveal>

      <div className="mt-12">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-[var(--vx-accent-soft)] shrink-0"><LayoutDashboard className="h-5 w-5" /></span>
            <div>
              <h3 className="font-display text-xl font-extrabold text-zinc-900">{section.generalTitle}</h3>
              <p className="text-sm text-zinc-600">{section.generalBody}</p>
            </div>
          </div>
        </Reveal>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {section.general.map((f, i) => (<FeatureCard key={f.title} f={{ ...f, icon: icon(f.icon) }} i={i} />))}
        </div>
      </div>

      <div className="mt-14">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--vx-accent)] text-[var(--vx-accent-fg)] shrink-0"><Wrench className="h-5 w-5" /></span>
            <div>
              <h3 className="font-display text-xl font-extrabold text-zinc-900">{section.autoTitle}</h3>
              <p className="text-sm text-zinc-600">{section.autoBody}</p>
            </div>
          </div>
        </Reveal>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {section.auto.map((f, i) => (<FeatureCard key={f.title} f={{ ...f, icon: icon(f.icon) }} i={i} />))}
        </div>
      </div>
    </div>
  </section>
  );
};

const DeepDives = () => {
  const cfg = useLandingConfig();
  return (
  <section id="deep-dives" className="scroll-anchor bg-[var(--vx-light)] border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16 sm:space-y-24">
      {cfg.deepDives.map((d, i) => {
        const Mock = MOCKS[d.mock] || DashboardMock;
        const reverse = i % 2 === 1;
        return (
          <div key={d.id} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <Reveal className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
              <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{d.eyebrow}</div>
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
};

const Stats = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const stats = cfg.stats.items.map((s) =>
    s.label === "Days free to try"
      ? { ...s, value: trialDays }
      : s.label === "Tools in one place"
        ? { ...s, value: cfg.features.general.length + cfg.features.auto.length }
        : s,
  );
  return (
    <section className="bg-[var(--vx-dark)] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--vx-accent-soft)]"><Counter value={s.value} prefix={s.prefix || ""} suffix={s.suffix || ""} /></div>
              <div className="mt-2 text-sm text-zinc-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ImportSection = () => {
  const cfg = useLandingConfig();
  const section = cfg.importSection;
  const STEPS = [
    ...section.points.map((step) => ({ ...step, icon: icon(step.icon) })),
  ];
  return (
  <section className="bg-[var(--vx-light)] border-t border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">{section.title}</h2>
          {section.body && <p className="mt-4 text-zinc-600 max-w-2xl">{text(section.body, cfg)}</p>}
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
  const cfg = useLandingConfig();
  const section = cfg.shopRecommendation;
  const live = Boolean(cfg.site.shopUrl);
  return (
    <section className="bg-[var(--vx-light)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <Reveal>
          <div className="rounded-[18px] bg-[var(--vx-dark)] text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-0 vx-hero-glow opacity-70" aria-hidden="true" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--vx-accent)_10%,transparent)] px-3 py-1 text-xs font-medium text-[var(--vx-accent-soft)]"><Store className="h-3.5 w-3.5" /> {section.kicker}</div>
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold tracking-tight">{text(section.title, cfg)}</h2>
                <p className="mt-3 text-zinc-300">{text(section.body, cfg)}</p>
              </div>
              <div className="shrink-0">
                {live ? (
                  <a href={cfg.site.shopUrl} target="_blank" rel="noopener noreferrer" className={`${btnBase} h-12 px-6 bg-[var(--vx-accent)] text-[var(--vx-accent-fg)] hover:bg-[color-mix(in_srgb,var(--vx-accent)_85%,black)]`}>{text(section.ctaLabel, cfg)} <ArrowUpRight className="ml-2 h-4 w-4" /></a>
                ) : (
                  <span className={`${btnBase} h-12 px-6 bg-zinc-800 text-zinc-400 cursor-not-allowed`}><MapPin className="mr-2 h-4 w-4" /> {section.fallbackCtaLabel}</span>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Roadmap = () => {
  const cfg = useLandingConfig();
  const section = cfg.roadmap;
  return (
  <section id="roadmap" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal>
        <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 max-w-2xl">{text(section.title, cfg)}</h2>
        <p className="mt-4 text-zinc-600 max-w-2xl">{text(section.body, cfg)}</p>
      </Reveal>
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {section.items.map((r, i) => {
          const RIcon = icon(r.icon);
          const soon = r.status === "Coming soon";
          const live = r.status.startsWith("Live");
          return (
            <Reveal key={r.title} delay={(i % 3) * 0.05}>
              <div className="h-full rounded-[14px] bg-[var(--vx-light)] border border-zinc-200 p-6 hover:border-zinc-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900"><RIcon className="h-5 w-5" /></span>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${live ? "bg-green-100 text-green-700" : soon ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-700"}`}>{r.status}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-zinc-900">{r.title}</h3>
                <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed">{r.note}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={0.1}><p className="mt-8 text-xs text-zinc-500">{text(section.requestText, cfg)}{" "}<a href="#contact" className="font-medium text-zinc-700 underline underline-offset-2">{section.requestLinkLabel}</a></p></Reveal>
    </div>
  </section>
  );
};

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

const PriceToggle = ({ checked, onChange, label, hint, testId }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    data-testid={testId}
    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${checked ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
  >
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-zinc-900">{label}</span>
      <span className="block text-xs text-zinc-500">{hint}</span>
    </span>
    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-amber-500" : "bg-zinc-300"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
    </span>
  </button>
);

const Pricing = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const section = cfg.pricing;
  const [addInvoices, setAddInvoices] = useState(false);
  const personalPrice =
    PRICING.personalBase +
    (addInvoices ? PRICING.invoicesAddon : 0);

  return (
    <section id="pricing" className="scroll-anchor bg-[var(--vx-light)] border-t border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Reveal>
          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">{section.title}</h2>
            <p className="mt-4 text-zinc-600 max-w-2xl mx-auto">{text(section.body, cfg, trialDays)}</p>
          </div>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((basePlan, i) => {
            const copy = section.plans.find((plan) => plan.id === basePlan.id) || {};
            const p = { ...basePlan, ...copy, icon: typeof copy.icon === "string" ? icon(copy.icon) : basePlan.icon };
            const price = p.personal ? personalPrice : p.monthly;
            return (
              <Reveal key={p.id} delay={(i % 3) * 0.06} className="h-full">
                <div
                  data-testid={`pricing-card-${p.id}`}
                  className={`relative flex h-full flex-col rounded-[20px] p-7 bg-white ${p.highlight ? "border-2 border-[var(--vx-accent)] shadow-[0_18px_50px_-18px_rgba(245,158,11,0.45)]" : "border border-zinc-200 shadow-sm"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-[var(--vx-accent-soft)] shrink-0"><p.icon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-extrabold tracking-tight text-zinc-900 leading-tight">{p.name}</h3>
                      {p.badge && <span className={`mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.highlight ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{p.badge}</span>}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{p.tagline}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="font-display text-5xl font-extrabold tracking-tight text-zinc-900" data-testid={`pricing-amount-${p.id}`}>{money(price)}</span>
                    <span className="mb-1.5 text-zinc-500">{p.monthlyLabel}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{section.billingNote}</div>

                  {p.personal ? (
                    <div className="mt-5 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{section.personalCustomTitle}</div>
                      <PriceToggle
                        checked={addInvoices}
                        onChange={setAddInvoices}
                        label={section.personalToggleLabel}
                        hint={`+${money(PRICING.invoicesAddon)}/mo`}
                        testId="personal-invoices-toggle"
                      />
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600">
                        <Bot className="mr-1.5 inline-block h-3.5 w-3.5 align-[-0.15em]" />
                        {section.personalAiNote}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                      <Bot className="h-3.5 w-3.5" /> {p.aiNote}
                    </div>
                  )}

                  <a
                    href={URLS.signup}
                    data-testid={`pricing-cta-${p.id}`}
                    className={`${btnBase} mt-6 w-full h-12 ${p.highlight ? "bg-amber-500 text-zinc-950 hover:bg-amber-400" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                  >
                    {p.cta}<ArrowRight className="ml-2 h-4 w-4" />
                  </a>

                  {p.intro && <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-400">{p.intro}</div>}
                  <ul className="mt-3 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></span><span className="text-sm text-zinc-700">{f}</span></li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {cfg.hero.trustBadges.map((b) => {
                const Badge = icon(b.icon);
                return <span key={b.label} className="inline-flex items-center gap-1.5 text-sm text-zinc-600"><Badge className="h-4 w-4 text-[var(--vx-accent)]" /> {b.label}</span>;
              })}
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-md">{text(section.trialNote, cfg, trialDays)}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const Comparison = () => {
  const cfg = useLandingConfig();
  const section = cfg.comparison;
  return (
  <section className="bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <Reveal><h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 text-center">{text(section.title, cfg)}</h2></Reveal>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Reveal>
          <div className="rounded-[18px] border border-zinc-200 bg-[var(--vx-light)] p-7">
            <div className="font-display text-lg font-bold text-zinc-500">{section.oldWayTitle}</div>
            <ul className="mt-5 space-y-3.5">{section.oldWay.map((o) => (<li key={o} className="flex items-start gap-3 text-zinc-500"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 shrink-0"><X className="h-3.5 w-3.5" /></span><span className="text-sm">{o}</span></li>))}</ul>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-[18px] border-2 border-amber-400 bg-white p-7 shadow-[0_10px_40px_-16px_rgba(245,158,11,0.5)]">
            <div className="font-display text-lg font-bold text-zinc-900">{text(section.vultrixTitle, cfg)}</div>
            <ul className="mt-5 space-y-3.5">{section.vultrix.map((v) => (<li key={v} className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></span><span className="text-sm text-zinc-800 font-medium">{v}</span></li>))}</ul>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
  );
};

const Faq = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const section = cfg.faq;
  const [openIdx, setOpenIdx] = useState(0);
  const faqs = section.items.map((f) => ({ ...f, a: text(f.a, cfg, trialDays) }));
  return (
  <section id="faq" className="scroll-anchor bg-[var(--vx-light)] border-t border-zinc-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Reveal>
          <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">{section.title}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            {faqs.map((f, i) => (
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

const ContactForm = ({ copy }) => {
  const [form, setForm] = useState({ name: "", shop: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) { setError(copy.validationError); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, source: "contact" }) });
      if (!res.ok) throw new Error();
      setDone(true);
      setForm({ name: "", shop: "", email: "", phone: "", message: "" });
    } catch { setError(copy.failureError); }
    finally { setBusy(false); }
  };
  const inputCls = "mt-1.5 w-full h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400";
  if (done) {
    return (
      <div className="rounded-[14px] bg-white border border-zinc-200 shadow-sm p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center"><CheckCircle2 className="h-7 w-7 text-green-600" /></div>
        <h3 className="mt-4 font-display text-xl font-bold text-zinc-900">{copy.successTitle}</h3>
        <p className="mt-2 text-sm text-zinc-600">{copy.successBody}</p>
        <button onClick={() => setDone(false)} className={`${btnBase} mt-5 h-10 px-4 border border-zinc-300 text-zinc-800 hover:bg-zinc-50`}>{copy.anotherLabel}</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="rounded-[14px] bg-white border border-zinc-200 shadow-sm p-6 sm:p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm text-zinc-700">{copy.nameLabel}</label><input value={form.name} onChange={upd("name")} placeholder={copy.namePlaceholder} className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">{copy.shopLabel}</label><input value={form.shop} onChange={upd("shop")} placeholder={copy.shopPlaceholder} className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">{copy.emailLabel}</label><input type="email" value={form.email} onChange={upd("email")} placeholder={copy.emailPlaceholder} className={inputCls} /></div>
        <div><label className="text-sm text-zinc-700">{copy.phoneLabel} <span className="text-zinc-400">{copy.phoneOptionalLabel}</span></label><input value={form.phone} onChange={upd("phone")} placeholder={copy.phonePlaceholder} className={inputCls} /></div>
      </div>
      <div className="mt-4"><label className="text-sm text-zinc-700">{copy.messageLabel}</label><textarea value={form.message} onChange={upd("message")} placeholder={copy.messagePlaceholder} className="mt-1.5 w-full min-h-[120px] rounded-lg border border-zinc-300 p-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={`${btnBase} mt-5 w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 text-base`}>{busy ? copy.sendingLabel : (<>{copy.submitLabel} <Send className="ml-2 h-4 w-4" /></>)}</button>
      <p className="mt-3 text-xs text-zinc-500 text-center">{copy.privacyNote}</p>
    </form>
  );
};

const Contact = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const section = cfg.contact;
  return (
  <section id="contact" className="scroll-anchor bg-white border-t border-zinc-200">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <Reveal className="lg:col-span-5">
          <div className="text-sm font-semibold text-[var(--vx-accent)] uppercase tracking-wide">{section.kicker}</div>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">{section.title}</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">{text(section.body, cfg)}</p>
          <ul className="mt-6 space-y-4">
            <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Phone className="h-5 w-5" /></span><a href={`tel:${cfg.site.phoneHref}`} className="hover:text-zinc-900 font-medium">{cfg.site.phone}</a></li>
            {cfg.site.supportEmail ? (
              <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Mail className="h-5 w-5" /></span><a href={`mailto:${cfg.site.supportEmail}`} className="hover:text-zinc-900">{cfg.site.supportEmail}</a></li>
            ) : (
              <li className="flex items-start gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 shrink-0"><Mail className="h-5 w-5" /></span><span>{section.fallbackEmailNote}</span></li>
            )}
            <li className="flex items-center gap-3 text-zinc-700"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100"><Clock className="h-5 w-5" /></span>{section.replyNote}</li>
          </ul>
          <div className="mt-8 rounded-[14px] bg-[var(--vx-light)] border border-zinc-200 p-5">
            <div className="text-sm font-semibold text-zinc-900">{section.quickCtaTitle}</div>
            <p className="mt-1 text-sm text-zinc-600">{text(section.quickCtaBody, cfg, trialDays)}</p>
            <a href={URLS.signup} className={`${btnBase} mt-3 h-11 px-4 bg-zinc-900 text-white hover:bg-zinc-800`}>{section.quickCtaLabel} <ArrowRight className="ml-2 h-4 w-4" /></a>
          </div>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={0.1}><ContactForm copy={section.form} /></Reveal>
      </div>
    </div>
  </section>
  );
};

const FinalCta = ({ trialDays }) => {
  const cfg = useLandingConfig();
  const section = cfg.finalCta;
  return (
  <section className="bg-[var(--vx-dark)] text-white relative overflow-hidden">
    <div className="absolute inset-0 vx-hero-glow" aria-hidden="true" />
    {cfg.theme.pattern === "dots" && <div className="absolute inset-0 vx-dots opacity-50" aria-hidden="true" />}
    {cfg.theme.pattern === "grid" && <div className="absolute inset-0 vx-grid opacity-50" aria-hidden="true" />}
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <Reveal>
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">{section.title}</h2>
        <p className="mt-4 text-lg text-zinc-300 max-w-xl mx-auto">{text(section.body, cfg, trialDays)}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a href={URLS.signup} className={`${btnBase} h-12 px-7 bg-[var(--vx-accent)] text-[var(--vx-accent-fg)] hover:bg-[color-mix(in_srgb,var(--vx-accent)_85%,black)] text-base`}>{section.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" /></a>
        </div>
      </Reveal>
    </div>
  </section>
  );
};

const Footer = () => {
  const cfg = useLandingConfig();
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--vx-dark)] text-zinc-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2"><VultrixMark variant="dark" className="h-9 w-9" /><span className="font-display text-xl font-extrabold tracking-tight text-white">{cfg.site.brand}</span></div>
            <p className="mt-4 text-sm text-zinc-400 max-w-sm leading-relaxed">{text(cfg.footer.blurb, cfg)}</p>
          </div>
          <div className="md:col-span-3">
            <div className="text-sm font-semibold text-white">{cfg.footer.productTitle}</div>
            <ul className="mt-4 space-y-3 text-sm">{cfg.nav.map((l) => (<li key={l.href}><a href={l.href} className="text-zinc-400 hover:text-white transition-colors">{l.label}</a></li>))}</ul>
          </div>
          <div className="md:col-span-4">
            <div className="text-sm font-semibold text-white">{cfg.footer.getStartedTitle}</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a href={URLS.signup} className="text-zinc-400 hover:text-white transition-colors">{cfg.footer.startTrialLabel}</a></li>
              <li><a href={URLS.login} className="text-zinc-400 hover:text-white transition-colors">{cfg.footer.loginLabel}</a></li>
              <li><a href="#contact" className="text-zinc-400 hover:text-white transition-colors">{cfg.footer.contactLabel}</a></li>
              <li><a href={`tel:${cfg.site.phoneHref}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"><Phone className="h-4 w-4" /> {cfg.site.phone}</a></li>
              {cfg.site.supportEmail && (<li><a href={`mailto:${cfg.site.supportEmail}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"><Mail className="h-4 w-4" /> {cfg.site.supportEmail}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">© {year} {cfg.site.owner}. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <a href={URLS.terms} className="text-zinc-400 hover:text-white">{cfg.footer.termsLabel}</a>
            <a href={URLS.privacy} className="text-zinc-400 hover:text-white">{cfg.footer.privacyLabel}</a>
            <a href={URLS.status} className="text-zinc-400 hover:text-white">{cfg.footer.statusLabel}</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const CustomSectionView = ({ section }) => {
  const dark = section.dark;
  const itemIcon = (item) => {
    const ItemIcon = icon(item.icon);
    return <ItemIcon className="h-5 w-5" />;
  };
  return (
    <section className={`${dark ? "bg-[var(--vx-dark)] text-white" : "bg-[var(--vx-light)]"} border-t border-zinc-200`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          {section.kicker && <div className={`text-sm font-semibold uppercase tracking-wide ${dark ? "text-[var(--vx-accent-soft)]" : "text-[var(--vx-accent)]"}`}>{section.kicker}</div>}
          <h2 className={`mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight ${dark ? "text-white" : "text-zinc-900"}`}>{section.title}</h2>
          {section.body && <p className={`mt-4 max-w-2xl leading-relaxed ${dark ? "text-zinc-300" : "text-zinc-600"}`}>{section.body}</p>}
        </Reveal>
        {section.kind !== "faq" && section.items?.length ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {section.items.map((item, index) => (
              <Reveal key={`${item.title}-${index}`} delay={(index % 3) * 0.06}>
                <div className={`h-full rounded-[14px] border p-6 ${dark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
                  {item.icon && <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${dark ? "bg-[var(--vx-accent)] text-[var(--vx-accent-fg)]" : "bg-zinc-900 text-[var(--vx-accent-soft)]"}`}>{itemIcon(item)}</span>}
                  <h3 className={`mt-4 font-display text-lg font-bold ${dark ? "text-white" : "text-zinc-900"}`}>{item.title}</h3>
                  <p className={`mt-1.5 text-sm leading-relaxed ${dark ? "text-zinc-300" : "text-zinc-600"}`}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        ) : null}
        {section.kind === "faq" && section.items?.length ? (
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            {section.items.map((item, index) => <details key={`${item.title}-${index}`} className="py-4"><summary className="cursor-pointer font-semibold">{item.title}</summary><p className="mt-2 text-sm leading-relaxed">{item.desc}</p></details>)}
          </div>
        ) : null}
        {section.kind === "cta" && section.ctaLabel && (
          <a href={section.ctaHref || URLS.signup} className={`${btnBase} mt-7 h-12 px-6 bg-[var(--vx-accent)] text-[var(--vx-accent-fg)] hover:bg-[color-mix(in_srgb,var(--vx-accent)_85%,black)]`}>{section.ctaLabel}<ArrowRight className="ml-2 h-4 w-4" /></a>
        )}
      </div>
    </section>
  );
};

/* ----------------------------------------------------------------------------
   PAGE
---------------------------------------------------------------------------- */
export default function VultrixLanding({ trialDays = SITE.trialDays, config = DEFAULT_LANDING_CONFIG }) {
  const cfg = config || DEFAULT_LANDING_CONFIG;
  const accentVars = accentVarsFromHex(cfg.theme.accent);
  const style = {
    "--vx-accent": cfg.theme.accent,
    "--vx-accent-soft": cfg.theme.accentSoft,
    "--vx-dark": cfg.theme.dark,
    "--vx-light": cfg.theme.light,
    ...accentVars,
  };
  const sections = {
    hero: <Hero trialDays={trialDays} />,
    credibility: <CredibilityStrip />,
    whatIs: <WhatIs />,
    audiences: <Audiences />,
    founder: <FounderStory />,
    features: <Features />,
    deepDives: <DeepDives />,
    stats: <Stats trialDays={trialDays} />,
    import: <ImportSection />,
    shopRecommendation: <ShopRecommendation />,
    roadmap: <Roadmap />,
    pricing: <Pricing trialDays={trialDays} />,
    comparison: <Comparison />,
    faq: <Faq trialDays={trialDays} />,
    contact: <Contact trialDays={trialDays} />,
    finalCta: <FinalCta trialDays={trialDays} />,
  };
  const customSections = Object.fromEntries(cfg.customSections.map((section) => [section.id, <CustomSectionView key={section.id} section={section} />]));
  return (
    <LandingConfigContext.Provider value={cfg}>
      <div className="min-h-screen bg-[var(--vx-light)] overflow-x-hidden" style={style}>
        <Navbar />
        <main>
          {cfg.order.map((entry) => entry.enabled ? (
            <div key={entry.id}>{sections[entry.id] || customSections[entry.id] || null}</div>
          ) : null)}
        </main>
        <Footer />
        <VultrixAssistant
        brand={cfg.site.brand}
        pricing={PRICING}
        trialDays={trialDays}
        phone={cfg.site.phone}
        phoneHref={cfg.site.phoneHref}
        shopName={cfg.site.shopName}
        shopUrl={cfg.site.shopUrl}
        signupUrl={URLS.signup}
        />
      </div>
    </LandingConfigContext.Provider>
  );
}
