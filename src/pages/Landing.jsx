import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import LiveFeed from '../components/LiveFeed.jsx'

const watches = [
  ['Alerts that reach the right people', 'We send each alert to the institutions a threat could affect, by sector or by name, not to everyone.'],
  ['Clear steps to take', 'Every alert says what is happening and what to do about it, in order.'],
  ['Email and dashboard', 'Owners, admins and analysts are emailed, and every alert waits in your dashboard.'],
  ['A record of what you did', 'Your team notes what it did about each alert. Auditors and regulators can see it.'],
  ['A fraud library and playbooks', 'Learn how each type of fraud works, with response guides to follow.'],
]

const audience = [
  ['Banks and microfinance', 'Fraudulent transfers and takeover of customer or staff accounts.'],
  ['Hospitals and clinics', 'Patient records read or exported by people with no reason to.'],
  ['Universities and schools', 'Altered grades, fees and admission records.'],
  ['Government agencies', 'Ghost workers, diverted funds and leaked citizen data.'],
  ['Insurance firms', 'Fake claims and tampered policy records.'],
  ['Fintechs and payment providers', 'Unusual transaction volumes and API abuse.'],
  ['NGOs and cooperatives', 'Misused donor funds and altered member balances.'],
  ['Retail and logistics', 'Fake vendors, stock diversion and invoice fraud.'],
]

const steps = [
  ['Create your account', 'Tell us about your institution, what you run and what worries you.'],
  ['We check and approve you', 'Every institution is reviewed before it joins, so alerts stay trusted.'],
  ['You get alerts that matter', 'When a threat could affect you, you are emailed and it appears in your dashboard.'],
  ['You act and record it', 'Follow the steps, then note what your team did.'],
]

const benefits = [
  ['Hear about threats first', 'When one institution is attacked, the rest of the network is warned straight away.'],
  ['Know exactly what to do', 'Each alert comes with steps, so your team is not guessing under pressure.'],
  ['Only what concerns you', 'Alerts are matched to your sector, so you are not flooded.'],
  ['The right people, the right access', 'Give analysts, admins and viewers only what their role needs.'],
  ['A record you can show', 'Every response is logged for auditors and regulators.'],
  ['Learn as you go', 'A fraud library and playbooks help your team recognise and handle each type of fraud.'],
]

const Section = ({ id, title, intro, children, tint }) => (
  <section id={id} className={`border-t border-line ${tint ? 'bg-surface' : ''}`}>
    <div className="mx-auto max-w-6xl px-5 py-20">
      <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 max-w-2xl text-fg/70">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  </section>
)

export default function Landing() {
  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="flex items-center gap-2 text-sm font-medium">
            <a href="#about" className="hidden px-3 py-2 hover:text-cyan lg:block">About</a>
            <a href="#who" className="hidden px-3 py-2 hover:text-cyan lg:block">Who it’s for</a>
            <a href="#how" className="hidden px-3 py-2 hover:text-cyan lg:block">How it helps</a>
            <a href="#benefits" className="hidden px-3 py-2 hover:text-cyan lg:block">Benefits</a>
            <Link to="/login" className="btn-ghost">Log in</Link>
            <Link to="/signup" className="btn-primary">Get started</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: text + image */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-12 lg:grid-cols-[1.2fr_1fr] lg:pt-20">
          <div>
            <h1 className="text-hero font-bold">When a new fraud threat appears, you hear about it first, with clear steps to stop it.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg/75">
              AbiSentry Gossip is a fraud alert network for institutions. When we see a new scam or attack, we warn every institution it could affect and tell them exactly what to do to protect their systems.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">Get started</Link>
              <a href="#about" className="btn-ghost">Learn more</a>
            </div>
            <p className="mt-4 text-sm text-fg/60">Setup takes about five minutes. Every institution is reviewed before it joins.</p>
          </div>
          <div className="flex justify-center">
            <img src="/logo.jpg" alt="AbiSentry shield with an orbiting ribbon" className="w-full max-w-md mix-blend-lighten drop-shadow-[0_0_60px_rgba(47,212,247,0.25)]" />
          </div>
        </section>

        {/* 1. About */}
        <Section id="about" tint title="What AbiSentry Gossip is"
          intro="A fraud alert service for institutions. Our team tracks new scams and attacks, tells the institutions at risk straight away, and gives them clear steps to protect their systems. Each institution records what it did.">
          <dl className="divide-y divide-line">
            {watches.map(([t, d]) => (
              <div key={t} className="grid gap-1 py-4 sm:grid-cols-[15rem_1fr] sm:gap-6">
                <dt className="font-display text-lg font-bold">{t}</dt>
                <dd className="text-fg/70">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 2. Who it's for */}
        <Section id="who" title="Who it is for" intro="Any institution that holds money, data or public trust, and needs to hear quickly when a new threat is going around.">
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-display text-sm font-bold text-bg">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-lg font-bold leading-snug">{t}</h3>
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
          <Link to="/signup" className="btn-primary mt-12">Get started</Link>
        </Section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-fg/60">
          <Logo size="h-9" />
          <p>© {new Date().getFullYear()} AbiSentry Gossip</p>
        </div>
      </footer>
    </div>
  )
}
