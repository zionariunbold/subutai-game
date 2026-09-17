import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Сүбээдэйн бүслэлт", description: "Сум харваж, дайснаас бултан цайзыг эзэл." };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="mn"><body>{children}</body></html>; }
