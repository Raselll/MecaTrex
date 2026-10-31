export default function Home() {
  const services = ["Oil change", "Tires", "Brakes", "Battery"];

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      {/* Header */}
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-sm font-black text-white">
              M
            </div>
            <div className="text-lg font-black tracking-[0.18em]">
              MECATRE<span className="text-[#4670A5]">X</span>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-gray-600 md:flex">
            <a href="#find" className="transition hover:text-[#4670A5]">
              Find a garage
            </a>
            <a href="#garages" className="transition hover:text-[#4670A5]">
              For garages
            </a>
            <a href="#" className="transition hover:text-[#4670A5]">
              Log in
            </a>
          </nav>

          <button className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4670A5]">
            Get started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center sm:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-[#EEF3F8] px-4 py-2 text-sm font-semibold text-[#4670A5]">
            <span className="h-2 w-2 rounded-full bg-[#4670A5]" />
            Vehicle service, simplified
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-[#111827] sm:text-6xl lg:text-7xl">
            Find the right garage.
            <span className="block text-[#4670A5]">Book it in minutes.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-500 sm:text-lg">
            Tell us what your vehicle needs, compare nearby shops, and reserve
            your service without calling around.
          </p>

          {/* Main search */}
          <div
            id="find"
            className="mx-auto mt-12 max-w-4xl rounded-3xl border border-black/[0.07] bg-white p-3 shadow-[0_24px_80px_rgba(17,24,39,0.08)]"
          >
            <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto]">
              <button className="rounded-2xl px-5 py-4 text-left transition hover:bg-[#F7F9FC]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                  What do you need?
                </p>
                <p className="mt-1 text-sm font-semibold text-[#111827] sm:text-base">
                  Describe the repair or service
                </p>
              </button>

              <button className="rounded-2xl px-5 py-4 text-left transition hover:bg-[#F7F9FC]">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                  Location
                </p>
                <p className="mt-1 text-sm font-semibold text-[#111827] sm:text-base">
                  Montreal, QC
                </p>
              </button>

              <button className="rounded-2xl bg-[#4670A5] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[#3D6290]">
                Find garages
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-xs font-medium text-gray-400">Popular:</span>
            {services.map((service) => (
              <button
                key={service}
                className="rounded-full border border-black/[0.07] bg-white px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:border-[#4670A5]/40 hover:text-[#4670A5]"
              >
                {service}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Simple value proposition */}
      <section className="border-y border-black/[0.05] bg-[#FAFBFC]">
        <div className="mx-auto grid max-w-6xl gap-px px-6 py-6 sm:grid-cols-3">
          {[
            ["01", "Search", "Tell us what your vehicle needs."],
            ["02", "Compare", "See shops that match your request."],
            ["03", "Book", "Choose a time and confirm your visit."],
          ].map(([number, title, description]) => (
            <div key={number} className="px-5 py-5 text-center sm:text-left">
              <p className="text-xs font-bold tracking-[0.14em] text-[#4670A5]">{number}</p>
              <h2 className="mt-2 text-lg font-semibold text-[#111827]">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Garage side */}
      <section id="garages" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[#4670A5]">For garages</p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-[#111827] sm:text-5xl">
              More bookings. Less admin.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-500">
              Mecatrex helps garages receive new customers, manage availability,
              and promote seasonal offers from one place.
            </p>

            <button className="mt-7 rounded-full border border-black/[0.09] bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] transition hover:border-[#4670A5]/40 hover:text-[#4670A5]">
              Discover Mecatrex for garages →
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#111827] p-7 text-white">
              <div className="mb-10 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
                01
              </div>
              <h3 className="text-xl font-semibold">Smart calendar</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Organize appointments and keep your shop capacity clear.
              </p>
            </div>

            <div className="rounded-3xl bg-[#EEF3F8] p-7">
              <div className="mb-10 flex h-10 w-10 items-center justify-center rounded-xl bg-[#4670A5] text-sm font-bold text-white">
                02
              </div>
              <h3 className="text-xl font-semibold text-[#111827]">Promote your deals</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Put seasonal offers in front of drivers looking for service.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
