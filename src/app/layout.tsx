import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Gym Progress",
  description: "Registra tus entrenamientos y supera tu última sesión.",
  applicationName: "Gym Progress",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("dark h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
