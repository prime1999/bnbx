import Link from "next/link";
import Logo from "@/components/Logo";
import { AuthButton } from "@/components/auth-button";

const Navbar = () => {
  return (
    <nav className="sticky top-0 left-0 p-2 font-sans border-b border-white/15 bg-white/[0.05] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
      <div className="w-10/12 mx-auto flex items-center justify-between">
        <Logo />
        <div className="flex items-center justify-center gap-8 text-sm text-gray-200">
          <Link
            href="/explore"
            className="duration-500 transition hover:text-gray-400"
          >
            Explore
          </Link>
          <Link
            href="/compare"
            className="duration-500 transition hover:text-gray-400"
          >
            Compare
          </Link>
        </div>
        <AuthButton />
      </div>
    </nav>
  );
};

export default Navbar;
