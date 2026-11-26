const messages = [
  "COMPARE LISTED PRICES",
  "CHOOSE YOUR TIME",
  "BOOK INSTANTLY",
  "GARAGES & TOWING",
  "NO PHONE TAG",
  "YOUR CAR, SORTED",
];

export default function BrandMarquee() {
  return (
    <div className="bw-marquee" aria-label="BandWhip: compare prices, choose your time, book instantly, garages and towing">
      <div className="bw-marquee-track">
        {[0, 1].map((copy) => (
          <div className="bw-marquee-group" key={copy} aria-hidden={copy === 1}>
            {messages.map((message) => <span className="bw-marquee-item" key={message}><span aria-hidden="true" className="bw-marquee-spark">✳</span>{message}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
