import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Literata, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { DevImpersonationProvider } from "@/lib/hooks/useDevImpersonation";
import OfflineBanner from "@/components/shared/OfflineBanner";

// Identidade visual Terra: Literata (serifa quente pra títulos) +
// Nunito Sans (sans arredondada pro corpo). As variáveis CSS são
// consumidas pelo tailwind.config (fontFamily.headline / fontFamily.sans).
const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Festa São João - Sistema Cashless",
    template: "%s | Festa São João",
  },
  description:
    "Sistema de pagamento cashless para a Festa de São João. Compre créditos, pague nas barracas e acompanhe seu saldo em tempo real.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SJPII Cashless",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#181c1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${literata.variable} ${nunitoSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
        <DevImpersonationProvider>
          <AuthProvider>
            <OfflineBanner />
            {children}
          </AuthProvider>
        </DevImpersonationProvider>
      </body>
    </html>
  );
}
