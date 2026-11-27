import BrandLogo from "@/components/brand/bandwhip-logo";
import Link from "next/link";
import LiveGarages from "@/components/home/live-garages";
import HomeAuthActions from "@/components/home/home-auth-actions";

export default function GaragesPage() {
  return (
    <main className="bw-page min-h-screen bg-white text-[#101828]">
        <header className="bw-header">
          <div className="bw-shell bw-nav-inner">
            <BrandLogo href="/" />
            <nav className="bw-desktop-nav" aria-label="Main navigation">
              <a href="/garages#garage-results">Find a garage</a>
              <a href="/#services">Services</a>
              <a href="/#journey">How it works</a>
              <a href="/#garages">For businesses</a>
            </nav>
            <div className="bw-nav-actions"><HomeAuthActions /></div>
            <details className="bw-mobile-nav">
              <summary aria-label="Open navigation menu"><span /><span /><span /></summary>
              <nav aria-label="Mobile navigation">
                <a href="/garages#garage-results">Find garages & towing</a>
                <a href="/#services">Services</a>
                <a href="/#journey">How it works</a>
                <a href="/#garages">For garages</a>
                <Link href="/login">Log in</Link>
                <Link href="/signup">Create an account</Link>
              </nav>
            </details>
          </div>
        </header>


        {/* GARAGES */}

        <section id="garage-results" data-bw-reveal className="bw-listings mx-auto max-w-[1350px] scroll-mt-28 px-8 py-24">
          <div className="mb-12 text-center">
            <p className="text-[17px] font-bold text-[#FF5B13]">
              Available near you
            </p>

            <h2 className="mx-auto mt-3 max-w-[950px] text-[46px] font-bold tracking-[-0.04em] sm:text-[56px]">
              Garages and towing ready to help.
            </h2>
          </div>

          <LiveGarages />
        </section>


        <footer className="bw-footer">
          <div className="bw-shell">
            <div className="bw-footer-top"><div><BrandLogo inverse /><p>Car care, made refreshingly simple.<br />Built for drivers and businesses in Québec.</p></div><nav aria-label="Footer navigation"><a href="/garages#garage-results">Explore providers</a><a href="/#services">Services</a><a href="/#journey">How it works</a><Link href="/signup">For businesses</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div>
            <div className="bw-footer-word" aria-hidden="true">BandWhip</div>
            <div className="bw-footer-bottom"><span>© {new Date().getFullYear()} BandWhip.</span><span>Montréal, Québec · Canada</span><a href="/#find">Back to top ↑</a></div>
          </div>
        </footer>

    </main>
  );
}
