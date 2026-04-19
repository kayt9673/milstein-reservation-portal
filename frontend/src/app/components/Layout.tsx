import { Outlet, Link } from "react-router";
import milsteinLogo from "../../images/milstein_logo.png";
import milsteinText from "../../images/milstein_text.png";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-start gap-3 min-w-0">
            <img
              src={milsteinLogo}
              alt="Milstein logo"
              className="h-9 w-9 shrink-0 object-contain"
            />
            <img
              src={milsteinText}
              alt="Milstein Program in Technology & Humanity"
              className="mt-0.5 h-7 w-auto min-w-0 object-contain"
            />
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-gray-400">
            Milstein Reservation System
          </p>
        </div>
      </footer>
    </div>
  );
}
