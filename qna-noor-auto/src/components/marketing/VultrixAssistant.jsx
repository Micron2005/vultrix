"use client";
/* eslint-disable */
// Vultrix Assistant — a zero-cost, self-contained chat widget for the landing page.
// No LLM, no API keys, no monthly bill: answers come from a built-in knowledge
// base about Vultrix, and it captures interested visitors as leads by posting to
// /api/leads (source = "assistant"), feeding the admin Leads dashboard + email alerts.

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Phone } from "lucide-react";

const EMAIL_RE = /[^@\s]+@[^@\s]+\.[^@\s]+/;

function respond(raw, cfg) {
  const t = (raw || "").toLowerCase();
  const has = (...ws) => ws.some((w) => t.includes(w));

  if (has("human", "talk to", "sales", "callback", "call back", "speak", "rep", "real person", "someone", "contact"))
    return { action: "capture", text: "Happy to connect you with a human. Drop your name and email below and the team will reach out \u2014 usually the same day." };

  if (has("price", "pricing", "cost", "how much", "$", "monthly", "per month", "fee", "expensive", "cheap", "afford", "subscrib"))
    return { text: `${cfg.brand} is $${cfg.price}/month, flat \u2014 no setup fees, no contract, cancel anytime. You also get a ${cfg.trialDays}-day free trial to try it first. A Pro tier with extra power is coming soon.`, quick: ["Free trial", "Features", "Talk to a human"] };

  if (has("trial", "free", "try it", "try ", "test it", "demo"))
    return { text: `Yes \u2014 there is a ${cfg.trialDays}-day free trial, no strings. Tap Sign up at the top to start, or I can have someone walk you through it.`, quick: ["Sign up help", "Pricing", "Talk to a human"] };

  if (has("sign up", "signup", "get started", "register", "create account", "onboard"))
    return { action: "capture", text: `Great choice. You can start the ${cfg.trialDays}-day free trial from the Sign up button at the top. Want a quick walkthrough first? Leave your details and the team will help you set up.` };

  if (has("invoice", "estimate", "quote", "repair order", "work order", " ro ", "billing"))
    return { text: "Vultrix runs the whole job: build estimates, get approvals from a phone, turn them into repair orders with labor + parts, then invoice and take payment via Stripe. Clean PDFs and shareable links included.", quick: ["Features", "Pricing", "Talk to a human"] };

  if (has("part", "inventory", "stock", "supplier", "fitment", "fit"))
    return { text: "Track parts and inventory, see what fits a specific vehicle, and jump to your suppliers in one click \u2014 plus low-stock and reorder tracking.", quick: ["Features", "How it works"] };

  if (has("customer", "vehicle", "vin", "plate", "history"))
    return { text: "Every customer and vehicle gets a searchable history \u2014 past jobs, invoices, and notes. VIN/plate lookup decodes the vehicle (recalls included) in seconds.", quick: ["Features", "Free trial"] };

  if (has("reminder", "follow up", "retention", "come back", "repeat"))
    return { text: "Automatic service reminders bring customers back \u2014 Vultrix flags vehicles due for service so you can reach out at the right time.", quick: ["Features", "Talk to a human"] };

  if (has("report", "revenue", "analytics", "owed", "money", "profit", "dashboard"))
    return { text: "Built-in reporting shows revenue, money owed, tech hours, and shop activity at a glance \u2014 right on your dashboard.", quick: ["Features", "Pricing"] };

  if (has("how", "work", "workflow", "process", "setup", "set up", "use it"))
    return { text: "Simple flow: create a repair order \u2192 add jobs, parts & labor \u2192 send the estimate \u2192 customer approves \u2192 invoice \u2192 take payment. Most shops are set up in about a day.", quick: ["Pricing", "Free trial", "Talk to a human"] };

  if (has("phone", "mobile", "tablet", "ipad", "device", "computer", "laptop", "android", "iphone"))
    return { text: "Works on any device \u2014 phone, tablet, or desktop. Nothing to install; just log in from a browser.", quick: ["Free trial", "Features"] };

  if (has("export", "my data", "own data", "leave", "migrate", "switch", "import", "move from"))
    return { text: "Your data is yours \u2014 export it anytime. Switching from another tool? The team can help import your customers and vehicles.", quick: ["Talk to a human", "Pricing"] };

  if (has("secure", "security", "stripe", "payment", "card", "safe", "pci"))
    return { text: "Payments and billing run through Stripe \u2014 secure and PCI-compliant. Vultrix never stores raw card numbers.", quick: ["Pricing", "Free trial"] };

  if (has("roadmap", "future", "coming", "upcoming", "soon", "planned"))
    return { text: "On the roadmap: two-way customer texting, deeper reporting, a Pro tier, and more. The full list is in the Roadmap section above.", quick: ["Pricing", "Talk to a human"] };

  if (has("shop", "qna", "noor", "recommend", "near me", "my car", "fix"))
    return { text: cfg.shopUrl ? `Need actual auto repair? ${cfg.brand} is built by the crew at ${cfg.shopName} \u2014 check them out at ${cfg.shopUrl}.` : `Fun fact: ${cfg.brand} is built by a working shop, ${cfg.shopName}. Their website is coming soon.`, quick: ["Features", "Talk to a human"] };

  if (has("hi", "hey", "hello", "yo ", "sup", "good morning", "good afternoon"))
    return { text: `Hey! I am the ${cfg.brand} assistant. Ask me about pricing, features, the free trial, or how it works \u2014 or I can connect you with a human.`, quick: ["Pricing", "Free trial", "Features", "Talk to a human"] };

  if (has("thank", "thanks", "appreciate", "cool", "great", "awesome", "nice", "ok", "okay"))
    return { text: "Anytime! Anything else I can help with?", quick: ["Pricing", "Free trial", "Talk to a human"] };

  return { action: "offer", text: `Good question \u2014 I want to make sure you get a solid answer. I can connect you with the ${cfg.brand} team, or ask me about pricing, features, the free trial, or how it works.`, quick: ["Pricing", "Features", "Talk to a human"] };
}

export default function VultrixAssistant(props) {
  const cfg = {
    brand: props.brand || "Vultrix",
    price: props.price || 45,
    trialDays: props.trialDays || 14,
    phone: props.phone || "",
    phoneHref: props.phoneHref || "",
    shopName: props.shopName || "QNA / Noor Auto Repair",
    shopUrl: props.shopUrl || "",
    signupUrl: props.signupUrl || "/signup",
  };

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: `Hi! I am the ${cfg.brand} assistant \u2014 here to answer quick questions about the software. What can I help with?`,
      quick: ["Pricing", "Free trial", "Features", "How it works", "Talk to a human"],
    },
  ]);
  const [input, setInput] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [lead, setLead] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, capturing, open]);

  function pushBot(text, quick) {
    setMessages((m) => [...m, { role: "bot", text, quick }]);
  }
  function pushUser(text) {
    setMessages((m) => [...m, { role: "user", text }]);
  }

  function handleUserText(text) {
    const clean = (text || "").trim();
    if (!clean) return;
    pushUser(clean);
    setInput("");

    // If they typed an email, jump straight into capture with it prefilled.
    const emailMatch = clean.match(EMAIL_RE);
    const r = respond(clean, cfg);

    setTimeout(() => {
      pushBot(r.text, r.quick);
      if (r.action === "capture") {
        if (emailMatch) setLead((l) => ({ ...l, email: emailMatch[0] }));
        setCapturing(true);
      } else if (emailMatch && !capturing) {
        setLead((l) => ({ ...l, email: emailMatch[0] }));
        setCapturing(true);
        pushBot("Looks like you shared an email \u2014 want the team to reach out? Add your name and send.");
      }
    }, 180);
  }

  async function submitLead(e) {
    if (e) e.preventDefault();
    if (submitting) return;
    if (!lead.name.trim()) {
      pushBot("Mind adding your name so we know who to reach out to?");
      return;
    }
    if (!EMAIL_RE.test(lead.email.trim())) {
      pushBot("That email does not look right \u2014 could you double-check it?");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name.trim(),
          email: lead.email.trim(),
          message: "Reached out via the website assistant.",
          source: "assistant",
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setCapturing(false);
      setLead({ name: "", email: "" });
      pushBot(
        `Thanks, ${lead.name.trim().split(" ")[0]}! \u2705 The ${cfg.brand} team will reach out shortly. In the meantime you can start your ${cfg.trialDays}-day free trial from the Sign up button up top.`,
        ["Pricing", "Features"],
      );
    } catch {
      pushBot(
        cfg.phone
          ? `Hmm, something went wrong sending that. You can also call us at ${cfg.phone}.`
          : "Hmm, something went wrong sending that. Please try the contact form below the page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Launcher button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open Vultrix assistant"}
        data-testid="assistant-toggle"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 h-12 px-4 rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-800 transition-transform duration-200 hover:-translate-y-0.5"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        <span className="hidden sm:inline text-sm font-semibold">
          {open ? "Close" : "Ask Vultrix"}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Vultrix assistant"
          data-testid="assistant-panel"
          className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 z-50 sm:w-[380px] max-h-[72vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-zinc-900 text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-zinc-900 font-bold">
                {cfg.brand.charAt(0)}
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold">{cfg.brand} Assistant</div>
                <div className="text-[11px] text-zinc-300">Typically replies instantly</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-[#fafafa]">
            {messages.map((m, i) => (
              <div key={i}>
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-amber-500 px-3 py-2 text-sm text-zinc-900"
                      : "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
                  }
                  data-testid={m.role === "bot" ? "assistant-bot-msg" : "assistant-user-msg"}
                >
                  {m.text}
                </div>
                {m.role === "bot" && m.quick && m.quick.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.quick.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleUserText(q)}
                        className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:border-amber-400 hover:text-zinc-900 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Lead capture form */}
            {capturing && (
              <form
                onSubmit={submitLead}
                className="mr-auto w-full rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2"
                data-testid="assistant-capture-form"
              >
                <input
                  type="text"
                  placeholder="Your name"
                  value={lead.name}
                  onChange={(e) => setLead((l) => ({ ...l, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  data-testid="assistant-name-input"
                />
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={lead.email}
                  onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  data-testid="assistant-email-input"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition-colors"
                    data-testid="assistant-capture-submit"
                  >
                    {submitting ? "Sending\u2026" : "Request a callback"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapturing(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
                {cfg.phone && (
                  <a
                    href={`tel:${cfg.phoneHref || cfg.phone}`}
                    className="flex items-center gap-1.5 pt-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    <Phone className="h-3.5 w-3.5" /> or call {cfg.phone}
                  </a>
                )}
              </form>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-zinc-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUserText(input);
                }}
                placeholder="Ask about pricing, features..."
                className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-amber-500"
                data-testid="assistant-input"
              />
              <button
                type="button"
                onClick={() => handleUserText(input)}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors"
                data-testid="assistant-send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="pt-1 text-center text-[10px] text-zinc-400">
              Powered by {cfg.brand} {"\u00b7"} no question too small
            </div>
          </div>
        </div>
      )}
    </>
  );
}
