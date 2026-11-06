import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopCart,
  isValidShopSlug,
  suggestedShopSlug,
  type ShopCartPart,
} from "./shop";

const shop = {
  shipEnabled: true,
  shipFlatRate: 6.5,
  pickupEnabled: true,
};

const availablePart: ShopCartPart = {
  id: "part-1",
  name: "Handmade ceramic mug",
  unitPrice: 24.99,
  qtyOnHand: 4,
  shopListed: true,
  archived: false,
  photos: [{ id: "photo-1" }],
};

test("buildShopCart uses inventory prices instead of submitted prices", () => {
  const result = buildShopCart(
    [availablePart],
    [{ partId: "part-1", quantity: 2, unitPrice: 0.01 } as never],
    shop,
    "PICKUP",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.lines[0].unitPrice, 24.99);
  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.subtotal, 49.98);
  assert.equal(result.shipping, 0);
  assert.equal(result.total, 49.98);
  assert.equal(result.lines[0].photoId, "photo-1");
});

test("buildShopCart applies a flat shipping rate once", () => {
  const result = buildShopCart(
    [availablePart],
    [
      { partId: "part-1", quantity: 1 },
      { partId: "part-1", quantity: 1 },
    ],
    shop,
    "SHIP",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.subtotal, 49.98);
  assert.equal(result.shipping, 6.5);
  assert.equal(result.total, 56.48);
});

test("buildShopCart rejects invalid, unavailable, and over-stock quantities", () => {
  assert.equal(
    buildShopCart([availablePart], [{ partId: "part-1", quantity: 5 }], shop, "SHIP").ok,
    false,
  );
  assert.equal(
    buildShopCart(
      [{ ...availablePart, qtyOnHand: 0 }],
      [{ partId: "part-1", quantity: 1 }],
      shop,
      "SHIP",
    ).ok,
    false,
  );
  assert.equal(
    buildShopCart(
      [{ ...availablePart, shopListed: false }],
      [{ partId: "part-1", quantity: 1 }],
      shop,
      "SHIP",
    ).ok,
    false,
  );
  assert.equal(
    buildShopCart(
      [{ ...availablePart, archived: true }],
      [{ partId: "part-1", quantity: 1 }],
      shop,
      "SHIP",
    ).ok,
    false,
  );
  assert.equal(
    buildShopCart(
      [{ ...availablePart, unitPrice: null }],
      [{ partId: "part-1", quantity: 1 }],
      shop,
      "SHIP",
    ).ok,
    false,
  );
});

test("shop slugs are lowercase, bounded, and reject reserved routes", () => {
  assert.equal(isValidShopSlug("harbor-lane"), true);
  assert.equal(isValidShopSlug("ab"), false);
  assert.equal(isValidShopSlug("Harbor-Lane"), false);
  assert.equal(isValidShopSlug("-harbor"), false);
  assert.equal(isValidShopSlug("harbor-"), false);
  assert.equal(isValidShopSlug("admin"), false);
  assert.equal(isValidShopSlug("api"), false);
  assert.equal(isValidShopSlug("a".repeat(41)), false);
  assert.equal(suggestedShopSlug("The Harbor & Lane!"), "the-harbor-lane");
  assert.equal(suggestedShopSlug("API"), "my-shop");
});
