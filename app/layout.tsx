import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Work_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

const bebasNeue = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vértice Performance — Plataforma de Desenvolvimento de Atletas",
  description:
    "Acompanhamento técnico, físico e mental de atletas de base — do treino à mesa tática.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  // "cover" deixa o app ocupar a tela toda no celular instalado (PWA), por
  // baixo do entalhe e da barra home. Sem isso o iOS desenha tarjas ao redor
  // e env(safe-area-inset-*) vale sempre 0. O AppShell usa esses insets para
  // não deixar o menu e a barra de abas por baixo do entalhe.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${bebasNeue.variable} ${workSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-chalk text-ink font-sans">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
