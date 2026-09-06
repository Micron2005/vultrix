import { PDFDocument, PDFImage, rgb, type RGB } from "pdf-lib";

export async function embedShopLogo(
  pdf: PDFDocument,
  logo: string | null,
): Promise<PDFImage | null> {
  if (!logo || logo.startsWith("data:image/webp")) return null;
  const encodedLogo = logo.split(",", 2)[1];
  if (!encodedLogo) return null;
  try {
    return logo.startsWith("data:image/png")
      ? await pdf.embedPng(Buffer.from(encodedLogo, "base64"))
      : await pdf.embedJpg(Buffer.from(encodedLogo, "base64"));
  } catch {
    return null;
  }
}

export function pdfAccentColor(
  accent: string | null,
  fallback: RGB,
): RGB {
  if (!accent) return fallback;
  const match = /^#([0-9a-f]{6})$/i.exec(accent);
  if (!match) return fallback;
  const value = match[1];
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  );
}
