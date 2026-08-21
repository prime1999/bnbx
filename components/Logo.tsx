import Link from "next/link";

const Logo = () => {
  return (
    <Link
      href="/"
      className="font-roboto text-lg font-bold flex items-center gap-1"
    >
      BNB<span className="font-viga text-yellow-400 text-3xl">X</span>
    </Link>
  );
};

export default Logo;
