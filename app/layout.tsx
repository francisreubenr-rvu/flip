import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import { AuthProvider } from "./lib/auth";
import "./globals.css";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FLIP — A focus instrument.",
  description: "A vertical scrolling productivity manifesto. Clock, focus, sound, restoration.",
};

// Runs synchronously before paint — reads the saved theme and applies it to
// <html> before any CSS is evaluated, preventing a light-flash on dark theme.
const themeScript = `
try {
  const t = localStorage.getItem('flip-theme');
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
} catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
