const Hero = () => {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0  pointer-events-none" />

      <div className="relative z-10 max-w-3xl text-center flex flex-col items-center font-roboto">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Trade without
          <br />
          borders.
        </h1>

        <p className="text-gray-300 mb-8">
          Sub-millisecond execution, deep institutional liquidity, and
          cold-storage security — built for traders who move fast and never
          compromise.
        </p>
      </div>
    </div>
  );
};

export default Hero;
