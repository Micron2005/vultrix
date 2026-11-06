"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

type CartEntry = { partId: string; quantity: number };
type CartProduct = {
  id: string;
  name: string;
  price: number;
  qtyOnHand: number;
  photoId: string | null;
  shopListed: boolean;
  archived: boolean;
};

const cartKey = (slug: string) => `vultrix-shop-cart:${slug}`;
const cartEvent = "vultrix-shop-cart-updated";

function readCart(slug: string): CartEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(cartKey(slug)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is CartEntry =>
        typeof item?.partId === "string" &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function useShopCart(slug: string): CartEntry[] {
  const serialized = useSyncExternalStore(
    (callback) => {
      window.addEventListener(cartEvent, callback);
      window.addEventListener("storage", callback);
      return () => {
        window.removeEventListener(cartEvent, callback);
        window.removeEventListener("storage", callback);
      };
    },
    () => localStorage.getItem(cartKey(slug)) ?? "[]",
    () => "[]",
  );
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is CartEntry =>
        typeof item?.partId === "string" &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeCart(slug: string, items: CartEntry[]) {
  localStorage.setItem(cartKey(slug), JSON.stringify(items));
  window.dispatchEvent(new Event(cartEvent));
}

export function ShopCartLink({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () =>
      setCount(readCart(slug).reduce((sum, item) => sum + item.quantity, 0));
    refresh();
    window.addEventListener(cartEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(cartEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [slug]);
  return (
    <Link
      href={`/store/${encodeURIComponent(slug)}/cart`}
      className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
    >
      Cart{count ? ` (${count})` : ""}
    </Link>
  );
}

export function AddToCartButton({
  slug,
  partId,
  stock,
}: {
  slug: string;
  partId: string;
  stock: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = stock < 1;
  function add() {
    if (soldOut) return;
    const items = readCart(slug);
    const found = items.find((item) => item.partId === partId);
    const nextQuantity = Math.min(stock, (found?.quantity ?? 0) + quantity);
    writeCart(
      slug,
      found
        ? items.map((item) =>
            item.partId === partId ? { ...item, quantity: nextQuantity } : item,
          )
        : [...items, { partId, quantity: nextQuantity }],
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!soldOut && (
        <div className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="px-3 py-2"
          >
            −
          </button>
          <span className="min-w-10 text-center">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((value) => Math.min(stock, value + 1))}
            className="px-3 py-2"
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {soldOut ? "Sold out" : added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}

export function ProductGallery({
  name,
  photos,
}: {
  name: string;
  photos: string[];
}) {
  const [index, setIndex] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  if (!photos.length) {
    return (
      <div className="grid aspect-square place-items-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900">
        No photos yet
      </div>
    );
  }
  const shift = (direction: number) =>
    setIndex((value) => (value + direction + photos.length) % photos.length);
  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900"
        onTouchStart={(event) => setTouchX(event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]?.clientX;
          if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 45) {
            shift(end < touchX ? 1 : -1);
          }
          setTouchX(null);
        }}
      >
        <img src={photos[index]} alt={name} className="aspect-square w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => shift(-1)}
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-xl text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => shift(1)}
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-xl text-white"
            >
              ›
            </button>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((photo, photoIndex) => (
            <button
              key={photo}
              type="button"
              onClick={() => setIndex(photoIndex)}
              aria-label={`Show photo ${photoIndex + 1}`}
              className={`shrink-0 overflow-hidden rounded-lg border-2 ${index === photoIndex ? "border-blue-600" : "border-transparent"}`}
            >
              <img src={photo} alt="" className="size-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CartPageClient({
  slug,
  products,
  shipEnabled,
  shipFlatRate,
  pickupEnabled,
  pickupNote,
  chargesEnabled,
}: {
  slug: string;
  products: CartProduct[];
  shipEnabled: boolean;
  shipFlatRate: number;
  pickupEnabled: boolean;
  pickupNote: string | null;
  chargesEnabled: boolean;
}) {
  const cart = useShopCart(slug);
  const [fulfillment, setFulfillment] = useState<"SHIP" | "PICKUP">(
    shipEnabled ? "SHIP" : "PICKUP",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = cart.map((entry) => ({
    entry,
    product: products.find((product) => product.id === entry.partId),
  }));
  const subtotal = rows.reduce(
    (sum, row) => sum + (row.product?.price ?? 0) * row.entry.quantity,
    0,
  );
  const unavailable = rows.some(
    ({ entry, product }) =>
      !product ||
      !product.shopListed ||
      product.archived ||
      product.qtyOnHand < entry.quantity,
  );
  const setQuantity = (partId: string, quantity: number) => {
    const next = cart
      .map((item) => (item.partId === partId ? { ...item, quantity } : item))
      .filter((item) => item.quantity > 0);
    writeCart(slug, next);
  };
  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/shop/${encodeURIComponent(slug)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, fulfillment }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setError(result.error ?? "Unable to start checkout.");
        setBusy(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Unable to start checkout. Please try again.");
      setBusy(false);
    }
  }
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  if (!cart.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 p-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        Your cart is empty. <Link className="text-blue-600 underline" href={`/store/${slug}`}>Browse items</Link>
      </div>
    );
  }
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-3">
        {rows.map(({ entry, product }) => (
          <div key={entry.partId} className="flex min-w-0 gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            {product?.photoId && (
              <img src={`/api/shop/photo/${product.photoId}`} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="break-words font-semibold">{product?.name ?? "Unavailable item"}</h2>
              <p className="text-sm text-zinc-500">{product ? money(product.price) : "No longer available"}</p>
              {product && product.qtyOnHand < entry.quantity && (
                <p className="text-sm text-red-700">Only {product.qtyOnHand} available.</p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <label className="text-sm">Qty</label>
                <input
                  type="number"
                  min={0}
                  max={product?.qtyOnHand ?? 99}
                  value={entry.quantity}
                  onChange={(event) => setQuantity(entry.partId, Number(event.target.value))}
                  className="w-20 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                />
                <button type="button" onClick={() => setQuantity(entry.partId, 0)} className="text-sm text-red-700 underline">Remove</button>
              </div>
            </div>
            <div className="shrink-0 font-medium">{product ? money(product.price * entry.quantity) : "—"}</div>
          </div>
        ))}
      </div>
      <aside className="h-fit min-w-0 space-y-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Fulfillment</h2>
        {shipEnabled && (
          <label className="flex items-start gap-3">
            <input type="radio" name="fulfillment" checked={fulfillment === "SHIP"} onChange={() => setFulfillment("SHIP")} />
            <span>Ship — {money(shipFlatRate)}</span>
          </label>
        )}
        {pickupEnabled && (
          <label className="flex items-start gap-3">
            <input type="radio" name="fulfillment" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} />
            <span>Pickup{pickupNote ? ` — ${pickupNote}` : ""}</span>
          </label>
        )}
        <div className="space-y-1 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{fulfillment === "SHIP" ? money(shipFlatRate) : money(0)}</span></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><span>Total</span><span>{money(subtotal + (fulfillment === "SHIP" ? shipFlatRate : 0))}</span></div>
        </div>
        {!chargesEnabled ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">This shop isn&apos;t taking payments yet.</p>
        ) : (
          <button type="button" disabled={busy || unavailable} onClick={checkout} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:bg-zinc-400">
            {busy ? "Opening checkout…" : "Checkout"}
          </button>
        )}
        {unavailable && <p className="text-sm text-red-700">Update or remove unavailable items before checkout.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}

export function ClearShopCartOnNew({ slug, clear }: { slug: string; clear: boolean }) {
  useEffect(() => {
    if (!clear) return;
    localStorage.removeItem(cartKey(slug));
    window.dispatchEvent(new Event(cartEvent));
  }, [slug, clear]);
  return null;
}
