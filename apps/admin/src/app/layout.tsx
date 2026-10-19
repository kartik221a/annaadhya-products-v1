import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

/**
 * Root layout for the admin panel. The admin is a client-rendered console:
 * AuthProvider (session restore) + ToastProvider wrap the whole tree, and the
 * (dashboard) route group adds the guarded sidebar shell.
 */
export const metadata: Metadata = {
  title: {
    default: "Annaadhya Admin",
    template: "%s · Annaadhya Admin",
  },
  description: "Administration console for the Annaadhya Products storefront — products, orders, inventory, purchases, expenses, reports and team.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#1E4D3B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
