import { Link } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import LiveFeed from "../components/LiveFeed.jsx";

const watches = [
  [
    "Proactive threat Intelligence",
    "Our team actively hunts down new scams and localized attacks. We notify at-risk institution instantly and deliver precise steps to neutralize the threat.",
  ],
  [
    "Precision Routing",
    "Alerts are segmented by industry and threat profile, ensuring critical warnings reach the right stakeholders without creating alert fatigue.",
  ],
  [
    "Actionable Playbooks",
    "Every alert details the exact nature of the threat and provides a sequential, prioritized response strategy.",
  ],
  [
    "Omnichannel Delivery",
    "Owners, admins, and analysts receive push notifications via email, with all alerts securely archived in your central dashboard.",
  ],
  [
    "Compliance Tracking",
    "Document your incident response directly on the platform to maintain a verifiable audit trail for regulators and internal reviews.",
  ],
  [
    "Knowledge Base",
    "Equip your team with comprehensive threat profiles and localized incident response guides to understand how each fraud type operates.",
  ],
];

const audience = [
  [
    "Banks and microfinance",
    "Prevent unauthorized transfers and internal account takeovers.",
  ],
  [
    "Hospitals and clinics",
    "Secure sensitive patient records against unauthorized access and exfiltration.",
  ],
  [
    "Universities and schools",
    "Protect academic records, admission integrity, and fee processing portals.",
  ],
  [
    "Government agencies",
    "Identify ghost-workers payroll schemes, misappropriation of funds, and citizen data breaches.",
  ],
  [
    "Insurance firms",
    "Combat fraudulent claims and unauthorized policy modifications.",
  ],
  [
    "Fintechs and payment providers",
    "Flag API abuse and anomalous transaction patterns.",
  ],
  [
    "NGOs and cooperatives",
    "Safeguard donor capital, grant disbursements, and internal financial records.",
  ],
  [
    "Retail and logistics",
    "Prevent vendor impersonation, invoice fraud, and inventory diversion.",
  ],
];

const steps = [
  [
    "Profile Configuration:",
    "Tell us about your institution, the infrastructure you run, and your specific risk vectors.",
  ],
  [
    "Network Vetting",
    "We verify all participants before they join to maintain a closed, trusted intelligence network.",
  ],
  [
    "Targeted Intel",
    "When a localized threat surfaces in your sector, you are alerted immediately via email and dashboard.",
  ],
  [
    " Mitigate & Log",
    "Execute the provided countermeasure steps and document your team's response for compliance.",
  ],
];

const benefits = [
  [
    "The Early Warning Advantage",
    "Benefit from collective intelligence. When one node in the network is targeted, the rest are immunized instantly.",
  ],
  [
    "Eliminate Guesswork",
    " Pre-defined action steps prevent hesitation during critical response windows.",
  ],
  [
    "Zero Alert Fatigue",
    "Alerts are matched specifically to your sector. You only see threats relevant to your operations.",
  ],
  [
    "Role-Based Access Control",
    "Distribute intelligence appropriately. Give analysts, administrators, and executives only what their roles require.",
  ],
  [
    "Audit-Ready Logging",
    "Maintain a verifiable history of proactive threat mitigation to show auditors and regulators.",
  ],
  [
    "Continuous Enablement",
    "Leverage our extensive library to continuously train your team on recognizing and handling new fraud typologies.",
  ],
];

const Section = ({ id, title, intro, children, tint }) => (
  <section
    id={id}
    className={`border-t border-line ${tint ? "bg-surface" : ""}`}
  >
    <div className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 max-w-2xl text-fg/70">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

export default function Landing() {
  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="flex items-center gap-2 text-sm font-medium">
            <a
              href="#about"
              className="hidden px-3 py-2 hover:text-cyan lg:block"
            >
              About
            </a>
            <a
              href="#who"
              className="hidden px-3 py-2 hover:text-cyan lg:block"
            >
              Who it’s for
            </a>
            <a
              href="#how"
              className="hidden px-3 py-2 hover:text-cyan lg:block"
            >
              How it helps
            </a>
            <a
              href="#benefits"
              className="hidden px-3 py-2 hover:text-cyan lg:block"
            >
              Benefits
            </a>
            <Link to="/login" className="btn-ghost">
              Log in
            </Link>
            <Link to="/signup" className="btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: text + image */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-12 lg:grid-cols-[1.2fr_1fr] lg:pt-20">
          <div>
            <h1 className="text-[40px] font-bold leading-snug">
              Stay Ahead of The Threat CURVE. Get Real-Time Fraud Alerts with
              Actionable Steps
              <br />
              To Secure Your Institution.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg/75">
              AbiRadar acts as an early-warning threat intelligence network for
              businesses. We monitor local chatter, emerging scams, and attack
              vectors to warn vulnerable institutions immediately-providing
              exact countermeasures to protect your infrastructure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">
                Get started
              </Link>
              <a href="#about" className="btn-ghost">
                Learn more
              </a>
            </div>
            <p className="mt-4 text-sm text-fg/60">
              Deployment takes under five minutes. Vetted access ensures network
              Integrity.
            </p>
          </div>
          <div className="flex justify-center">
            <img
              src="/logo.jpg"
              alt="Abisentry shield with an orbiting ribbon"
              className="w-full max-w-md mix-blend-lighten drop-shadow-[0_0_60px_rgba(47,212,247,0.25)]"
            />
          </div>
        </section>

        {/* 1. About */}
        <Section
          id="about"
          tint
          title="What AbiRadar is"
          intro="A fraud alert service for institutions. Our team tracks new scams and attacks, tells the institutions at risk straight away, and gives them clear steps to protect their systems. Each institution records what it did."
        >
          <dl className="divide-y divide-line">
            {watches.map(([t, d]) => (
              <div
                key={t}
                className="grid gap-1 py-4 sm:grid-cols-[15rem_1fr] sm:gap-6"
              >
                <dt className="font-display text-lg font-bold">{t}</dt>
                <dd className="text-fg/70">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 2. Who it's for */}
        <Section
          id="who"
          title="Who it is for"
          intro="Built for institutions where trust, data, and capital are paramount. If a new threat is circulating, you need to know first."
        >
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {audience.map(([t, d]) => (
              <li key={t} className="border-l-2 border-cyan pl-4">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-fg/70">{d}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 3. How it helps */}
        <Section id="how" tint title="How it helps you">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <ol className="space-y-6">
              {steps.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-bg">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold leading-snug">
                      {t}
                    </h3>
                    <p className="mt-1 text-sm text-fg/70">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <LiveFeed />
          </div>
        </Section>

        {/* 4. Benefits */}
        <Section id="benefits" title="Why institutions choose it">
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {benefits.map(([t, d]) => (
              <div key={t}>
                <dt className="font-display text-lg font-bold">{t}</dt>
                <dd className="mt-1 text-fg/70">{d}</dd>
              </div>
            ))}
          </dl>
          <Link to="/signup" className="btn-primary mt-12">
            Get started
          </Link>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-fg/60">
          <Logo size="h-9" />
          <p>© {new Date().getFullYear()} AbiRadar</p>
        </div>
      </footer>
    </div>
  );
}
