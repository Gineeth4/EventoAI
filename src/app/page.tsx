import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flower2,
  Heart,
  Lightbulb,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  WandSparkles,
} from "lucide-react";

const experiencePillars = [
  {
    number: "01",
    title: "Ideas that feel like you",
    description:
      "Explore themes, details, and experiences shaped around the occasion, your priorities, and the people you're celebrating.",
    icon: Heart,
  },
  {
    number: "02",
    title: "Money with meaning",
    description:
      "Understand where the budget goes, which costs are uncertain, and what a proposed change could mean for the whole event.",
    icon: Wallet,
  },
  {
    number: "03",
    title: "From inspiration to action",
    description:
      "Turn a creative direction into preparation tasks, milestones, and a plan you can actually use.",
    icon: CalendarDays,
  },
];

const eventTypes = [
  {
    title: "Weddings",
    subtitle: "A day that's unmistakably yours",
    description:
      "Bring the atmosphere, guest experience, budget, and preparation together around your vision.",
    icon: Heart,
    accent: "wedding",
    href: "/plan",
  },
  {
    title: "Birthdays",
    subtitle: "Make the little things memorable",
    description:
      "Explore thoughtful themes, food, activities, and ways to make your celebration feel personal.",
    icon: Sparkles,
    accent: "birthday",
    href: "/plan",
  },
  {
    title: "Community events",
    subtitle: "Bring people together beautifully",
    description:
      "Organize activities, shared responsibilities, logistics, and the details that keep everyone connected.",
    icon: Users,
    accent: "community",
    href: "/plan",
  },
];

const workflow = [
  {
    number: "01",
    title: "Start with the idea",
    description:
      "Begin with the occasion and what matters to you. Your plan should adapt to your needs, not the other way around.",
    icon: MessageCircle,
  },
  {
    number: "02",
    title: "Explore the possibilities",
    description:
      "Shape the creative direction, review practical constraints, and understand the trade-offs before choosing.",
    icon: Compass,
  },
  {
    number: "03",
    title: "Make it happen",
    description:
      "Turn the direction you choose into clear costs, useful tasks, and a timeline for the days ahead.",
    icon: CheckCircle2,
  },
];

function Brand() {
  return (
    <Link
      className="home-brand"
      href="/"
      aria-label="EventoAI home"
    >
      <span className="home-brand-mark" aria-hidden="true">
        <CalendarDays size={21} strokeWidth={1.9} />
      </span>

      <span className="home-brand-name">
        <strong>EventoAI</strong>
        <span>Moments, thoughtfully planned</span>
      </span>
    </Link>
  );
}

function StudioPreview() {
  return (
    <div className="home-preview-wrap" id="studio-preview">
      <div className="home-preview-glow" aria-hidden="true" />

      <div className="home-preview">
        <div className="home-preview-topbar">
          <div className="home-preview-app">
            <span className="home-preview-app-icon">
              <Sparkles size={15} aria-hidden="true" />
            </span>

            <div>
              <strong>Your event studio</strong>
              <span>Concept exploration</span>
            </div>
          </div>

          <span className="home-preview-state">
            <span />
            Preview
          </span>
        </div>

        <div className="home-preview-body">
          <div className="home-preview-kicker">
            <span>AN IDEA TAKES SHAPE</span>
            <span>01 / 03</span>
          </div>

          <h2>A celebration that feels like you.</h2>

          <p className="home-preview-description">
            One starting point. Different ways to make the moment
            meaningful.
          </p>

          <div className="home-concept-grid">
            <article className="home-concept home-concept--garden">
              <div className="home-concept-art">
                <span className="home-art-sun" />
                <span className="home-art-hill home-art-hill--one" />
                <span className="home-art-hill home-art-hill--two" />
                <span className="home-art-flower home-art-flower--one">
                  <Flower2 size={24} />
                </span>
                <span className="home-art-flower home-art-flower--two">
                  <Flower2 size={18} />
                </span>
              </div>

              <div className="home-concept-content">
                <span className="home-concept-number">DIRECTION 01</span>
                <h3>Garden afterglow</h3>
                <p>Botanical · Warm · Unhurried</p>
              </div>
            </article>

            <article className="home-concept home-concept--intimate">
              <div className="home-concept-art">
                <span className="home-art-orb home-art-orb--one" />
                <span className="home-art-orb home-art-orb--two" />
                <span className="home-art-vase" />
                <span className="home-art-leaf home-art-leaf--one" />
                <span className="home-art-leaf home-art-leaf--two" />
                <span className="home-art-candle" />
              </div>

              <div className="home-concept-content">
                <span className="home-concept-number">DIRECTION 02</span>
                <h3>Modern intimate</h3>
                <p>Minimal · Personal · Refined</p>
              </div>
            </article>

            <article className="home-concept home-concept--playful">
              <div className="home-concept-art">
                <span className="home-playful-circle home-playful-circle--one" />
                <span className="home-playful-circle home-playful-circle--two" />
                <span className="home-playful-circle home-playful-circle--three" />
                <span className="home-playful-star">✳</span>
                <span className="home-playful-dot home-playful-dot--one" />
                <span className="home-playful-dot home-playful-dot--two" />
              </div>

              <div className="home-concept-content">
                <span className="home-concept-number">DIRECTION 03</span>
                <h3>Joyful gathering</h3>
                <p>Expressive · Social · Creative</p>
              </div>
            </article>
          </div>

          <div className="home-preview-bottom">
            <div className="home-preview-note">
              <span className="home-preview-note-icon">
                <WandSparkles size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>Your preferences set the direction.</strong>
                <span>Illustrative concept preview, not a generated plan.</span>
              </div>
            </div>

            <span className="home-preview-dots" aria-label="Three concept directions">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      </div>

      <div className="home-floating-note home-floating-note--top">
        <span className="home-floating-icon">
          <Heart size={16} aria-hidden="true" />
        </span>
        <span>
          <strong>Your vision</strong>
          <small>Always at the centre</small>
        </span>
      </div>

      <div className="home-floating-note home-floating-note--bottom">
        <span className="home-floating-icon home-floating-icon--sage">
          <ShieldCheck size={16} aria-hidden="true" />
        </span>
        <span>
          <strong>Clear decisions</strong>
          <small>You stay in control</small>
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="home-nav">
        <div className="home-container home-nav-inner">
          <Brand />

          <nav className="home-nav-links" aria-label="Main navigation">
            <Link href="#experience">The experience</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="/events">My events</Link>
          </nav>

          <div className="home-nav-actions">
            <Link
              className="studio-button studio-button--primary home-nav-cta"
              href="/plan"
            >
              Begin planning
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-container home-hero-grid">
          <div className="home-hero-copy studio-motion-enter">
            <div className="home-hero-overline">
              <span className="home-overline-icon">
                <Sparkles size={14} aria-hidden="true" />
              </span>
              <span>THE ART OF THOUGHTFUL PLANNING</span>
            </div>

            <h1>
              Don&apos;t just plan an event.
              <span className="home-hero-title-accent">
                Design the feeling.
              </span>
            </h1>

            <p className="home-hero-description">
              Every memorable event begins with a feeling. EventoAI helps
              you shape that idea into a thoughtful plan, with creative
              direction, clear budgets, and practical next steps.
            </p>

            <div className="home-hero-actions">
              <Link
                className="studio-button studio-button--primary studio-button--lg"
                href="/plan"
              >
                Start with your idea
                <ArrowRight size={18} aria-hidden="true" />
              </Link>

              <Link
                className="studio-button studio-button--secondary studio-button--lg"
                href="#experience"
              >
                Explore the experience
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </div>

            <div className="home-hero-assurance">
              <span>
                <Check size={14} aria-hidden="true" />
                Your priorities come first
              </span>
              <span>
                <Check size={14} aria-hidden="true" />
                Understand your costs
              </span>
            </div>

            <div className="home-hero-signature">
              <span className="home-signature-line" />
              <span>For the moments that matter.</span>
            </div>
          </div>

          <div className="studio-motion-enter studio-motion-enter--delayed">
            <StudioPreview />
          </div>
        </div>

        <div className="home-hero-bottom" aria-hidden="true">
          <div className="home-container home-hero-bottom-inner">
            <span>CREATIVE THINKING</span>
            <i />
            <span>PRACTICAL PLANNING</span>
            <i />
            <span>YOUR FINAL SAY</span>
          </div>
        </div>
      </section>

      <section className="home-principles" aria-label="Planning principles">
        <div className="home-container home-principles-grid">
          {experiencePillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article className="home-principle" key={pillar.number}>
                <div className="home-principle-top">
                  <span className="home-principle-number">
                    {pillar.number}
                  </span>
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                </div>

                <h2>{pillar.title}</h2>
                <p>{pillar.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="home-events-section"
        id="experience"
        aria-labelledby="home-events-heading"
      >
        <div className="home-container">
          <div className="home-section-heading">
            <div>
              <span className="home-section-eyebrow">
                <span />
                EVERY OCCASION HAS A STORY
              </span>

              <h2 id="home-events-heading">
                Your moment.
                <br />
                Your own kind of magic.
              </h2>
            </div>

            <p>
              The right plan looks different for every celebration.
              Start with the occasion, then shape the experience around
              the people and priorities that matter most.
            </p>
          </div>

          <div className="home-events-grid">
            {eventTypes.map((eventType, index) => {
              const Icon = eventType.icon;

              return (
                <article
                  className={`home-event-card home-event-card--${eventType.accent}`}
                  key={eventType.title}
                >
                  <div className="home-event-card-top">
                    <span className="home-event-card-index">
                      0{index + 1}
                    </span>

                    <span className="home-event-icon">
                      <Icon size={21} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </div>

                  <span className="home-event-subtitle">
                    {eventType.subtitle}
                  </span>

                  <h3>{eventType.title}</h3>
                  <p>{eventType.description}</p>

                  <Link
                    className="home-event-link"
                    href={eventType.href}
                  >
                    Explore this occasion
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="home-events-footnote">
            <Sparkles size={16} aria-hidden="true" />
            <span>
              Whatever you&apos;re celebrating, start with what you imagine.
            </span>
          </div>
        </div>
      </section>

      <section
        className="home-workflow-section"
        id="how-it-works"
        aria-labelledby="home-workflow-heading"
      >
        <div className="home-container home-workflow-layout">
          <div className="home-workflow-intro">
            <span className="home-section-eyebrow">
              <span />
              A MORE HUMAN WAY TO PLAN
            </span>

            <h2 id="home-workflow-heading">
              From the first thought
              <span> to the final detail.</span>
            </h2>

            <p>
              Great planning isn&apos;t about filling in more fields.
              It&apos;s about making the right decisions in the right order.
            </p>

            <Link
              className="home-text-link"
              href="/plan"
            >
              Begin your planning journey
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="home-workflow-list">
            {workflow.map((step) => {
              const Icon = step.icon;

              return (
                <article className="home-workflow-step" key={step.number}>
                  <div className="home-workflow-number">
                    {step.number}
                  </div>

                  <div className="home-workflow-icon">
                    <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  </div>

                  <div className="home-workflow-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>

                  <ArrowUpRight
                    className="home-workflow-arrow"
                    size={17}
                    aria-hidden="true"
                  />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-difference-section">
        <div className="home-container">
          <div className="home-difference-card">
            <div className="home-difference-copy">
              <span className="home-section-eyebrow home-section-eyebrow--light">
                <span />
                MORE THAN A GENERATED LIST
              </span>

              <h2>
                Your plan should evolve
                <em> as your ideas do.</em>
              </h2>

              <p>
                A venue changes. Guest numbers grow. Priorities shift.
                Our vision for EventoAI is to help you understand
                what a change affects, explore alternatives, and decide
                what to do next—with you in control.
              </p>

              <Link
                className="studio-button studio-button--secondary studio-button--lg home-difference-button"
                href="/plan"
              >
                Explore planning
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>

            <div className="home-decision-card">
              <div className="home-decision-top">
                <span className="home-decision-sparkle">
                  <WandSparkles size={17} aria-hidden="true" />
                </span>

                <div>
                  <strong>A more thoughtful next step</strong>
                  <span>Illustrative experience preview</span>
                </div>
              </div>

              <div className="home-decision-message">
                “I&apos;d like to keep the atmosphere but spend less.”
              </div>

              <div className="home-decision-response">
                <span className="home-decision-response-icon">
                  <Lightbulb size={17} aria-hidden="true" />
                </span>

                <div>
                  <strong>Explore the trade-offs</strong>
                  <p>
                    Compare lower-cost alternatives, review the impact,
                    and approve the direction that feels right.
                  </p>
                </div>
              </div>

              <div className="home-decision-footer">
                <span>
                  <ShieldCheck size={15} aria-hidden="true" />
                  Your plan. Your decisions.
                </span>
                <span className="home-decision-status">PREVIEW</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-final-section">
        <div className="home-container home-final-content">
          <span className="home-final-icon">
            <Flower2 size={23} strokeWidth={1.65} aria-hidden="true" />
          </span>

          <span className="home-section-eyebrow">
            THE MOMENT IS YOURS
          </span>

          <h2>
            Make space for
            <span> the memories.</span>
          </h2>

          <p>
            Begin with an idea. Build a plan that reflects what matters.
            Let the details come together, one thoughtful decision at a time.
          </p>

          <Link
            className="studio-button studio-button--primary studio-button--lg"
            href="/plan"
          >
            Start planning your event
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <span className="home-final-note">
            Thoughtful ideas. Clearer decisions. More meaningful moments.
          </span>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container home-footer-main">
          <Brand />

          <p>
            A more considered way to bring your ideas to life.
          </p>

          <nav className="home-footer-links" aria-label="Footer navigation">
            <Link href="/plan">Planning studio</Link>
            <Link href="/events">My events</Link>
            <Link href="#how-it-works">How it works</Link>
          </nav>
        </div>

        <div className="home-container home-footer-bottom">
          <span>© 2026 EventoAI</span>
          <span>
            <Heart size={13} aria-hidden="true" />
            Made for meaningful moments
          </span>
        </div>
      </footer>
    </main>
  );
}