import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileAudio,
  Filter,
  Hash,
  Laptop,
  Mail,
  Package,
  RotateCcw,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import equipmentInventory from "../../data/equipment-inventory.json";
import backgroundPic from "../../images/background_pic.JPG";

type PanelId = "coordinators" | "director" | "studio" | "equipment";
type EquipmentStatus = "available" | "checked-out";

interface BookingOption {
  id: PanelId;
  icon: typeof Users;
  title: string;
  description: string;
  embedUrl?: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  status: EquipmentStatus;
  brand?: string;
  model?: string;
  kit?: string;
  dueDate?: string;
  reservationStartTime?: string;
  reservationEndTime?: string;
  borrowerName?: string;
  borrowerEmail?: string;
  imageUrl?: string;
  code?: string;
  description?: string;
  serialNumber?: string;
}

interface EquipmentInventoryUnit {
  id?: string;
  label?: string;
  code?: string;
  status?: EquipmentStatus;
  dueDate?: string;
  reservationStartTime?: string;
  reservationEndTime?: string;
  borrowerName?: string;
  borrowerEmail?: string;
  serialNumber?: string;
}

interface EquipmentInventoryRecord {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  kit?: string;
  imageUrl?: string;
  description?: string;
  serialNumber?: string;
  units: EquipmentInventoryUnit[];
}

const bookingOptions: BookingOption[] = [
  {
    id: "coordinators",
    icon: Users,
    title: "Meet with Program Staff",
    description: "Drop-in hours (no appointment needed) are also available on Wednesdays and Thursdays at 2-4 PM ET.",
    embedUrl: "https://calendly.com/milsteinprogram-cornell/30min",
  },
  {
    id: "director",
    icon: Calendar,
    title: "Meet with Program Director",
    description: "Book an appointment with the program director to discuss your research interests, get guidance, or talk through any other program-related questions.",
    embedUrl: "https://calendly.com/rsm253-cornell/20min",
  },
  {
    id: "studio",
    icon: FileAudio,
    title: "Reserve Milstein Studio",
    description: "Reserve the studio in RCK 131 for meetings, group work, and other collaborative activities.",
    embedUrl: "https://calendly.com/milsteinstudio-cornell/30min",
  },
  {
    id: "equipment",
    icon: Laptop,
    title: "Rent Tech Equipment",
    description: "Note: Tech rentals are only offered during the program staff's office hours.",
  },
];

const RESERVATION_OPEN_MINUTES = 14 * 60;
const RESERVATION_CLOSE_MINUTES = 16 * 60;
const RESERVATION_INTERVAL_MINUTES = 15;
const RESERVATION_TIME_OPTIONS = Array.from(
  { length: (RESERVATION_CLOSE_MINUTES - RESERVATION_OPEN_MINUTES) / RESERVATION_INTERVAL_MINUTES + 1 },
  (_, index) => {
    const minutes = RESERVATION_OPEN_MINUTES + index * RESERVATION_INTERVAL_MINUTES;

    return {
      label: formatReservationTime(minutes),
      minutes,
    };
  },
);
const RESERVATION_START_TIME_OPTIONS = RESERVATION_TIME_OPTIONS.filter(
  (option) => option.minutes < RESERVATION_CLOSE_MINUTES,
);
const DEFAULT_RESERVATION_START_TIME = RESERVATION_TIME_OPTIONS[0].label;
const DEFAULT_RESERVATION_END_TIME = RESERVATION_TIME_OPTIONS[1].label;

function formatReservationTime(minutesAfterMidnight: number) {
  const hour24 = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem} ET`;
}

function getReservationTimeMinutes(timeLabel: string) {
  return RESERVATION_TIME_OPTIONS.find((option) => option.label === timeLabel)?.minutes ?? RESERVATION_OPEN_MINUTES;
}

function getReservationEndTimeOptions(startTime: string) {
  const startMinutes = getReservationTimeMinutes(startTime);

  return RESERVATION_TIME_OPTIONS.filter((option) => option.minutes > startMinutes);
}

function isWednesdayOrThursday(date: string) {
  if (!date) {
    return false;
  }

  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 3 || day === 4;
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatInventoryItemName(record: EquipmentInventoryRecord, unit: EquipmentInventoryUnit) {
  if (!unit.label) {
    return record.name;
  }

  if (record.name.endsWith(" - KIT ONLY")) {
    return record.name.replace(" - KIT ONLY", ` ${unit.label} - KIT ONLY`);
  }

  return `${record.name} ${unit.label}`;
}

function mapInventoryRecord(record: EquipmentInventoryRecord): EquipmentItem[] {
  if (!record.name || record.category === "Rooms") {
    return [];
  }

  const units = record.units.length > 0 ? record.units : [{ id: record.id }];

  return units.map((unit, index) => {
    const status = unit.status?.toLowerCase().replace("-", "") === "checkedout" ? "checked-out" : "available";
    const id = unit.code || unit.id || `${record.id}-${index + 1}`;

    return {
      id,
      name: formatInventoryItemName(record, unit),
      category: record.category || "Equipment",
      status,
      brand: record.brand || undefined,
      model: record.model || undefined,
      kit: record.kit || undefined,
      dueDate: unit.dueDate?.slice(0, 10) || undefined,
      reservationStartTime: unit.reservationStartTime || undefined,
      reservationEndTime: unit.reservationEndTime || undefined,
      borrowerName: unit.borrowerName || undefined,
      borrowerEmail: unit.borrowerEmail || undefined,
      imageUrl: record.imageUrl || undefined,
      code: unit.code || unit.id || undefined,
      description: record.description || undefined,
      serialNumber: unit.serialNumber || record.serialNumber || undefined,
    };
  });
}

const initialEquipment = (equipmentInventory as EquipmentInventoryRecord[]).flatMap(mapInventoryRecord);
interface CalendlyWidgetProps {
  url: string;
}

function loadCalendlyScript(onLoad?: () => void) {
  const scriptId = "calendly-widget-script";
  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

  if (existingScript) {
    if (
      existingScript.dataset.loaded === "true" ||
      (window as typeof window & { Calendly?: unknown }).Calendly
    ) {
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

function CalendlyWidget({ url }: CalendlyWidgetProps) {
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
    calendly.initInlineWidget({
      url,
      parentElement: widgetRef.current,
    });
  }, [isScriptLoaded, url]);

  return (
    <div
      ref={widgetRef}
      className="min-w-[320px] overflow-hidden rounded-lg bg-white"
      style={{ height: 700 }}
    />
  );
}

function formatDate(date?: string) {
  if (!date) {
    return "No date";
  }

  const parsedDate = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function isPastReservation(date?: string) {
  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) < today;
}

function formatCheckoutSummary(item: EquipmentItem) {
  return [
    item.dueDate ? formatDate(item.dueDate) : "No date",
    formatReservationTimeRange(item),
    item.borrowerName,
  ]
    .filter(Boolean)
    .join(" / ");
}

function formatReservationTimeRange(item: EquipmentItem) {
  if (!item.reservationStartTime || !item.reservationEndTime) {
    return undefined;
  }

  return `${item.reservationStartTime} - ${item.reservationEndTime}`;
}

function EquipmentRentalPanel() {
  const [items, setItems] = useState<EquipmentItem[]>(initialEquipment);
  const [selectedId, setSelectedId] = useState(initialEquipment[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | EquipmentStatus>("all");
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reservationStartTime, setReservationStartTime] = useState(DEFAULT_RESERVATION_START_TIME);
  const [reservationEndTime, setReservationEndTime] = useState(DEFAULT_RESERVATION_END_TIME);
  const minimumReservationDate = useMemo(() => getDateInputValue(), []);
  const isReservationDateAllowed = !dueDate || isWednesdayOrThursday(dueDate);
  const reservationDateError = dueDate && !isReservationDateAllowed
    ? "Reservations can only be made on Wednesdays and Thursdays."
    : "";
  const reservationEndTimeOptions = useMemo(
    () => getReservationEndTimeOptions(reservationStartTime),
    [reservationStartTime],
  );

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.category))).sort()],
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const searchableText = [
        item.name,
        item.category,
        item.brand,
        item.model,
        item.kit,
        item.code,
        item.serialNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesCategory && matchesStatus && searchableText.includes(normalizedQuery);
    });
  }, [category, items, query, statusFilter]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];
  const availableCount = items.filter((item) => item.status === "available").length;
  const checkedOutCount = items.length - availableCount;
  const pastReservationCount = items.filter((item) => item.status === "checked-out" && isPastReservation(item.dueDate)).length;

  const updateReservationStartTime = (nextStartTime: string) => {
    setReservationStartTime(nextStartTime);

    if (getReservationTimeMinutes(reservationEndTime) <= getReservationTimeMinutes(nextStartTime)) {
      setReservationEndTime(getReservationEndTimeOptions(nextStartTime)[0]?.label ?? DEFAULT_RESERVATION_END_TIME);
    }
  };

  const checkOutItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !selectedItem ||
      !borrowerName.trim() ||
      !borrowerEmail.trim() ||
      !dueDate ||
      !isReservationDateAllowed ||
      !reservationStartTime ||
      !reservationEndTime
    ) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              status: "checked-out",
              borrowerName: borrowerName.trim(),
              borrowerEmail: borrowerEmail.trim(),
              dueDate,
              reservationStartTime,
              reservationEndTime,
            }
          : item,
      ),
    );
  };

  const checkInItem = (itemId: string) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: "available",
              borrowerName: undefined,
              borrowerEmail: undefined,
              dueDate: undefined,
              reservationStartTime: undefined,
              reservationEndTime: undefined,
            }
          : item,
      ),
    );

    if (selectedId === itemId) {
      setBorrowerName("");
      setBorrowerEmail("");
      setDueDate("");
      setReservationStartTime(DEFAULT_RESERVATION_START_TIME);
      setReservationEndTime(DEFAULT_RESERVATION_END_TIME);
    }
  };

  const selectItem = (itemId: string) => {
    const nextItem = items.find((item) => item.id === itemId);
    setSelectedId(itemId);
    setBorrowerName(nextItem?.borrowerName ?? "");
    setBorrowerEmail(nextItem?.borrowerEmail ?? "");
    setDueDate(nextItem?.dueDate ?? "");
    setReservationStartTime(nextItem?.reservationStartTime ?? DEFAULT_RESERVATION_START_TIME);
    setReservationEndTime(nextItem?.reservationEndTime ?? DEFAULT_RESERVATION_END_TIME);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.7fr)]">
      <div className="min-w-0">
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-[#d7d1c5] bg-[#f7faf9] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#476875]">
              <CheckCircle2 className="h-4 w-4 text-[#2c6171]" />
              Available
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{availableCount}</p>
          </div>
          <div className="rounded-lg border border-[#d7d1c5] bg-[#f7faf9] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#476875]">
              <Clock3 className="h-4 w-4 text-[#8b5e2c]" />
              Reserved
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{checkedOutCount}</p>
          </div>
          <div className="rounded-lg border border-[#d7d1c5] bg-[#f7faf9] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#476875]">
              <CalendarDays className="h-4 w-4 text-[#9a3f2f]" />
              Past reservations
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{pastReservationCount}</p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_210px_170px]">
          <label className="relative block">
            <span className="sr-only">Search equipment</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a828a]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-[#d3cdc2] bg-white pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
              placeholder="Search gear, kits, codes"
            />
          </label>

          <label className="relative block">
            <span className="sr-only">Filter by category</span>
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a828a]" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full appearance-none rounded-md border border-[#d3cdc2] bg-white pl-10 pr-8 text-sm text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
            >
              {categories.map((currentCategory) => (
                <option key={currentCategory} value={currentCategory}>
                  {currentCategory}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | EquipmentStatus)}
              className="h-11 w-full rounded-md border border-[#d3cdc2] bg-white px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="checked-out">Reserved</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3">
          {visibleItems.map((item) => {
            const isSelected = item.id === selectedItem?.id;
            const isAvailable = item.status === "available";
            const isOverdue = item.status === "checked-out" && isPastReservation(item.dueDate);

            return (
              <article
                key={item.id}
                className={`grid gap-4 rounded-lg border bg-white p-3 transition sm:grid-cols-[96px_1fr_auto] ${
                  isSelected ? "border-accent shadow-md" : "border-[#d7d1c5]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectItem(item.id)}
                  className="h-24 w-full overflow-hidden rounded-md bg-[#edf4f4] sm:w-24"
                  aria-label={`Select ${item.name}`}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Package className="mx-auto h-full w-9 text-[#6a828a]" />
                  )}
                </button>

                <button type="button" onClick={() => selectItem(item.id)} className="min-w-0 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        isAvailable
                          ? "bg-[#e8f3ee] text-[#2f6d52]"
                          : isOverdue
                            ? "bg-[#f8e9e3] text-[#9a3f2f]"
                            : "bg-[#f6eedf] text-[#8b5e2c]"
                      }`}
                    >
                      {isAvailable ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {isAvailable ? "Available" : isOverdue ? "Past" : "Reserved"}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6a828a]">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-foreground">{item.name}</h3>
                  <p className="mt-1 text-sm text-[#56727b]">
                    {[item.brand, item.model, item.kit ? `Kit: ${item.kit}` : ""].filter(Boolean).join(" / ")}
                  </p>
                  {item.status === "checked-out" && (
                    <p className="mt-2 text-sm font-medium text-[#476875]">
                      {formatCheckoutSummary(item)}
                    </p>
                  )}
                </button>

                <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:justify-center">
                  <button
                    type="button"
                    onClick={() => selectItem(item.id)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-medium text-[#476875] transition hover:border-accent hover:text-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Select
                  </button>
                  {!isAvailable && (
                    <button
                      type="button"
                      onClick={() => checkInItem(item.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#1f4453] px-3 text-sm font-medium text-white transition hover:bg-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {visibleItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#b7c8cc] bg-[#f7faf9] p-8 text-center text-[#56727b]">
              No equipment matches the current filters.
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-[#d7d1c5] bg-[#f7faf9] p-5">
        {selectedItem && (
          <>
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white">
                {selectedItem.imageUrl ? (
                  <img src={selectedItem.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="mx-auto h-full w-8 text-[#6a828a]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#6a828a]">
                  {selectedItem.category}
                </p>
                <h3 className="mt-1 text-xl font-bold leading-tight text-foreground">{selectedItem.name}</h3>
                <p className="mt-1 text-sm text-[#56727b]">
                  {[selectedItem.brand, selectedItem.model].filter(Boolean).join(" / ")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-sm text-[#476875]">
              {selectedItem.kit && (
                <p className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#2c6171]" />
                  {selectedItem.kit}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#2c6171]" />
                {selectedItem.code}
              </p>
              {selectedItem.description && (
                <p className="rounded-md bg-white p-3 leading-6 text-[#56727b]">{selectedItem.description}</p>
              )}
            </div>

            {selectedItem.status === "checked-out" ? (
              <div className="mt-5 rounded-lg border border-[#d7d1c5] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-bold text-foreground">Reserved</p>
                  <span className="rounded-full bg-[#f6eedf] px-2.5 py-1 text-xs font-bold text-[#8b5e2c]">
                    {selectedItem.dueDate ? formatDate(selectedItem.dueDate) : "No date"}
                  </span>
                </div>
                {formatReservationTimeRange(selectedItem) && (
                  <p className="flex items-center gap-2 text-sm text-[#476875]">
                    <Clock3 className="h-4 w-4" />
                    {formatReservationTimeRange(selectedItem)}
                  </p>
                )}
                {selectedItem.borrowerName && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#476875]">
                    <User className="h-4 w-4" />
                    {selectedItem.borrowerName}
                  </p>
                )}
                {selectedItem.borrowerEmail && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[#476875]">
                    <Mail className="h-4 w-4" />
                    {selectedItem.borrowerEmail}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => checkInItem(selectedItem.id)}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1f4453] px-4 text-sm font-medium text-white transition hover:bg-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear reservation
                </button>
              </div>
            ) : (
              <form className="mt-5 grid gap-4" onSubmit={checkOutItem}>
                <label className="grid gap-1.5 text-sm font-semibold text-[#476875]">
                  Student name
                  <input
                    value={borrowerName}
                    onChange={(event) => setBorrowerName(event.target.value)}
                    className="h-10 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
                    required
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-[#476875]">
                  Student email
                  <input
                    type="email"
                    value={borrowerEmail}
                    onChange={(event) => setBorrowerEmail(event.target.value)}
                    className="h-10 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
                    required
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-[#476875]">
                  Reservation date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    min={minimumReservationDate}
                    aria-invalid={Boolean(reservationDateError)}
                    className={`h-10 rounded-md border bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30 ${
                      reservationDateError ? "border-[#9a3f2f]" : "border-[#d3cdc2]"
                    }`}
                    required
                  />
                  {reservationDateError && (
                    <span className="text-xs font-medium text-[#9a3f2f]">{reservationDateError}</span>
                  )}
                </label>
                <fieldset className="grid gap-2 text-sm font-semibold text-[#476875]">
                  <legend>Reservation time</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      Start time
                      <select
                        value={reservationStartTime}
                        onChange={(event) => updateReservationStartTime(event.target.value)}
                        className="h-10 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
                      >
                        {RESERVATION_START_TIME_OPTIONS.map((option) => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      End time
                      <select
                        value={reservationEndTime}
                        onChange={(event) => setReservationEndTime(event.target.value)}
                        className="h-10 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-normal text-foreground outline-none transition focus:border-accent focus:ring-3 focus:ring-ring/30"
                      >
                        {reservationEndTimeOptions.map((option) => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
                <button
                  type="submit"
                  disabled={Boolean(reservationDateError)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white transition hover:bg-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Reserve equipment
                </button>
              </form>
            )}
          </>
        )}
      </aside>
    </div>
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
        <div className="absolute inset-0">
          <img
            src={backgroundPic}
            alt="University campus"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#183646]/82 to-[#2c4f5f]/74" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-3 h-1 w-32 rounded-full bg-accent" />
            <h1 className="mb-3 text-4xl font-bold leading-tight md:text-5xl">
              Milstein Reservation System
            </h1>
            <p className="mb-6 text-lg text-white/80">
              Schedule meetings with program staff, reserve studio space, and rent tech equipment.
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bookingOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activePanel === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => openPanel(option.id)}
                  onMouseEnter={() => option.embedUrl && loadCalendlyScript()}
                  onFocus={() => option.embedUrl && loadCalendlyScript()}
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
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#56727b]">{option.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeOption && (
        <section
          ref={panelRef}
          className="scroll-mt-24 bg-white py-8"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{activeOption.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-[#56727b]">{activeOption.description}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d3cdc2] bg-white px-4 py-2 text-sm font-medium text-[#476875] transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => setActivePanel(null)}
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-[#d7d1c5] bg-white p-4 text-black sm:p-6">
              {activeOption.embedUrl ? (
                <>
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
                </>
              ) : (
                <EquipmentRentalPanel />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
