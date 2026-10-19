'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ==========================================================================
 * LANDING PAGE
 *
 * One light theme, the same as the film: warm paper, dark ink, one orange.
 * The page follows the film's story: the two numbers that do not match, the
 * drilling company's side, the client's side, the four logins, and what
 * XPLORIX works out ahead of time. Every product picture is a real screen of
 * the demo, on demo data.
 * ========================================================================== */

function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon points="50,50 5,5 5,95" fill="#0F141C" /><polygon points="50,50 5,5 30,5" fill="#232B38" /><polygon points="50,50 5,95 30,95" fill="#232B38" />
      <polygon points="50,50 95,5 95,95" fill="#F97316" /><polygon points="50,50 95,5 70,5" fill="#EA580C" /><polygon points="50,50 95,95 70,95" fill="#EA580C" />
    </svg>
  )
}

/* True once the element has been scrolled into view. */
function useSeen<T extends HTMLElement>(threshold = 0.5) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

/* The same month, counted twice: the contractor's number is typed, then the
 * client's. It plays once, when the reader reaches it. */
function TwoNumbers() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.45)
  const A = '1,240 m', B = '1,180 m'
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!seen) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setA(A.length); setB(B.length); setDone(true); return }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= A.length; i++) timers.push(setTimeout(() => setA(i), 250 + i * 85))
    for (let i = 1; i <= B.length; i++) timers.push(setTimeout(() => setB(i), 1450 + i * 85))
    timers.push(setTimeout(() => setDone(true), 2450))
    return () => timers.forEach(clearTimeout)
  }, [seen])
  const typing = seen && !done
  return (
    <div ref={ref} className="lp-two">
      <div>
        <div className="lp-two-who">The contractor&rsquo;s shift log says</div>
        <div className="lp-num" aria-label={A}>{A.slice(0, a) || ' '}{typing && a < A.length && <i className="lp-caret" />}</div>
      </div>
      <div className={'lp-neq' + (done ? ' on' : '')} aria-hidden>&ne;</div>
      <div>
        <div className="lp-two-who">The client&rsquo;s site report says</div>
        <div className="lp-num" aria-label={B}>{B.slice(0, b) || ' '}{typing && a >= A.length && <i className="lp-caret" />}</div>
      </div>
      <p className={'lp-two-end' + (done ? ' on' : '')}>Same holes. Sixty metres apart. Then the invoice arrives.</p>
    </div>
  )
}

const SHARED = ['Contract rates', 'Planned and closed holes', 'The shift record', 'Invoices', 'Payments']
const LOGINS = [
  { t: 'Company Admin', d: 'Runs the account: projects, rates, finance, stock, analysis, and every other login.' },
  { t: 'Supervisor', d: 'Writes the drill log and the maintenance log for the rig. Nothing else.' },
  { t: 'Contractor', d: 'A contractor you hire writes his own drill log and sends it to you to check.' },
  { t: 'Client', d: 'Sees what happened today, approves finished holes and checks each invoice.' },
]
const QUOTES = [
  { q: 'The downtime chart alone changed our Monday review meetings. We could see exactly which rigs had the most idle time and why.', n: 'Vikram Sharma', r: 'HOD Operations, Kartikay Exploration & Mining Services, India' },
  { q: 'First week in and already this is showing us things our spreadsheets never could. The dashboard is clean, the data makes sense and the team picked it up fast.', n: 'Mohammed Ali Reyaz', r: 'General Manager, KANZ AL-MAADEN Contracting Company, Saudi Arabia' },
  { q: 'My team was logging live on the platform within two days. I have never seen field supervisors adopt a new system that quickly.', n: 'Piyush Mrig', r: 'Director, Kartikay Exploration & Mining Services, India' },
]
const FAQS = [
  { q: 'Who is XPLORIX for?', a: 'Companies that drill: exploration drilling contractors, and exploration agencies that run their own rigs and also hire contractors. Their supervisors, their contractors and their clients each get a login made for them.' },
  { q: 'What does the supervisor have to enter?', a: 'One drill log per shift: the hole, the metres drilled, the core recovered, the hours, any downtime and the parts used. Cost per metre, hole status, billing and stock are worked out from that log.' },
  { q: 'We hire contractors as well as running our own rigs. Does it handle that?', a: 'Yes. Each contractor gets a login and writes his own drill log and maintenance log. Your site staff check each shift before it counts. Your own rigs and each contractor are then compared on the same measures.' },
  { q: 'What can the client see?', a: 'Only the projects you choose to show him: the contract rates, the holes, the shift record, the invoices and the payments. He does not see your costs, margin, stock, suppliers or what you pay a contractor.' },
  { q: 'What do XPLORIX insights do?', a: 'On every dashboard they point out what is unusual, forecast what comes next and suggest an action, worked out by rules from your own shift logs, planned holes, stock and bills. XPLORIX Intelligence gathers them into one list of what to do, with who should do it and the money at stake. Every drill log is checked as it is typed, so the figures underneath can be trusted.' },
  { q: 'How does pricing work?', a: 'Ask us for the current plans when you see the demo.' },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const filmRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24)
    h(); window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  const playFilm = (e: React.MouseEvent) => {
    e.preventDefault()
    const v = filmRef.current
    document.getElementById('film')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    v?.play().catch(() => { /* the visitor can press play */ })
  }

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className={'lp-nav' + (scrolled ? ' scrolled' : '')}>
        <a href="#top" className="lp-brand"><Logo /><span>XPLORIX</span></a>
        <nav className="lp-links" aria-label="Sections">
          <a href="#contractors">For drilling companies</a>
          <a href="#owners">For clients</a>
          <a href="#connect">Logins</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#trial">Field trial</a>
        </nav>
        <div className="lp-nav-cta">
          <Link href="/auth/login" className="lp-btn quiet">Sign in</Link>
          <Link href="/auth/register" className="lp-btn primary">Start a free trial</Link>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-wrap lp-center">
            <span className="lp-pill">Drilling Intelligence Platform</span>
            <h1>One platform.<br /><span className="lp-or">Both sides of the contract.</span></h1>
            <p className="lp-lead">
              XPLORIX keeps one record of the drilling. Each shift is logged once.
              The client checks every metre and every invoice against it.
            </p>
            <div className="lp-actions">
              <Link href="/auth/login" className="lp-btn primary big">Open the live demo</Link>
              <a href="#film" onClick={playFilm} className="lp-btn ghost big"><span className="lp-play" aria-hidden />Watch the 2-minute film</a>
            </div>
          </div>
          <div className="lp-wrap">
            <div className="lp-window lp-rise">
              <video src="/landing/xplorix-reel.mp4" poster="/landing/reel-poster.jpg" autoPlay muted loop playsInline preload="metadata"
                aria-label="A short silent reel of XPLORIX screens: the shift log, the dashboard, the billing check, XPLORIX insights and next month's forecast" />
            </div>
            <p className="lp-caption">Real screens from the XPLORIX demo, on demo data.</p>
          </div>
        </section>

        {/* THE PROBLEM */}
        <section className="lp-band">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-narrow">Every metre drilled is counted twice.</h2>
            <TwoNumbers />
            <p className="lp-body lp-narrow">
              The driller keeps a paper log, a spreadsheet and photos on a phone. The client keeps his own site report.
              Nobody can say which number is right, so the argument starts when the bill does. XPLORIX replaces both with one
              shift record that each side can open.
            </p>
          </div>
        </section>

        {/* FILM */}
        <section className="lp-sec" id="film">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2 className="lp-h2">The whole story in two minutes.</h2>
              <p className="lp-body">From the supervisor&rsquo;s shift log to the client&rsquo;s approval, with voice-over.</p>
            </div>
            <div className="lp-window">
              <video ref={filmRef} src="/landing/xplorix-film.mp4" poster="/landing/film-poster.jpg" controls playsInline preload="none"
                aria-label="The XPLORIX film, two minutes, with voice-over" />
            </div>
          </div>
        </section>

        {/* CONTRACTOR */}
        <section className="lp-sec" id="contractors">
          <div className="lp-wrap lp-duo">
            <div>
              <span className="lp-tag or">For the drilling company</span>
              <h2 className="lp-h2">Get paid without the argument.</h2>
              <ul className="lp-list">
                <li><b>One shift log.</b> The supervisor enters the hole, the metres and the core once.</li>
                <li><b>Cost, revenue and margin for every hole,</b> worked out from that log. Nobody types these numbers.</li>
                <li><b>Invoices built from approved holes</b> at the rates the client agreed.</li>
                <li><b>Parts and stock tracked,</b> so the order goes out before the rig stops.</li>
                <li><b>Your own rigs and hired contractors on the same measures.</b> A contractor logs his own shifts; you check them before they count.</li>
              </ul>
            </div>
            <figure className="lp-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/contractor-dashboard.jpg" width={1800} height={1290} loading="lazy" alt="The company dashboard: what needs attention today, and this month's metres, billable value, cost per metre and margin" />
            </figure>
          </div>
        </section>

        {/* CLIENT */}
        <section className="lp-sec" id="owners">
          <div className="lp-wrap lp-duo flip">
            <div>
              <span className="lp-tag ink">For the client</span>
              <h2 className="lp-h2">Know before you pay.</h2>
              <ul className="lp-list">
                <li><b>What happened on site today,</b> as each shift is logged: metres, stops, incidents, holes finished.</li>
                <li><b>Finished holes approved for billing</b> with the metres, core recovery and shifts in front of you.</li>
                <li><b>Every invoice line checked</b> against the shift record. Anything extra is found before payment.</li>
                <li><b>Every project, rig and hole in detail,</b> from the same shift logs the drilling company uses.</li>
              </ul>
            </div>
            <figure className="lp-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/client-invoice-check.jpg" width={1800} height={1125} loading="lazy" alt="The client's invoice check: each line of an invoice with the metres claimed beside the metres in the shift record" />
            </figure>
          </div>
        </section>

        {/* LOGINS */}
        <section className="lp-band" id="connect">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2 className="lp-h2">One account. Four logins.</h2>
              <p className="lp-body">The Company Admin creates every login from one screen. Each person opens only what is theirs, and only the project you show the client is visible to him.</p>
            </div>
            <div className="lp-link">
              <div className="lp-id">
                <span className="lp-tag or">Your company</span>
                <div className="lp-id-code">Admin</div>
                <div className="lp-private">Stays private<b>Costs, margin, stock, suppliers, bids, what you pay a contractor</b></div>
              </div>
              <ul className="lp-shared" aria-label="What the client can see">
                {SHARED.map(s => <li key={s}>{s}</li>)}
              </ul>
              <div className="lp-id">
                <span className="lp-tag ink">Your client</span>
                <div className="lp-id-code">Client</div>
                <div className="lp-private">Sees only<b>The projects you choose to show</b></div>
              </div>
            </div>
            <ol className="lp-steps four">
              {LOGINS.map((s, i) => <li key={s.t}><span className="lp-step-n">{i + 1}</span><b>{s.t}</b><span>{s.d}</span></li>)}
            </ol>
            <p className="lp-note">Try it in the demo: <Link href="/admin/users">create a login as the Company Admin</Link>, then open the <Link href="/client">client login</Link> or the <Link href="/contractor">contractor login</Link>.</p>
          </div>
        </section>

        {/* INTELLIGENCE */}
        <section className="lp-sec" id="intelligence">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="lp-tag line">XPLORIX Intelligence</span>
              <h2 className="lp-h2">It also looks ahead.</h2>
              <p className="lp-body">Recording the work is only the start. XPLORIX reads the same shift logs and planned holes and tells you what is coming.</p>
            </div>
            <div className="lp-intel">
              <figure className="lp-shot wide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/next-month.jpg" width={1800} height={936} loading="lazy" alt="Next month's forecast: metres, billing, cost, margin, parts to order and idle rig-days, with a rig plan to the end of the month" />
                <figcaption><b>Next month, known today.</b> Metres, billing, cost and parts to order, worked out from your planned holes. It shows the day the planned holes run out.</figcaption>
              </figure>
              <figure className="lp-shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/ai-insights.jpg" width={1760} height={1040} loading="lazy" alt="The XPLORIX insights panel on the operation dashboard, with one insight opened to show what to do" />
                <figcaption><b>XPLORIX insights on every dashboard.</b> What is unusual, what is forecast, and what to do about it.</figcaption>
              </figure>
              <figure className="lp-shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/risk-register.jpg" width={1800} height={1064} loading="lazy" alt="The risk register: each risk with a date, the money at stake, the chance and what to do" />
                <figcaption><b>Every risk with a date, a value and an action.</b> Ranked by chance and size, so you know where to start.</figcaption>
              </figure>
            </div>
            <p className="lp-note">Shown on demo data. Worked out from your own records; prediction that learns from ground and core is in development.</p>
          </div>
        </section>

        {/* FIELD TRIAL */}
        <section className="lp-band" id="trial">
          <div className="lp-wrap">
            <div className="lp-trial">
              <div>
                <h2 className="lp-h2">Thirty days on real rigs, in two countries.</h2>
                <p className="lp-body">
                  Before launch we ran a live trial with two drilling contractors: Kartikay Exploration &amp; Mining Services in India and
                  KANZ AL-MAADEN Contracting Company in Saudi Arabia. Supervisors logged real shifts from the first day, and managers
                  read the dashboards the same evening.
                </p>
                <a className="lp-btn ghost" href="/blog/30-days-trial.html" target="_blank" rel="noopener noreferrer">Read the field report</a>
              </div>
              <dl className="lp-stats">
                <div><dt>2</dt><dd>countries: India and Saudi Arabia</dd></div>
                <div><dt>28</dt><dd>days live, May to June 2026</dd></div>
                <div><dt>48 h</dt><dd>from account creation to the first live log</dd></div>
              </dl>
            </div>
            <div className="lp-quotes">
              {QUOTES.map(t => (
                <figure key={t.n}>
                  <blockquote>&ldquo;{t.q}&rdquo;</blockquote>
                  <figcaption><b>{t.n}</b>{t.r}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* QUESTIONS */}
        <section className="lp-sec" id="questions">
          <div className="lp-wrap lp-faq">
            <h2 className="lp-h2">Questions people ask first</h2>
            <div>
              {FAQS.map(f => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CLOSE */}
        <section className="lp-close" id="demo">
          <div className="lp-wrap lp-center">
            <h2>See both sides for yourself.</h2>
            <p className="lp-lead">Open the demo and walk through both sides: log a shift as the supervisor, then approve the hole as the client.</p>
            <div className="lp-actions">
              <Link href="/auth/login" className="lp-btn primary big">Open the live demo</Link>
              <Link href="/auth/register" className="lp-btn ghost big">Start a free trial</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <div className="lp-foot-top">
            <a href="#top" className="lp-brand"><Logo size={30} /><span>XPLORIX</span></a>
            <p>The drilling intelligence platform for exploration drilling companies and their clients.</p>
          </div>
          <div className="lp-foot-bottom">
            <span>&copy; 2026 XPLORIX. ANMAK CONSULTANCY SERVICES PRIVATE LIMITED</span>
            <nav aria-label="Legal">
              <Link href="/privacy-policy">Privacy policy</Link>
              <Link href="/terms-of-service">Terms of service</Link>
              <Link href="/refund-policy">Refund policy</Link>
              <Link href="/cookie-policy">Cookie policy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
html{scroll-behavior:smooth}
.lp{--paper:#F6EDE5;--paper2:#FBF6F1;--ink:#0B0F17;--mut:#56606E;--or:#F97316;--or2:#EA580C;--or3:#C2410C;--line:rgba(11,15,23,.1);--card:#fff;
  position:relative;z-index:20;min-height:100vh;background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,sans-serif;font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
.lp *{box-sizing:border-box}
:where(.lp) :where(h1,h2,p,ul,ol,dl,dd,figure,blockquote){margin:0;padding:0}
:where(.lp) :where(ul,ol){list-style:none}
:where(.lp) :where(a){color:inherit}
.lp h1,.lp h2{color:var(--ink)}
.lp :focus-visible{outline:3px solid var(--or);outline-offset:3px;border-radius:6px}
.lp-wrap{width:100%;max-width:1240px;margin:0 auto;padding:0 32px}
.lp-center{text-align:center}
.lp-or{color:var(--or2)}

/* nav */
.lp-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:28px;padding:14px 32px;transition:background .2s,box-shadow .2s}
.lp-nav.scrolled{background:rgba(246,237,229,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--line)}
.lp-brand{display:flex;align-items:center;gap:11px;text-decoration:none;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;letter-spacing:.09em}
.lp-links{display:flex;gap:26px;margin:0 auto;font-size:15px;font-weight:500}
.lp-links a{text-decoration:none;color:var(--mut);padding:6px 0}
.lp-links a:hover{color:var(--ink)}
.lp-nav-cta{display:flex;gap:10px;margin-left:auto}
.lp-links + .lp-nav-cta{margin-left:0}

/* buttons */
.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:10px 18px;border-radius:999px;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:15px;text-decoration:none;white-space:nowrap;border:1.5px solid transparent;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s}
.lp-btn.big{padding:15px 28px;font-size:17px}
.lp-btn.primary{background:var(--or);color:var(--ink);box-shadow:0 10px 26px rgba(234,88,12,.28)}
.lp-btn.primary:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(234,88,12,.36)}
.lp-btn.ghost{background:rgba(255,255,255,.7);border-color:rgba(11,15,23,.16);color:var(--ink)}
.lp-btn.ghost:hover{background:#fff}
.lp-btn.quiet{color:var(--ink)}
.lp-btn.quiet:hover{background:rgba(11,15,23,.06)}
.lp-play{width:0;height:0;border-left:11px solid var(--or2);border-top:7px solid transparent;border-bottom:7px solid transparent}

/* hero */
.lp-hero{position:relative;padding:56px 0 84px;overflow:hidden;margin-top:-66px;padding-top:122px;
  background:radial-gradient(1100px 760px at 104% 100%,#FDB877 0%,rgba(253,184,119,0) 62%),radial-gradient(900px 640px at -6% -4%,#FFD3AE 0%,rgba(255,211,174,0) 60%),radial-gradient(900px 600px at 50% 34%,#fff 0%,rgba(255,255,255,0) 72%),var(--paper)}
.lp-pill{display:inline-block;padding:9px 18px 8px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--or);color:var(--or3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.lp h1{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:clamp(40px,6.6vw,92px);line-height:1.02;letter-spacing:-.03em;margin-top:26px}
.lp-lead{max-width:680px;margin:26px auto 0;font-size:clamp(17px,1.5vw,21px);line-height:1.55;color:var(--mut)}
.lp-actions{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.lp-window{position:relative;border-radius:22px;overflow:hidden;background:#F3F5F8;box-shadow:0 50px 120px rgba(122,60,8,.26),0 0 0 1px rgba(15,23,42,.08);margin-top:60px;aspect-ratio:16/9}
.lp-window video{display:block;width:100%;height:100%;object-fit:cover;background:#F6EDE5}
.lp-rise{animation:lpRise 1s cubic-bezier(.16,1,.3,1) .15s both}
@keyframes lpRise{from{opacity:0;transform:translateY(70px) scale(.97)}to{opacity:1;transform:none}}
.lp-caption{margin-top:16px;text-align:center;font-size:14px;color:var(--mut)}

/* sections */
.lp-sec{padding:104px 0}
.lp-band{padding:104px 0;background:var(--paper2);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.lp-h2{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:clamp(30px,3.6vw,52px);line-height:1.08;letter-spacing:-.025em}
.lp-body{color:var(--mut);max-width:66ch}
.lp-narrow{max-width:820px}
.lp-head{max-width:760px;margin-bottom:44px}
.lp-head .lp-h2{margin-bottom:16px}
.lp-head .lp-tag{margin-bottom:18px}
.lp-sec .lp-window{margin-top:0}
.lp-tag{display:inline-block;padding:7px 14px;border-radius:999px;font-size:14px;font-weight:600;font-family:'Space Grotesk',sans-serif}
.lp-tag.or{background:var(--or);color:var(--ink)}
.lp-tag.ink{background:var(--ink);color:#fff}
.lp-tag.line{box-shadow:inset 0 0 0 1.5px var(--or);color:var(--or3);background:#fff}
.lp-note{margin-top:28px;font-size:14.5px;color:var(--mut)}
.lp-note a{color:var(--or3);font-weight:600}

/* the two numbers */
.lp-two{display:grid;grid-template-columns:1fr auto 1fr;gap:20px 40px;align-items:end;margin:48px 0 44px}
.lp-two-who{font-size:16px;font-weight:500;color:var(--mut);margin-bottom:6px}
.lp-num{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:clamp(52px,10.5vw,148px);line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap}
.lp-two > div:first-child .lp-num{color:var(--or2)}
.lp-caret{display:inline-block;width:.06em;height:.82em;background:currentColor;margin-left:.05em;vertical-align:-.04em;animation:lpBlink .9s steps(1) infinite}
@keyframes lpBlink{50%{opacity:0}}
.lp-neq{font-family:'Space Grotesk',sans-serif;font-size:clamp(40px,7vw,104px);line-height:1.05;color:var(--mut);opacity:0;transition:opacity .5s}
.lp-two-end{grid-column:1/-1;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:clamp(20px,2.2vw,30px);letter-spacing:-.01em;opacity:0;transform:translateY(8px);transition:opacity .6s,transform .6s}
.lp-neq.on,.lp-two-end.on{opacity:1;transform:none}

/* product rows */
.lp-duo{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:64px;align-items:center}
.lp-duo.flip{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
.lp-duo.flip > div{order:2}
.lp-duo .lp-h2{margin:18px 0 26px}
.lp-list li{position:relative;padding:14px 0 14px 30px;border-top:1px solid var(--line);color:var(--mut)}
.lp-list li:last-child{border-bottom:1px solid var(--line)}
.lp-list li::before{content:'';position:absolute;left:2px;top:24px;width:10px;height:10px;border-radius:50%;background:var(--or)}
.lp-list b{color:var(--ink);font-weight:600}
.lp-shot{border-radius:18px;overflow:hidden;background:var(--card);box-shadow:0 36px 90px rgba(122,60,8,.2),0 0 0 1px rgba(15,23,42,.08)}
.lp-shot img{display:block;width:100%;height:auto}
.lp-shot figcaption{padding:18px 22px 20px;font-size:15.5px;color:var(--mut);border-top:1px solid var(--line)}
.lp-shot figcaption b{display:block;color:var(--ink);font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:600;margin-bottom:4px}

/* connect */
.lp-link{display:grid;grid-template-columns:1fr auto 1fr;gap:28px;align-items:stretch}
.lp-id{background:var(--card);border-radius:20px;padding:26px 28px;box-shadow:0 0 0 1px var(--line),0 24px 60px rgba(122,60,8,.1);display:flex;flex-direction:column;gap:14px;align-items:flex-start}
.lp-id-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:clamp(30px,3.6vw,48px);letter-spacing:.03em;line-height:1.1}
.lp-private{margin-top:auto;padding-top:16px;border-top:1px dashed rgba(11,15,23,.18);width:100%;font-size:14px;color:var(--mut)}
.lp-private b{display:block;color:var(--ink);font-weight:600;font-size:16px;margin-top:2px}
.lp-shared{display:flex;flex-direction:column;justify-content:center;gap:10px;min-width:250px}
.lp-shared li{position:relative;padding:11px 20px;border-radius:999px;background:var(--or);color:var(--ink);font-weight:600;font-size:15.5px;text-align:center;box-shadow:0 10px 24px rgba(234,88,12,.22)}
.lp-shared li::before,.lp-shared li::after{content:'';position:absolute;top:50%;width:22px;height:2px;background:var(--ink)}
.lp-shared li::before{right:100%;margin-right:3px}
.lp-shared li::after{left:100%;margin-left:3px}
.lp-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px;margin-top:52px;counter-reset:s}
.lp-steps.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.lp-steps li{display:flex;flex-direction:column;gap:6px;padding-top:18px;border-top:2px solid var(--ink);font-size:15px;color:var(--mut)}
.lp-steps b{color:var(--ink);font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600;line-height:1.25}
.lp-step-n{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--or3)}

/* intelligence */
.lp-intel{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}
.lp-intel .wide{grid-column:1/-1}
.lp-intel .lp-shot{display:flex;flex-direction:column}
.lp-intel .lp-shot figcaption{margin-top:auto}

/* trial */
.lp-trial{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:64px;align-items:start}
.lp-trial .lp-h2{margin-bottom:18px}
.lp-trial .lp-btn{margin-top:26px}
.lp-stats div{display:grid;grid-template-columns:128px 1fr;align-items:baseline;gap:18px;padding:16px 0;border-top:1px solid var(--line)}
.lp-stats div:last-child{border-bottom:1px solid var(--line)}
.lp-stats dt{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:44px;line-height:1;letter-spacing:-.02em}
.lp-stats dd{color:var(--mut);font-size:15.5px}
.lp-quotes{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:40px;margin-top:64px}
.lp-quotes blockquote{font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:20px;line-height:1.4;letter-spacing:-.005em}
.lp-quotes figure:first-child blockquote{font-size:25px}
.lp-quotes figcaption{margin-top:16px;font-size:14px;color:var(--mut)}
.lp-quotes figcaption b{display:block;color:var(--ink);font-size:15px}

/* questions */
.lp-faq{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:64px}
.lp-faq details{border-top:1px solid var(--line)}
.lp-faq details:last-child{border-bottom:1px solid var(--line)}
.lp-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:20px;padding:20px 0;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:20px}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary::after{content:'+';font-weight:500;font-size:26px;line-height:1;color:var(--or3);transition:transform .2s}
.lp-faq details[open] summary::after{transform:rotate(45deg)}
.lp-faq details p{padding:0 40px 22px 0;color:var(--mut);max-width:70ch}

/* close and footer */
.lp-close{padding:120px 0;background:radial-gradient(1000px 620px at 50% 120%,#FDB877 0%,rgba(253,184,119,0) 66%),var(--paper)}
.lp-close h2{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:clamp(36px,5.4vw,76px);line-height:1.04;letter-spacing:-.03em}
.lp-foot{background:var(--paper2);border-top:1px solid var(--line);color:var(--mut);padding:44px 0 32px;font-size:14.5px}
.lp-foot .lp-brand{color:var(--ink)}
.lp-foot-top{display:flex;gap:32px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-bottom:26px;border-bottom:1px solid var(--line)}
.lp-foot-top p{max-width:46ch}
.lp-foot-bottom{display:flex;gap:20px 32px;justify-content:space-between;flex-wrap:wrap;padding-top:24px;font-size:13.5px}
.lp-foot-bottom nav{display:flex;gap:22px;flex-wrap:wrap}
.lp-foot a{text-decoration:none}
.lp-foot a:hover{color:var(--ink);text-decoration:underline}

@media (max-width:1080px){
  .lp-links{display:none}
  .lp-nav-cta{margin-left:auto}
  .lp-steps,.lp-steps.four{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lp-quotes{grid-template-columns:1fr;gap:34px}
}
@media (max-width:860px){
  .lp{font-size:16px}
  .lp-wrap{padding:0 20px}
  .lp-nav{padding:12px 20px;gap:12px}
  .lp-nav .quiet{display:none}
  .lp-hero{padding-bottom:60px}
  .lp-window{border-radius:14px;margin-top:40px}
  .lp-sec,.lp-band{padding:68px 0}
  .lp-close{padding:84px 0}
  .lp-duo,.lp-duo.flip,.lp-trial,.lp-faq,.lp-intel{grid-template-columns:1fr;gap:34px}
  .lp-duo.flip > div{order:0}
  .lp-two{grid-template-columns:1fr;gap:18px;margin:34px 0}
  .lp-neq{display:none}
  .lp-link{grid-template-columns:1fr;gap:18px}
  .lp-shared{min-width:0}
  .lp-shared li::before,.lp-shared li::after{display:none}
  .lp-steps,.lp-steps.four{grid-template-columns:1fr;margin-top:38px}
  .lp-stats div{grid-template-columns:96px 1fr}
  .lp-stats dt{font-size:36px}
  .lp-faq summary{font-size:18px}
  .lp-btn.big{padding:14px 22px;font-size:16px}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .lp-rise,.lp-caret{animation:none}
  .lp-neq,.lp-two-end,.lp-btn{transition:none}
}
`
