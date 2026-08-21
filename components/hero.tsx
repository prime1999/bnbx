import { ArrowUp } from "lucide-react";

const Hero = () => {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden">
      <span className="rounded-full px-3 py-1.5 mb-2 text-xs font-sans text-gray-200 border border-white/15 bg-white/[0.05] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.2)] transition-all">
        The agents for the job.
      </span>
      <div className="relative z-10 max-w-3xl text-center flex flex-col items-center font-roboto">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Find the right agent
          <br />
          for the job.
        </h1>

        <p className="max-w-xl text-gray-400 mb-8">
          Describe what you want to accomplish, and we'll help you discover,
          compare, and hire the best BNB agents.
        </p>
      </div>
      <div className="relative">
        <input
          type="text"
          placeholder="Describe your goal ..."
          className="w-[300px] md:w-[500px] bg-black rounded-full p-4 border border-white/15 text-gray-300 text-sm font-roboto focus:outline-none"
        />
        <button className="absolute top-2 right-2.5 rounded-full p-2 bg-yellow-400 cursor-pointer duration-500 transition hover:bg-yellow-500">
          <ArrowUp size={20} className="text-black" />
        </button>
      </div>
    </div>
  );
};

export default Hero;
