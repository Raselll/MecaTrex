export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#111111]">
      {/* Header */}
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316] text-lg font-black text-white">
              V
            </div>

            <div>
              <div className="text-xl font-bold tracking-tight">VEYOTOR</div>
              <div className="text-xs text-gray-500">Vehicle service platform</div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#" className="hover:text-[#F97316]">
              Find a garage
            </a>
            <a href="#" className="hover:text-[#F97316]">
              Towing
            </a>
            <a href="#" className="hover:text-[#F97316]">
              Deals
            </a>
            <a href="#" className="hover:text-[#F97316]">
              For garages
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-gray-100">
              Log in
            </button>

            <button className="rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white">
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-[#F97316]">
              Service your vehicle without the phone calls.
            </div>

            <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Find the right garage.
              <span className="block text-[#F97316]">Book in minutes.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Compare nearby garages by service, price and availability.
              Reserve online and request towing if your vehicle can’t make it there.
            </p>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-600">
              <div>
                <span className="font-bold text-black">01.</span> Choose your vehicle
              </div>
              <div>
                <span className="font-bold text-black">02.</span> Select a service
              </div>
              <div>
                <span className="font-bold text-black">03.</span> Book a garage
              </div>
            </div>
          </div>

          {/* Search Panel */}
          <div className="rounded-3xl border border-black/10 bg-[#FAFAFA] p-6 shadow-sm">
            <div className="mb-6">
              <p className="text-sm font-semibold text-[#F97316]">
                Start a service request
              </p>
              <h2 className="mt-1 text-2xl font-bold">What does your vehicle need?</h2>
            </div>

            <div className="space-y-3">
              <button className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left hover:border-[#F97316]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Vehicle
                  </p>
                  <p className="mt-1 font-semibold">Add your vehicle</p>
                </div>
                <span className="text-gray-400">›</span>
              </button>

              <button className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left hover:border-[#F97316]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Service
                  </p>
                  <p className="mt-1 font-semibold">Choose a service</p>
                </div>
                <span className="text-gray-400">›</span>
              </button>

              <button className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-5 py-4 text-left hover:border-[#F97316]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Location
                  </p>
                  <p className="mt-1 font-semibold">Montreal, QC</p>
                </div>
                <span className="text-gray-400">›</span>
              </button>

              <button className="mt-2 w-full rounded-2xl bg-[#F97316] px-5 py-4 font-semibold text-white transition hover:bg-[#EA580C]">
                View available garages
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-[#F97316]">Popular services</p>
            <h2 className="mt-1 text-3xl font-bold">Common vehicle needs</h2>
          </div>

          <button className="hidden text-sm font-semibold text-gray-600 hover:text-black sm:block">
            View all services →
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Oil change", "Routine maintenance", "$"],
            ["Tire service", "Change, install or repair", "◉"],
            ["Battery", "Test or replace", "⚡"],
            ["Brake service", "Inspection and repair", "■"],
          ].map(([title, subtitle, icon]) => (
            <button
              key={title}
              className="group rounded-2xl border border-black/10 bg-white p-5 text-left transition hover:-translate-y-1 hover:border-[#F97316]/50 hover:shadow-md"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 font-bold text-[#F97316]">
                {icon}
              </div>

              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

              <div className="mt-4 text-sm font-semibold text-[#F97316]">
                Browse garages →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Garage Preview */}
      <section className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-6">
            <p className="text-sm font-semibold text-[#F97316]">Nearby</p>
            <h2 className="mt-1 text-3xl font-bold">Garages around you</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Mécanique Central", "4.8", "2.4 km", "Today · 3:30 PM", "$89"],
              ["Garage Metro", "4.6", "4.1 km", "Tomorrow · 8:00 AM", "$75"],
              ["Performance MTL", "4.9", "6.8 km", "Today · 5:00 PM", "$110"],
            ].map(([name, rating, distance, time, price]) => (
              <div
                key={name}
                className="rounded-2xl border border-black/10 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{name}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      ★ {rating} · {distance}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-bold">
                    {price}
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-[#F7F7F7] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Next availability
                  </p>
                  <p className="mt-1 font-semibold">{time}</p>
                </div>

                <button className="mt-4 w-full rounded-xl bg-[#111111] py-3 text-sm font-semibold text-white hover:bg-[#F97316]">
                  View garage
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}