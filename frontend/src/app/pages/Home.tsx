import { useRef, useState } from "react";
import { Calendar, Laptop, Users, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ImageWithFallback } from "../components/shared/ImageWithFallback";
import backgroundPic from "../../images/background_pic.JPG";

type PanelId = "coordinators" | "director" | "studio" | "equipment";

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
    title: "Meet with Coordinators",
    description: "Academic advising, deadlines, and general program support.",
    embedUrl: "https://calendly.com/your-team/coordinator-meeting",
  },
  {
    id: "director",
    icon: Calendar,
    title: "Meet with Director",
    description: "Research planning, project feedback, and career guidance.",
    embedUrl: "https://calendly.com/your-team/director-meeting",
  },
  {
    id: "studio",
    icon: Laptop,
    title: "Reserve Milstein Studio",
    description: "Reserve the studio for meetings, workshops, and collaborative work.",
    embedUrl: "https://calendly.com/your-team/studio-space",
  },
  {
    id: "equipment",
    icon: Laptop,
    title: "Rent Tech Equipment",
    description: "Request technology rentals in the same streamlined flow.",
    embedUrl: "https://calendly.com/your-team/equipment-rental",
  },
];

export function Home() {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const openPanel = (panelId: PanelId) => {
    setActivePanel(panelId);

    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const activeOption = bookingOptions.find((option) => option.id === activePanel) ?? null;

  return (
    <div id="top">
      <section className="relative overflow-hidden bg-black text-white">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={backgroundPic}
            alt="University campus"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/50" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="mb-3 text-4xl font-bold leading-tight md:text-5xl">
              Milstein Reservation System
            </h1>
            <p className="mb-6 text-lg text-gray-300">
              Schedule meetings with program staff, reserve studio space, and rent tech equipment.
            </p>
          </div>
        </div>
      </section>

      <section id="services" className="bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bookingOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activePanel === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => openPanel(option.id)}
                  className="text-left"
                >
                  <Card
                    className={`h-full gap-3 border-2 p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${
                      isActive ? "border-accent shadow-lg" : "hover:border-accent"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold leading-tight">{option.title}</h2>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeOption && (
        <section
          ref={panelRef}
          id="request-panel"
          className="bg-gray-50 py-8 scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{activeOption.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{activeOption.description}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-gray-600"
                onClick={() => setActivePanel(null)}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>

            <Card className="gap-4 border-2 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Calendly Embed</h3>
                  <p className="text-sm text-gray-600">
                    Replace this placeholder with the live Calendly embed for this request.
                  </p>
                </div>
              </div>

              <div className="flex min-h-[520px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-8">
                <div className="w-full max-w-xl text-center">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-accent" />
                  <p className="mb-3 text-lg font-bold">{activeOption.title}</p>
                  <p className="mb-4 text-sm text-gray-600">
                    Embed your scheduling widget here.
                  </p>
                  <div className="rounded-lg bg-gray-100 p-4 text-left font-mono text-xs text-gray-600 break-all">
                    {activeOption.embedUrl}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
