const messages = [
  "COMPARE LISTED PRICES",
  "CHOOSE YOUR TIME",
  "BOOK INSTANTLY",
  "GARAGES & TOWING",
  "NO PHONE TAG",
  "YOUR CAR, SORTED",
] as const;

// Identical long sequences make the loop seamless across viewport sizes.
const continuousMessages = Array.from({ length: 5 }, (_, repeat) =>
  messages.map((message) => ({ message, key: `${repeat}-${message}` }))
).flat();

export default function BrandMarquee() {
  return (
    <div
      className="bw-marquee"
      role="img"
      aria-label="BandWhip: compare listed prices, choose your time, book instantly, garages and towing"
    >
      <div className="bw-marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div className="bw-marquee-group" key={copy}>
            {continuousMessages.map(({ message, key }) => (
              <span className="bw-marquee-item" key={key}>
                <span aria-hidden="true" className="bw-marquee-spark">✳</span>
                {message}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
