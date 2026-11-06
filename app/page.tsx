import ExamScene from "./components/ExamScene";
import Booking from "./components/Booking";
import Motion from "./components/Motion";
import ParticleScene from "./components/ParticleScene";
import { clinic, concerns } from "./content";

function Mask({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span className="word" key={i}><span>{w}</span></span>
      ))}
    </>
  );
}

const about = "Good skin care starts with an accurate diagnosis, not a longer routine. I take time to find out what is really going on, explain it plainly, and recommend only what your skin needs.";

export default function Home() {
  return (
    <>
      <div className="loader" aria-hidden="true"><span className="loader-num">0</span></div>
      <noscript><style>{`.loader{display:none}`}</style></noscript>
      <div className="progress" aria-hidden="true" />
      <ParticleScene />
      <Motion />

      <header className="top">
        <a href="#top" className="logo">{clinic.doctor}</a>
        <nav aria-label="Main">
          <a href="#treatments">Treatments</a>
          <a href="#about">About</a>
          <a href="#book" className="pill">Book</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" data-scene="0,0.62,1,0.85">
          <div className="hero-inner">
            <p className="eyebrow fade-in">{clinic.role}</p>
            <h1><Mask text="Skin care that goes" /> <em><Mask text="deeper." /></em></h1>
            <p className="lede fade-in">Clear answers for acne, pigmentation, hair and everything in between, from a doctor who treats the cause.</p>
            <div className="fade-in"><a href="#book" className="btn" data-magnetic>Book a consultation</a></div>
          </div>
          <span className="scroll-hint fade-in">Scroll to meet your doctor ↓</span>
        </section>

        <section className="exam" data-scene="4,0,0,1" aria-label="How a skin check works">
          <ExamScene />
          <div className="exam-cap left" data-from="0.015" data-to="0.16">
            <p className="eyebrow">Your skin check</p>
            <h2>Take a seat. Your doctor is coming.</h2>
          </div>
          <div className="exam-cap view" data-from="0.2" data-to="0.3"><h2>Searching: active acne</h2><p>Up close, each spot tells a story.</p></div>
          <div className="exam-cap view" data-from="0.35" data-to="0.45"><h2>Checking: a mole</h2><p>Shape, border and colour, all looked at.</p></div>
          <div className="exam-cap view" data-from="0.5" data-to="0.6"><h2>Finding: pigmentation</h2><p>The pattern helps show the cause.</p></div>
          <div className="exam-cap left" data-from="0.63" data-to="0.75"><h2>Then, a plan for calmer skin.</h2></div>
          <div className="exam-cap nailed" data-from="0.875" data-to="2">
            <div className="bubble"><h2>You nailed it!</h2><p>Sunscreen daily, hands off the spots. Keep it up.</p></div>
            <a href="#book" className="btn">Get your own skin check</a>
          </div>
          <p className="exam-note">Computer-generated illustration, not a diagnosis.</p>
        </section>

        <section id="treatments" className="treatments" data-scene="4,0,0,1">
          <div className="t-grid">
            <div className="t-intro">
              <p className="eyebrow">Treatments</p>
              <h2 className="mask-title"><Mask text="What we can help with" /></h2>
            </div>
            {concerns.map((c, i) => (
              <article className="t-card" key={c.title}>
                <div className="t-inner">
                  <span className="t-num">0{i + 1}</span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="about" data-scene="2,-0.76,0.4,0.85">
          <div className="about-text">
            <p className="eyebrow">{clinic.doctor}</p>
            <p className="scrub">{about.split(" ").map((w, i) => <span key={i}>{w} </span>)}</p>
          </div>
        </section>

        <section id="book" className="book" data-scene="0,-0.5,0.16,0.9">
          <div className="book-copy">
            <p className="eyebrow">Online booking</p>
            <h2 className="mask-title"><Mask text="Your skin, your slot." /></h2>
            <p className="reveal">Three quick steps and under a minute. For severe reactions, facial swelling or trouble breathing, seek emergency care instead.</p>
          </div>
          <div id="booking-widget"><Booking /></div>
        </section>
      </main>

      <footer className="foot">
        <a href="#book" className="foot-big">Book now</a>
        <div className="foot-row">
          <div><b>{clinic.name}</b><br />{clinic.address}</div>
          <div>{clinic.hours}</div>
          <div><a href={`tel:${clinic.phone.replace(/\s/g, "")}`}>{clinic.phone}</a><br /><a href={`mailto:${clinic.email}`}>{clinic.email}</a></div>
        </div>
      </footer>
    </>
  );
}
