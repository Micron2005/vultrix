import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateSalesByChannel,
  buildProductFeedXml,
  buildShopCart,
  isValidShopSlug,
  shopDisplayName,
  suggestedShopSlug,
  type ShopCartPart,
  type ProductFeedItem,
  xmlEscape,
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
  assert.equal(
    buildShopCart(
      [{ ...availablePart, photos: [] }],
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

test("shopDisplayName prefers the custom name and falls back to the organization name", () => {
  assert.equal(
    shopDisplayName({ name: " Brightside Market " }, "Brightside Cleaning Co."),
    "Brightside Market",
  );
  assert.equal(shopDisplayName({ name: "   " }, "Brightside Cleaning Co."), "Brightside Cleaning Co.");
  assert.equal(shopDisplayName({ name: null }, "Brightside Cleaning Co."), "Brightside Cleaning Co.");
});

test("xmlEscape escapes all XML special characters", () => {
  assert.equal(
    xmlEscape(`& < > " '`),
    "&amp; &lt; &gt; &quot; &apos;",
  );
});

test("buildProductFeedXml filters products and builds a Google product feed", () => {
  const items: ProductFeedItem[] = [
    {
      id: `part<&"'`,
      name: `Mugs & <cups> "bright" 'new'`,
      description: `Handmade & durable <ceramic> "cups"`,
      unitPrice: 14.5,
      qtyOnHand: 2,
      category: "Home & kitchen",
      photoIds: ["photo&1", "photo-2", "photo-3", "photo-4", "photo-5", "photo-6", "photo-7"],
    },
    {
      id: "out-of-stock",
      name: "Out of stock",
      description: null,
      unitPrice: 12,
      qtyOnHand: 0,
      category: null,
      photoIds: ["photo-8"],
    },
    {
      id: "no-photo",
      name: "No photo",
      description: null,
      unitPrice: 10,
      qtyOnHand: 1,
      category: null,
      photoIds: [],
    },
    {
      id: "no-price",
      name: "No price",
      description: null,
      unitPrice: null,
      qtyOnHand: 1,
      category: null,
      photoIds: ["photo-9"],
    },
  ];
  const shop = { slug: "bright-side", name: "Brightside Market", shipEnabled: true, shipFlatRate: 6.5 };
  const feed = buildProductFeedXml(
    shop,
    `Harbor & Lane's "Shop"`,
    items,
    "https://vultrix.example/",
  );

  assert.equal((feed.match(/<item>/g) ?? []).length, 2);
  assert.match(feed, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
  assert.match(feed, /<g:id>part&lt;&amp;&quot;&apos;<\/g:id>/);
  assert.match(feed, /<g:title>Mugs &amp; &lt;cups&gt; &quot;bright&quot; &apos;new&apos;<\/g:title>/);
  assert.match(feed, /<g:description>Handmade &amp; durable &lt;ceramic&gt; &quot;cups&quot;<\/g:description>/);
  assert.match(feed, /<g:link>https:\/\/vultrix\.example\/store\/bright-side\/part%3C%26%22&apos;<\/g:link>/);
  assert.match(feed, /<g:image_link>https:\/\/vultrix\.example\/api\/shop\/photo\/photo%261<\/g:image_link>/);
  assert.equal((feed.match(/<g:additional_image_link>/g) ?? []).length, 5);
  assert.match(feed, /<g:price>14\.50 USD<\/g:price>/);
  assert.match(feed, /<g:availability>in_stock<\/g:availability>/);
  assert.match(feed, /<g:availability>out_of_stock<\/g:availability>/);
  assert.match(feed, /<g:brand>Brightside Market<\/g:brand>/);
  assert.match(feed, /<title>Brightside Market product feed<\/title>/);
  assert.match(feed, /<description>Products available from Brightside Market<\/description>/);
  assert.match(feed, /<g:identifier_exists>no<\/g:identifier_exists>/);
  assert.match(feed, /<g:product_type>Home &amp; kitchen<\/g:product_type>/);
  assert.match(feed, /<g:shipping><g:country>US<\/g:country><g:price>6\.50 USD<\/g:price><\/g:shipping>/);

  const pickupOnlyFeed = buildProductFeedXml(
    { ...shop, shipEnabled: false },
    "Shop",
    [items[0]],
    "https://vultrix.example",
  );
  assert.doesNotMatch(pickupOnlyFeed, /<g:shipping>/);
});

test("aggregateSalesByChannel groups channels and sorts by revenue", () => {
  assert.deepEqual(
    aggregateSalesByChannel([
      { channel: "Etsy", quantity: 2, unitPrice: 12.5 },
      { channel: null, quantity: 1, unitPrice: 8 },
      { channel: "Vultrix Shop", quantity: 3, unitPrice: 10 },
      { channel: "Etsy", quantity: 1, unitPrice: 5 },
    ]),
    [
      { channel: "Etsy", count: 2, itemsSold: 3, revenue: 30 },
      { channel: "Your Vultrix shop", count: 1, itemsSold: 3, revenue: 30 },
      { channel: "Not set", count: 1, itemsSold: 1, revenue: 8 },
    ],
  );
});
