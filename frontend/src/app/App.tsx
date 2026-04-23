import { Home } from "./pages/Home";
import milsteinLogo from "../images/milstein_logo.png";
import milsteinText from "../images/milstein_text.png";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-[#d8d1c6] bg-white text-foreground">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-start gap-3">
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
          </a>
        </div>
      </header>
      <main className="flex-1">
        <Home />
      </main>
      <footer className="bg-[#1f4453] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/80">Milstein Program in Technology & Humanity</p>
            <p className="text-sm text-white/60">Cornell University College of Arts and Sciences</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
