import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "quizzly",
  description: "Make an AI quiz, invite your friends, and find out who was bluffing.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
