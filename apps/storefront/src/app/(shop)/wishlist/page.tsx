import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist-view";

/** The wishlist is a private shopping intent, not a catalogue page — keep it out of search. */
export const metadata: Metadata = {
  title: "Your Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return <WishlistView />;
}
