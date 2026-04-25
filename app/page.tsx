import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-20">
      {/* Hero ----------------------------------------------------------- */}
      <section className="grid md:grid-cols-12 gap-8 items-end mb-16">
        <div className="md:col-span-8 rise rise-1">
          <div className="eyebrow mb-4">The exam is not a vocabulary test.</div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
            Pass the <span className="italic text-accent">Alberta Basic Security</span> exam —
            in the language you'll be tested in,
            <br />
            <span className="text-slate">at a level you can actually learn from.</span>
          </h1>
        </div>
        <div className="md:col-span-4 rise rise-2 border-l border-hair pl-6">
          <p className="text-base leading-relaxed text-ink/90">
            For students with limited English, the failure mode is rarely{" "}
            <em>"I don't know the answer."</em> It's <em>"I can't articulate it
            under pressure, in English, in my own words."</em>
          </p>
          <p className="mt-3 text-sm text-slate">
            ABST Coach drills both halves: comprehension first, performance
            second.
          </p>
        </div>
      </section>

      <div className="rule-diag mb-12" />

      {/* Four pillars --------------------------------------------------- */}
      <section className="grid md:grid-cols-2 gap-px bg-ink/10 border border-hair">
        <PillarCard
          delay="rise-1"
          eyebrow="Pillar I — Hero"
          title="Scenario Simulator"
          subtitle="Voice-driven roleplay. The exam tests judgment under pressure — practice that, not flashcards."
          href="/scenario"
          cta="Start a scenario →"
          big
        />
        <PillarCard
          delay="rise-2"
          eyebrow="Pillar II"
          title="Adaptive Quiz"
          subtitle="Diagnoses why you got it wrong — concept gap or vocabulary gap — and adapts to your weak areas."
          href="/quiz"
          cta="Start the quiz →"
        />
        <PillarCard
          delay="rise-3"
          eyebrow="Pillar III"
          title="Manual at Your Level"
          subtitle="The same provincial content rewritten at three reading levels, with sentence-level read-aloud. The exam is in English — practice in English."
          href="/reader"
          cta="Open the manual →"
        />
        <PillarCard
          delay="rise-4"
          eyebrow="Pillar IV"
          title="Progress & Confidence"
          subtitle="Tracks your accuracy across modules and tells you when you're ready to take the real exam."
          href="/progress"
          cta="View progress →"
        />
      </section>

      {/* Why it matters ------------------------------------------------- */}
      <section className="mt-20 grid md:grid-cols-12 gap-8">
        <div className="md:col-span-5 rise rise-3">
          <div className="eyebrow mb-3">Why this matters</div>
          <h2 className="font-display text-3xl leading-tight">
            Alberta licenses tens of thousands of security professionals
            through ABST.
          </h2>
        </div>
        <div className="md:col-span-7 rise rise-4 space-y-4 text-ink/85">
          <p>
            The provincial exam requires <strong>80% to pass</strong>. It mixes
            multiple choice with scenario-based short answer questions like
            <em> "A patron becomes aggressive after being asked to leave.
            Describe your response."</em>
          </p>
          <p>
            ESL students often understand the material — they study the same
            manual. They lose marks because writing a clear, lawful, English
            response under time pressure is a separate skill from comprehension.
          </p>
          <p className="font-display italic text-2xl leading-snug pt-2 border-t border-hair">
            ABST Coach is the only tool that drills the second skill.
          </p>
        </div>
      </section>
    </div>
  );
}

function PillarCard({
  eyebrow,
  title,
  subtitle,
  href,
  cta,
  delay,
  big = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  delay: string;
  big?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rise ${delay} group block bg-paper p-8 md:p-10 hover:bg-ink hover:text-paper transition-colors duration-300 ${
        big ? "md:row-span-1" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="eyebrow group-hover:text-gold">{eyebrow}</div>
        {big && (
          <div className="text-[10px] font-mono px-2 py-1 border border-current rounded-full">
            HERO
          </div>
        )}
      </div>
      <h3
        className={`font-display ${
          big ? "text-4xl" : "text-3xl"
        } leading-tight tracking-tight mb-3`}
      >
        {title}
      </h3>
      <p className="text-base leading-relaxed mb-6 max-w-md text-ink/80 group-hover:text-paper/80">
        {subtitle}
      </p>
      <div className="text-sm font-medium underline-offset-4 group-hover:underline">
        {cta}
      </div>
    </Link>
  );
}