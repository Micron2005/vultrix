import { SUPPORT_EMAIL } from "./branding";

export type LandingIcon =
  | "Wrench"
  | "FileText"
  | "Car"
  | "Search"
  | "Boxes"
  | "Package"
  | "QrCode"
  | "Bell"
  | "Calendar"
  | "UserCog"
  | "Building2"
  | "Receipt"
  | "BarChart3"
  | "Upload"
  | "ClipboardList"
  | "Users"
  | "ShieldCheck"
  | "Smartphone"
  | "Download"
  | "HardHat"
  | "Bot"
  | "Globe"
  | "Store"
  | "MessageSquare"
  | "CreditCard"
  | "Clock"
  | "BadgeCheck"
  | "CheckCircle2"
  | "LayoutDashboard"
  | "ScanLine"
  | "Home"
  | "Star"
  | "Heart"
  | "Zap"
  | "Target"
  | "RefreshCw"
  | "Sparkles";

export const LANDING_ICONS: LandingIcon[] = [
  "Wrench", "FileText", "Car", "Search", "Boxes", "Package", "QrCode",
  "Bell", "Calendar", "UserCog", "Building2", "Receipt", "BarChart3",
  "Upload", "ClipboardList", "Users", "ShieldCheck", "Smartphone", "Download",
  "HardHat", "Bot", "Globe", "Store", "MessageSquare", "CreditCard", "Clock",
  "BadgeCheck", "CheckCircle2", "LayoutDashboard", "ScanLine", "Home", "Star",
  "Heart", "Zap", "Target", "RefreshCw", "Sparkles",
];

export type LandingTheme = {
  accent: string;
  accentSoft: string;
  dark: string;
  light: string;
  pattern: "dots" | "grid" | "none";
};

export type LandingSectionId =
  | "hero"
  | "credibility"
  | "whatIs"
  | "audiences"
  | "founder"
  | "features"
  | "deepDives"
  | "stats"
  | "import"
  | "shopRecommendation"
  | "roadmap"
  | "pricing"
  | "comparison"
  | "faq"
  | "contact"
  | "finalCta";

export type LandingListItem = {
  icon?: LandingIcon;
  title: string;
  desc: string;
};

export type CustomSection = {
  id: string;
  kind: "text" | "cards" | "cta" | "faq";
  kicker?: string;
  title: string;
  body?: string;
  items?: { icon?: LandingIcon; title: string; desc: string }[];
  ctaLabel?: string;
  ctaHref?: string;
  dark?: boolean;
};

export type LandingConfig = {
  version: 1;
  theme: LandingTheme;
  order: { id: string; enabled: boolean }[];
  customSections: CustomSection[];
  site: {
    brand: string;
    tagline: string;
    owner: string;
    phone: string;
    phoneHref: string;
    supportEmail: string;
    shopName: string;
    shopUrl: string;
    loginLabel: string;
    signupLabel: string;
  };
  nav: { label: string; href: string }[];
  hero: {
    badge: string;
    headline: string;
    headlineAccent: string;
    body: string;
    ctaLabel: string;
    trustBadges: { icon: LandingIcon; label: string }[];
    showFromPrice: boolean;
  };
  credibility: { icon: LandingIcon; label: string }[];
  whatIs: {
    kicker: string;
    title: string;
    p1: string;
    p2: string;
    boxTitle: string;
    items: string[];
  };
  audiences: {
    kicker: string;
    title: string;
    body: string;
    ctaLabel: string;
    cards: {
      icon: LandingIcon;
      kicker: string;
      title: string;
      desc: string;
      points: string[];
    }[];
  };
  founder: { kicker: string; title: string; paragraphs: string[] };
  features: {
    kicker: string;
    title: string;
    body: string;
    generalTitle: string;
    generalBody: string;
    autoTitle: string;
    autoBody: string;
    general: { icon: LandingIcon; title: string; desc: string; tag?: string }[];
    auto: { icon: LandingIcon; title: string; desc: string }[];
  };
  deepDives: {
    id: string;
    eyebrow: string;
    title: string;
    points: string[];
    mock: string;
  }[];
  stats: { items: { label: string; value: number; prefix?: string; suffix?: string }[] };
  importSection: { kicker: string; title: string; body: string; points: LandingListItem[] };
  shopRecommendation: { kicker: string; title: string; body: string; ctaLabel: string; fallbackCtaLabel: string };
  roadmap: { kicker: string; title: string; body: string; items: { icon: LandingIcon; status: string; title: string; note: string }[]; requestText: string; requestLinkLabel: string };
  pricing: {
    kicker: string;
    title: string;
    body: string;
    plans: {
      id: "auto" | "business" | "personal";
      icon: LandingIcon;
      name: string;
      badge: string;
      tagline: string;
      cta: string;
    aiNote?: string;
    intro: string;
      features: string[];
      monthlyLabel: string;
    }[];
    billingNote: string;
    personalCustomTitle: string;
    personalToggleLabel: string;
    personalAiNote: string;
    trialNote: string;
  };
  comparison: { title: string; oldWayTitle: string; vultrixTitle: string; oldWay: string[]; vultrix: string[] };
  faq: { kicker: string; title: string; items: { q: string; a: string }[] };
  contact: {
    kicker: string;
    title: string;
    body: string;
    replyNote: string;
    fallbackEmailNote: string;
    quickCtaTitle: string;
    quickCtaBody: string;
    quickCtaLabel: string;
    form: {
      nameLabel: string;
      namePlaceholder: string;
      shopLabel: string;
      shopPlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      phoneLabel: string;
      phoneOptionalLabel: string;
      phonePlaceholder: string;
      messageLabel: string;
      messagePlaceholder: string;
      submitLabel: string;
      sendingLabel: string;
      privacyNote: string;
      successTitle: string;
      successBody: string;
      anotherLabel: string;
      validationError: string;
      failureError: string;
    };
  };
  finalCta: { title: string; body: string; ctaLabel: string };
  footer: {
    blurb: string;
    productTitle: string;
    getStartedTitle: string;
    startTrialLabel: string;
    loginLabel: string;
    contactLabel: string;
    termsLabel: string;
    privacyLabel: string;
    statusLabel: string;
  };
};

const builtInOrder: LandingSectionId[] = [
  "hero", "credibility", "whatIs", "audiences", "founder", "features",
  "deepDives", "stats", "import", "shopRecommendation", "roadmap", "pricing",
  "comparison", "faq", "contact", "finalCta",
];

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  version: 1,
  theme: {
    accent: "#7c3aed",
    accentSoft: "#a78bfa",
    dark: "#09090b",
    light: "#fafafa",
    pattern: "dots",
  },
  order: builtInOrder.map((id) => ({ id, enabled: true })),
  customSections: [],
  site: {
    brand: "Vultrix",
    tagline: "One system to run your business — and your life.",
    owner: "M.S.A.M Enterprise",
    phone: "571-320-9425",
    phoneHref: "+15713209425",
    supportEmail: SUPPORT_EMAIL,
    shopName: "QNA / Noor Auto Repair",
    shopUrl: "https://qna-noorautorepair.com",
    loginLabel: "Log in",
    signupLabel: "Sign up",
  },
  nav: [
    { label: "Who it's for", href: "#who" },
    { label: "Features", href: "#features" },
    { label: "Roadmap", href: "#roadmap" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  hero: {
    badge: "Built by a working mechanic — now for everyone",
    headline: "Everything you run, from",
    headlineAccent: "one screen.",
    body: "Vultrix began as software for auto repair shops and grew into an all-in-one system for any small business — or your personal life. Jobs, invoices, inventory, scheduling, expenses, reminders, and a built-in AI assistant, minus the clunky, overpriced tools.",
    ctaLabel: "Start your {trialDays}-day free trial",
    trustBadges: [
      { icon: "Clock", label: "Set up in a day" },
      { icon: "BadgeCheck", label: "No contract" },
      { icon: "ShieldCheck", label: "Cancel anytime" },
    ],
    showFromPrice: true,
  },
  credibility: [
    { icon: "HardHat", label: "Built by a working mechanic" },
    { icon: "ShieldCheck", label: "Secure billing by Stripe" },
    { icon: "Smartphone", label: "Works on any device" },
    { icon: "Download", label: "Export your data anytime" },
  ],
  whatIs: {
    kicker: "What is {brand}?",
    title: "The all-in-one system, shaped to how you work",
    p1: "{brand} began in a busy auto repair shop and grew into a flexible platform for any small business — or your personal life. Write up jobs and invoices, track inventory and expenses, plan your week, and keep customers (or yourself) on track — without bouncing between five different tools or paying enterprise prices.",
    p2: "It runs in any browser, on the shop computer, your phone, or a tablet in the bay. You choose your setup at sign-up and only see the tools you need. Your data is always yours, and you can export it anytime.",
    boxTitle: "What you get out of the box",
    items: [
      "Send estimates fast and get approvals without phone tag",
      "Track parts, labor, tech hours, and money owed in one place",
      "Know exactly what fits a vehicle before you order",
      "Keep customers coming back with automatic service reminders",
    ],
  },
  audiences: {
    kicker: "Who it's for",
    title: "Built for the bay — flexible enough for anyone.",
    body: "Pick your setup when you sign up and {brand} shapes itself to match — you only ever see the tools that fit how you work.",
    ctaLabel: "Choose your setup",
    cards: [
      {
        icon: "Wrench",
        kicker: "Auto repair shops",
        title: "The shop, fully handled",
        desc: "The flagship toolkit Vultrix was born in — the complete workflow for a busy bay.",
        points: ["Estimates → approved → in progress → paid", "VIN decode, parts that fit & inventory", "Technicians, reminders & scheduling"],
      },
      {
        icon: "Store",
        kicker: "Small businesses",
        title: "Any business, your way",
        desc: "Switch off the auto-specific parts and keep exactly what your business needs.",
        points: ["Professional invoices & online payments", "Inventory & expense tracking", "Clear financial reports"],
      },
      {
        icon: "Home",
        kicker: "Personal use",
        title: "Life, organized",
        desc: "Track your money, plan your week, and capture ideas — with an AI assistant that does it for you.",
        points: ["Income & expense tracking", "Calendar, reminders & notes", "Built-in voice & chat AI assistant"],
      },
    ],
  },
  founder: {
    kicker: "Why I built it",
    title: "I got tired of clunky, overpriced tools. So I built a better one.",
    paragraphs: [
      "I work on cars. The software I was stuck with was slow, confusing, and cost a small fortune every month — and it still couldn't do half of what a busy shop actually needs.",
      "So I built {brand}: the system I wish I'd had on day one. Everything a shop touches in a day — estimates, parts, inventory, customers, reminders, and the money — in one fast, clean place. No fluff, no lock-in, no enterprise price tag.",
      "It started in my own shop. But scattered tools, ugly screens, and monthly fees for half the features hit every small business — and honestly, everyday life too. So {brand} now flexes to fit auto shops, other businesses, and personal use. Same clean system, shaped to whatever you're running.",
    ],
  },
  features: {
    kicker: "Everything in one place",
    title: "Powerful tools, tailored to how you work.",
    body: "Pick your setup at sign-up and {brand} shows only what fits. Here's what comes with every account — plus the extra toolkit built just for auto repair shops.",
    generalTitle: "In every account",
    generalBody: "Auto shop, business, or personal. Invoicing & customers are built in for shops and businesses — and an add-on for personal accounts.",
    autoTitle: "Auto repair shops only",
    autoBody: "The shop-floor toolkit — exclusive to auto repair accounts.",
    general: [
      { icon: "FileText", title: "Invoices & estimates", desc: "Clean, professional PDFs and shareable links your customers can approve and pay from their phone.", tag: "Optional on Personal" },
      { icon: "CreditCard", title: "Online payments", desc: "Get paid faster — customers pay from a phone or a shared link, securely through Stripe.", tag: "Optional on Personal" },
      { icon: "Users", title: "Customers & contacts", desc: "A searchable record of everyone you do business with, with full job and invoice history.", tag: "Optional on Personal" },
      { icon: "Package", title: "Inventory", desc: "Track cost, price, and on-hand stock with QR shelf labels and low-stock alerts. Optional." },
      { icon: "Receipt", title: "Income & expenses", desc: "Log money in and money out by category so your numbers always stay straight." },
      { icon: "BarChart3", title: "Reports", desc: "See revenue, what's owed, and where the money's going — all at a glance." },
      { icon: "Calendar", title: "Scheduling & calendar", desc: "Plan your day and week and set reminders so nothing important slips through." },
      { icon: "ClipboardList", title: "Notes & knowledge", desc: "Capture notes, checklists, and reference info you can search back through later." },
      { icon: "Upload", title: "Import & export", desc: "Bring your data in by CSV and take it with you anytime. No lock-in, ever." },
      { icon: "UserCog", title: "Multi-user roles", desc: "Add your whole team with roles for owners, managers, and staff." },
    ],
    auto: [
      { icon: "Wrench", title: "Repair & work orders", desc: "Full lifecycle from estimate to paid, with labor and parts lines and technician assignment." },
      { icon: "ScanLine", title: "On-the-go ticket intake", desc: "Techs scan a QR to start a ticket from their phone — no login. It lands in the office queue to price, order parts, and invoice." },
      { icon: "Car", title: "Vehicles & history", desc: "Every vehicle gets a searchable history of past jobs, parts, and invoices." },
      { icon: "Search", title: "VIN decode & plate search", desc: "Decode any VIN in seconds with open recalls included, or pull up a saved vehicle by its plate." },
      { icon: "Boxes", title: "Parts that fit", desc: "See parts tagged to the exact vehicle and jump straight to your suppliers in one click." },
      { icon: "Bell", title: "Service reminders", desc: "Find customers who've gone quiet and win them back with one tap to text or email." },
      { icon: "HardHat", title: "Technicians & hours", desc: "Assign work and track logged hours for every technician." },
      { icon: "BadgeCheck", title: "Canned jobs & presets", desc: "Save your common jobs and drop them onto a repair order in seconds." },
    ],
  },
  deepDives: [
    { id: "deep-dive-repair-orders", eyebrow: "Repair orders", title: "From estimate to paid — without the paperwork pile", points: ["Walk a job through estimate → approved → in progress → done → paid", "Add labor and parts lines and assign the right technician", "Send a clean PDF or a link the customer approves from their phone"], mock: "workorder" },
    { id: "deep-dive-intake", eyebrow: "Field intake", title: "Start the ticket from the bay or the road — not the office", points: ["Techs scan a QR and create a ticket from their phone — no login, no walk to the office", "Capture the customer, vehicle, mileage, and what's wrong while it's fresh", "It drops into the office's queue to price, order parts, and invoice"], mock: "intake" },
    { id: "deep-dive-vin-parts", eyebrow: "Lookup", title: "Decode the VIN, see what fits, order in one click", points: ["Decode any VIN in seconds and surface open recalls", "See parts tagged to that exact vehicle, plus universal parts", "A companion browser helper fills the VIN into your supplier's site"], mock: "lookup" },
    { id: "deep-dive-inventory", eyebrow: "Inventory", title: "Stock you can actually trust", points: ["Track cost, price, on-hand counts and reorder thresholds", "Stock auto-deducts the moment a part hits a repair order", "Print QR shelf labels and scan to find a part instantly"], mock: "inventory" },
    { id: "deep-dive-reminders", eyebrow: "Retention", title: "Keep the bays full with win-back reminders", points: ["Automatically surface customers who haven't been in for months", "One tap to text or email an invite back for service", "Bring in repeat work without blasting discounts"], mock: "reminder" },
  ],
  stats: {
    items: [
      { value: 60, suffix: "", label: "Days free to try" },
      { value: 15, prefix: "$", suffix: "", label: "To start, per month" },
      { value: 18, suffix: "+", label: "Tools in one place" },
      { value: 100, suffix: "%", label: "Of your data, exportable" },
    ],
  },
  importSection: {
    kicker: "Make the switch",
    title: "Switch in minutes. Your data stays yours.",
    body: "",
    points: [
      { icon: "Upload", title: "Import by CSV", desc: "Bring your customers, vehicles, and history straight in." },
      { icon: "RefreshCw", title: "Pick up where you left off", desc: "Your jobs, parts, and numbers organized from day one." },
      { icon: "ShieldCheck", title: "Your data stays yours", desc: "Export anytime. No lock-in, no holding your shop hostage." },
    ],
  },
  shopRecommendation: {
    kicker: "Proven in a real, working shop",
    title: "{brand} runs the floor at {shopName}",
    body: "Every feature here is battle-tested in a busy shop, day in and day out. Want to see the shop behind the software?",
    ctaLabel: "Visit {shopName}",
    fallbackCtaLabel: "Shop site coming soon",
  },
  roadmap: {
    kicker: "The road ahead",
    title: "What's coming to {brand}",
    body: "{brand} keeps getting better. Here's what's on the roadmap — these are planned features in active thinking, not promises on specific dates.",
    items: [
      { icon: "Bot", status: "Live for Personal", title: "AI assistant for every account", note: "The built-in AI assistant is live on Personal accounts today — connect your own OpenAI or Anthropic key at no extra cost. Rolling out to business and shop accounts next." },
      { icon: "Globe", status: "Planned", title: "Expanded worldwide vehicle data", note: "Broader vehicle coverage and deeper repair information beyond today's lookup sources." },
      { icon: "Store", status: "Planned", title: "Customer-facing websites", note: "Give every account a clean public website tied right to their Vultrix data." },
      { icon: "Boxes", status: "Planned", title: "More supplier integrations", note: "Broader parts catalogs and live availability from more suppliers." },
      { icon: "MessageSquare", status: "Planned", title: "Two-way customer texting", note: "Message customers and collect approvals right inside Vultrix." },
    ],
    requestText: "Roadmap items are subject to change. Have a request?",
    requestLinkLabel: "Tell us what you'd build.",
  },
  pricing: {
    kicker: "Simple, honest pricing",
    title: "One price for how you work.",
    body: "Pick the setup that matches your account type — you only pay for what fits. Every plan includes a {trialDays}-day free trial, month-to-month billing, and your data exportable anytime.",
    plans: [
      { id: "auto", icon: "Wrench", name: "Auto Repair Shop", badge: "Full shop toolkit", tagline: "The complete workflow Vultrix was born in — everything a busy bay runs on.", cta: "Start free trial", aiNote: "AI assistant coming soon", intro: "Everything in Business, plus:", monthlyLabel: "/mo", features: ["Repair orders — estimate → approved → paid", "VIN decode, plate search & open recalls", "Parts that fit + QR inventory labels", "Technicians, logged hours & scheduling", "On-the-go QR ticket intake (no login)", "Service reminders to win customers back"] },
      { id: "business", icon: "Store", name: "Business", badge: "Most popular", tagline: "Run any small business your way — turn off the auto-specific parts and keep what fits.", cta: "Start free trial", aiNote: "AI assistant coming soon", intro: "Everything you need to run day to day:", monthlyLabel: "/mo", features: ["Professional invoices & online payments", "Customers & optional inventory", "Income, expenses & clear reports", "Scheduling & calendar", "Notes & searchable knowledge base", "CSV import / export — your data stays yours"] },
      { id: "personal", icon: "Home", name: "Personal", badge: "Life, organized", tagline: "Track your money, plan your week, and capture ideas — with an AI assistant that does it for you.", cta: "Start free trial", intro: "Built for everyday life:", monthlyLabel: "/mo", features: ["Income & expense tracking", "Calendar, reminders & to-dos", "Notes & knowledge base", "CSV import / export"] },
    ],
    billingNote: "Billed monthly · cancel anytime",
    personalCustomTitle: "Make it yours",
    personalToggleLabel: "Add invoices & customers",
    personalAiNote: "The AI assistant is included on Personal when you connect your own OpenAI or Anthropic key — no add-on fee.",
    trialNote: "{trialDays}-day free trial. You won't be charged until your trial ends. Billing is securely handled by Stripe.",
  },
  comparison: {
    title: "{brand} vs. the old way",
    oldWayTitle: "The old way",
    vultrixTitle: "With {brand}",
    oldWay: ["Juggling several subscriptions and logins", "Paying $150–$400+ every month", "Clunky, dated screens that fight you", "Your data locked in — hard to leave", "Phone tag to get an estimate approved", "A steep learning curve for the team"],
    vultrix: ["Everything in one place", "Plans from $15/month", "A fast, clean, modern interface", "Export your data whenever you want", "Customers approve and pay from their phone", "Up and running the same day"],
  },
  faq: {
    kicker: "Questions",
    title: "Frequently asked",
    items: [
      { q: "Is there a contract?", a: "No. Vultrix is month-to-month and you can cancel anytime from your billing portal — no calls, no hoops." },
      { q: "How does the free trial work?", a: "You get {trialDays} days free. You won't be charged until the trial ends, and you can cancel before then at no cost." },
      { q: "What does it cost?", a: "It depends on your account: an Auto Repair Shop is $35/month, a Business is $25/month, and a Personal account is $15/month. Personal accounts can add invoices & customers for $10/month. The Vultrix AI assistant is included on Personal when you connect your own OpenAI/Anthropic key at no extra cost." },
      { q: "Which account type should I pick?", a: "Pick Auto Repair Shop for the full shop workflow (repair orders, VIN/parts lookup, technicians). Pick Business to run any other small business with invoices, inventory, and reports. Pick Personal to organize your own money, calendar, and notes." },
      { q: "How does the AI assistant work?", a: "It's a built-in voice & chat assistant that can add calendar events, take notes, and answer questions. It's included on Personal accounts when you connect your own OpenAI/Anthropic key at no extra cost. Support for business and shop accounts is coming next." },
      { q: "Can I export my data?", a: "Yes. You can import and export by CSV whenever you like. Your data is yours — there's no lock-in." },
      { q: "Does it work on a phone or tablet?", a: "Yes. Vultrix runs in any modern browser, so it works on a computer, your phone, or a tablet in the bay." },
      { q: "Can my whole team use it?", a: "Absolutely. Add multiple users with roles for owners, managers, and staff." },
      { q: "Is my payment secure?", a: "Billing is handled by Stripe, an industry-leading payment processor. We never see or store your card details." },
      { q: "Can my customers pay online?", a: "Yes. On accounts with invoicing, customers can pay right from their phone or a shared link — no extra setup on your end." },
      { q: "Do you offer discounts?", a: "From time to time, yes. When we're running a promotion you'll get a code to enter at checkout, and the discount applies automatically." },
    ],
  },
  contact: {
    kicker: "Get in touch",
    title: "Talk to a real person",
    body: "Questions about {brand}, want a walkthrough, or thinking about switching your shop over? Send a note or give us a call.",
    replyNote: "We usually reply within one business day",
    fallbackEmailNote: "Reach us through the form — we'll reply by email.",
    quickCtaTitle: "Ready to jump in?",
    quickCtaBody: "Start your {trialDays}-day free trial — no card charged until it ends.",
    quickCtaLabel: "Start free trial",
    form: {
      nameLabel: "Name", namePlaceholder: "Your name",
      shopLabel: "Shop name", shopPlaceholder: "Your shop",
      emailLabel: "Email", emailPlaceholder: "you@yourshop.com",
      phoneLabel: "Phone", phoneOptionalLabel: "(optional)", phonePlaceholder: "(555) 555-5555",
      messageLabel: "How can we help?", messagePlaceholder: "Tell us about your shop or ask a question…",
      submitLabel: "Send message", sendingLabel: "Sending…",
      privacyNote: "We'll never share your details. No spam, ever.",
      successTitle: "Message received",
      successBody: "Thanks for reaching out. We'll get back to you at the email you provided.",
      anotherLabel: "Send another message",
      validationError: "Please add your name and email.",
      failureError: "Something went wrong. Please try again.",
    },
  },
  finalCta: {
    title: "Run everything like a system.",
    body: "Try {brand} free for {trialDays} days — plans from $15/month after that. Cancel anytime.",
    ctaLabel: "Start your free trial",
  },
  footer: {
    blurb: "{tagline} The all-in-one platform for auto repair shops, small businesses, and personal life — built by a working mechanic.",
    productTitle: "Product",
    getStartedTitle: "Get started",
    startTrialLabel: "Start free trial",
    loginLabel: "Log in",
    contactLabel: "Contact us",
    termsLabel: "Terms",
    privacyLabel: "Privacy",
    statusLabel: "Status",
  },
};

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDefaults<T>(fallback: T, value: unknown): T {
  if (Array.isArray(fallback)) {
    return (Array.isArray(value) ? value : fallback) as T;
  }
  if (isRecord(fallback)) {
    const source = isRecord(value) ? value : {};
    const output: AnyRecord = {};
    for (const [key, defaultValue] of Object.entries(fallback)) {
      output[key] = mergeDefaults(defaultValue, source[key]);
    }
    return output as T;
  }
  return typeof value === typeof fallback ? (value as T) : fallback;
}

function validIcon(value: unknown): LandingIcon {
  return LANDING_ICONS.includes(value as LandingIcon)
    ? (value as LandingIcon)
    : "Star";
}

function sanitizeIcons(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeIcons);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "icon" ? validIcon(child) : sanitizeIcons(child),
    ]),
  );
}

export function normalizeLandingConfig(raw: unknown): LandingConfig {
  try {
    const merged = sanitizeIcons(
      mergeDefaults(DEFAULT_LANDING_CONFIG, raw),
    ) as LandingConfig;
    merged.theme = {
      ...DEFAULT_LANDING_CONFIG.theme,
      ...merged.theme,
      accent: /^#[0-9a-f]{6}$/i.test(merged.theme.accent)
        ? merged.theme.accent
        : DEFAULT_LANDING_CONFIG.theme.accent,
      accentSoft: /^#[0-9a-f]{6}$/i.test(merged.theme.accentSoft)
        ? merged.theme.accentSoft
        : DEFAULT_LANDING_CONFIG.theme.accentSoft,
      dark: /^#[0-9a-f]{6}$/i.test(merged.theme.dark)
        ? merged.theme.dark
        : DEFAULT_LANDING_CONFIG.theme.dark,
      light: /^#[0-9a-f]{6}$/i.test(merged.theme.light)
        ? merged.theme.light
        : DEFAULT_LANDING_CONFIG.theme.light,
      pattern: ["dots", "grid", "none"].includes(merged.theme.pattern)
        ? merged.theme.pattern
        : DEFAULT_LANDING_CONFIG.theme.pattern,
    };

    const custom = Array.isArray(merged.customSections)
      ? merged.customSections
          .filter(
            (section) =>
              isRecord(section) &&
              typeof section.id === "string" &&
              /^custom-[\w-]+$/.test(section.id) &&
              ["text", "cards", "cta", "faq"].includes(section.kind) &&
              typeof section.title === "string",
          )
          .map((section) => ({
            ...section,
            items: Array.isArray(section.items)
              ? section.items.filter(
                  (item) =>
                    isRecord(item) &&
                    typeof item.title === "string" &&
                    typeof item.desc === "string",
                )
              : [],
          }))
      : [];
    merged.customSections = custom as CustomSection[];
    const knownIds = new Set<string>(builtInOrder);
    const customIds = new Set(custom.map((section) => section.id));
    const seen = new Set<string>();
    const suppliedOrder = Array.isArray(merged.order) ? merged.order : [];
    const order = suppliedOrder.filter((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        typeof entry.enabled !== "boolean" ||
        (!knownIds.has(entry.id) && !customIds.has(entry.id)) ||
        seen.has(entry.id)
      ) return false;
      seen.add(entry.id);
      return true;
    }) as { id: string; enabled: boolean }[];
    for (const id of builtInOrder) {
      if (!seen.has(id)) order.push({ id, enabled: true });
    }
    for (const id of customIds) {
      if (!seen.has(id)) order.push({ id, enabled: true });
    }
    merged.order = order;
    return merged;
  } catch {
    return DEFAULT_LANDING_CONFIG;
  }
}
