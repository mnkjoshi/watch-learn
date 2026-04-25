import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "ABST Coach — Pass the Alberta Security exam",
  description:
    "A scenario-based exam coach that prepares ESL students to pass the Alberta Basic Security Training provincial exam.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen relative">
        <Header />
        <main className="relative z-10">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="relative z-10 border-b border-hair">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Logo />
          <div>
            <div className="font-display text-xl leading-none">ABST Coach</div>
            <div className="eyebrow mt-0.5">Alberta Basic Security Training</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/reader" className="hover:text-accent transition">Manual</Link>
          <Link href="/quiz" className="hover:text-accent transition">Quiz</Link>
          <Link href="/scenario" className="hover:text-accent transition">Scenarios</Link>
          <Link href="/report" className="hover:text-accent transition">Reports</Link>
          <Link href="/progress" className="hover:text-accent transition">Progress</Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-hair mt-24">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate">
        <div>
          Built on AWS Bedrock · Polly · Transcribe ·{" "}
          <span className="font-mono">v0.1 hackathon-mvp</span>
        </div>
        <div>Manual source: open.alberta.ca · ABST Participant Manual, Oct 2014</div>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="text-ink" aria-hidden>
      <path
        d="M16 2 L28 7 V16 C28 22 22.5 27.5 16 30 C9.5 27.5 4 22 4 16 V7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M11 16 L14.5 19.5 L21 13"
        fill="none"
        stroke="#D64545"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}