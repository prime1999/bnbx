import type { Metadata } from "next";
import { Geist, Viga, Roboto } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Providers from "./ReactQueryProvider/Provider";

export const metadata: Metadata = {
  title: "BNBX",
  description: "An online marketplace for agents built on the BNB chain",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  display: "swap",
  subsets: ["latin"],
});

const viga = Viga({
  variable: "--font-viga",
  display: "swap",
  subsets: ["latin"],
  weight: ["400"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${roboto.variable} ${viga.variable} antialiased`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
