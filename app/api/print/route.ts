import { NextResponse } from "next/server";
import { activePromotion } from "../../../lib/print";
import { getPrintContent } from "../../../lib/print-store";

// Public 3D print content for the native app (the website renders the same
// data server-side). Only published rows are returned — the store filters
// inactive entries and expired promotions before responding.
export const revalidate = 300;

export async function GET() {
  try {
    const content = await getPrintContent();
    const promo = activePromotion(content.promotions);
    return NextResponse.json(
      {
        settings: content.settings,
        categories: content.categories,
        materials: content.materials,
        promotions: promo ? [promo] : [],
        gallery: content.gallery,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Print content read failed", error);
    return NextResponse.json({ error: "Could not load 3D print content." }, { status: 500 });
  }
}
