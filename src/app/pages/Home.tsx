import { useEffect, useRef, useState } from "react";
import { Calendar, FileAudio, Users, X } from "lucide-react";

type PanelId = "coordinators" | "director" | "studio";

interface BookingOption {
  id: PanelId;
  icon: typeof Users;
  title: string;
  description: string;
  embedUrl: string;
}

const bookingOptions: BookingOption[] = [
  {
    id: "coordinators",
    icon: Users,
    title: "Meet with Program Staff",
    description: "Drop-in hours are also available on Wednesdays and Thursdays at 2-4 PM ET.",
    embedUrl: "https://calendly.com/milsteinprogram-cornell/30min",
  },
  {
    id: "director",
    icon: Calendar,
    title: "Meet with Program Director",
    description: "Book time to discuss research interests, program guidance, or other program-related questions.",
    embedUrl: "https://calendly.com/rsm253-cornell/20min",
  },
  {
    id: "studio",
    icon: FileAudio,
    title: "Reserve Milstein Studio",
    description: "Reserve the studio in RCK 131 for meetings, group work, recordings, and collaborations.",
    embedUrl: "https://calendly.com/milsteinstudio-cornell/30min",
  },
];

function loadCalendlyScript(onLoad?: () => void) {
  const scriptId = "calendly-widget-script";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

  if (existingScript) {
    if (existingScript.dataset.loaded === "true" || (window as typeof window & { Calendly?: unknown }).Calendly) {
      onLoad?.();
      return;
    }

    if (onLoad) {
      existingScript.addEventListener("load", onLoad, { once: true });
    }

    return;
  }

  const script = document.createElement("script");
  script.id = scriptId;
  script.src = "https://assets.calendly.com/assets/external/widget.js";
  script.async = true;
  script.onload = () => {
    script.dataset.loaded = "true";
    onLoad?.();
  };
  document.body.appendChild(script);
}

function CalendlyWidget({ url }: { url: string }) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    loadCalendlyScript(() => setIsScriptLoaded(true));
  }, []);

  useEffect(() => {
    if (!isScriptLoaded || !widgetRef.current) {
      return;
    }

    const calendly = (
      window as typeof window & {
        Calendly?: {
          initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
        };
      }
    ).Calendly;

    if (!calendly) {
      return;
    }

    widgetRef.current.innerHTML = "";
    calendly.initInlineWidget({ url, parentElement: widgetRef.current });
  }, [isScriptLoaded, url]);

  return (
    <div
      ref={widgetRef}
      className="min-w-[320px] overflow-hidden rounded-lg bg-white"
      style={{ height: 700 }}
    />
  );
}

export function Home() {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadCalendlyScript();
  }, []);

  const openPanel = (panelId: PanelId) => {
    setActivePanel(panelId);

    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const activeOption = bookingOptions.find((option) => option.id === activePanel) ?? null;

  return (
    <div>
      <section className="relative overflow-hidden bg-[#1f4453] text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-[#183646] to-[#2c6171]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-3 h-1 w-32 rounded-full bg-accent" />
            <h1 className="mb-3 text-4xl font-bold leading-tight md:text-5xl">
              Milstein Reservation System
            </h1>
            <p className="mb-6 text-lg text-white/80">
              Schedule meetings with program staff and reserve studio space.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <div className="mb-3 h-1 w-24 rounded-full bg-accent" />
            <h2 className="text-2xl font-bold text-foreground">Reservations</h2>
            <p className="mt-3 text-lg text-[#476875]">
              Choose a reservation type to open scheduling details.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {bookingOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activePanel === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => openPanel(option.id)}
                  onMouseEnter={() => loadCalendlyScript()}
                  onFocus={() => loadCalendlyScript()}
                  className="text-left"
                >
                  <div
                    className={`flex h-full flex-col gap-3 rounded-lg border p-5 text-black transition-all hover:-translate-y-1 hover:shadow-lg ${
                      isActive
                        ? "border-accent bg-white shadow-lg"
                        : "border-[#d7d1c5] bg-white hover:border-accent"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-[#2c6171]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold leading-tight">{option.title}</h2>
                      <p className="mt-3 text-sm leading-6 text-[#56727b]">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeOption && (
        <section ref={panelRef} className="scroll-mt-24 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{activeOption.title}</h2>
                <p className="mt-1 text-sm text-[#56727b]">{activeOption.description}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d3cdc2] bg-white px-4 py-2 text-sm font-medium text-[#476875] transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => setActivePanel(null)}
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-[#d7d1c5] bg-white p-4 text-black sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-[#2c6171]">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Calendly Embed</h3>
                  <p className="text-sm text-[#56727b]">
                    Choose a time below to complete your request.
                  </p>
                </div>
              </div>
              <CalendlyWidget url={activeOption.embedUrl} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
