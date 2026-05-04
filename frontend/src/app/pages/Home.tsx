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
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth";
import equipmentInventory from "../../data/equipment-inventory.json";
import backgroundPic from "../../images/background_pic.JPG";
import { auth, googleProvider } from "../../lib/firebase";

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
  unitId?: string;
  label?: string;
  code?: string;
  barcode?: string;
  status?: EquipmentStatus;
  dueDate?: string;
  reservationStartTime?: string;
  reservationEndTime?: string;
  borrowerName?: string;
  borrowerEmail?: string;
  serialNumber?: string;
}

interface EquipmentInventoryRecord {
  id?: string;
  typeId?: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  kit?: string;
  imageUrl?: string;
  description?: string;
  notes?: string;
  serialNumber?: string;
  units: EquipmentInventoryUnit[];
}

interface EquipmentInventoryResponse {
  ok: boolean;
  equipment?: EquipmentInventoryRecord[];
  error?: string;
}

interface CreateReservationResponse {
  ok: boolean;
  reservation?: {
    id: string;
  };
  error?: string;
}

interface ReservationRecord {
  id: string;
  unitId: string;
  itemName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "reserved" | "cancelled";
  studentName?: string;
  studentEmail?: string;
}

interface ReservationListResponse {
  ok: boolean;
  reservations?: ReservationRecord[];
  error?: string;
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
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
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
  const recordId = record.id || record.typeId;

  if (!recordId || !record.name || record.category === "Rooms") {
    return [];
  }

  const units = record.units.length > 0 ? record.units : [{ id: recordId }];

  return units.map((unit, index) => {
    const status = unit.status?.toLowerCase().replace("-", "") === "checkedout" ? "checked-out" : "available";
    const id = unit.unitId || unit.code || unit.id || `${recordId}-${index + 1}`;

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
      code: unit.code || unit.id || unit.unitId || undefined,
      description: record.description || record.notes || undefined,
      serialNumber: unit.serialNumber || record.serialNumber || undefined,
    };
  });
}

const initialEquipment = (equipmentInventory as EquipmentInventoryRecord[]).flatMap(mapInventoryRecord);

async function parseApiResponse<T extends { ok: boolean; error?: string }>(response: Response) {
  const data = (await response.json()) as T;

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function getAuthHeaders(user: FirebaseUser) {
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    "Content-Type": "application/json",
  };
}

async function fetchBackendInventory() {
  const response = await fetch(`${BACKEND_API_URL}/api/inventory`);
  const data = (await response.json()) as EquipmentInventoryResponse;

  if (!data.ok || !data.equipment) {
    throw new Error(data.error || "Could not load equipment inventory.");
  }

  return data.equipment.flatMap(mapInventoryRecord);
}

async function fetchReservedReservations(date: string, startTime: string, endTime: string) {
  const params = new URLSearchParams({ date, startTime, endTime });
  const response = await fetch(`${BACKEND_API_URL}/api/reservations?${params.toString()}`);
  const data = await parseApiResponse<ReservationListResponse>(response);

  return data.reservations ?? [];
}

async function fetchMyReservations(user: FirebaseUser) {
  const response = await fetch(`${BACKEND_API_URL}/api/me/reservations`, {
    headers: await getAuthHeaders(user),
  });
  const data = await parseApiResponse<ReservationListResponse>(response);

  return data.reservations ?? [];
}

async function createBackendReservation(user: FirebaseUser, reservation: {
  unitId: string;
  itemName: string;
  date: string;
  startTime: string;
  endTime: string;
}) {
  const response = await fetch(`${BACKEND_API_URL}/api/reservations`, {
    method: "POST",
    headers: await getAuthHeaders(user),
    body: JSON.stringify(reservation),
  });
  const data = await parseApiResponse<CreateReservationResponse>(response);

  return data.reservation;
}

async function cancelBackendReservation(user: FirebaseUser, reservationId: string) {
  const response = await fetch(`${BACKEND_API_URL}/api/reservations/${reservationId}/cancel`, {
    method: "PATCH",
    headers: await getAuthHeaders(user),
  });
  const data = await parseApiResponse<CreateReservationResponse>(response);

  return data.reservation;
}

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

function applyReservationsToItems(items: EquipmentItem[], reservations: ReservationRecord[]) {
  return items.map((item) => {
    const reservation = reservations.find((currentReservation) => currentReservation.unitId === item.id);

    if (!reservation) {
      return {
        ...item,
        status: "available" as EquipmentStatus,
        borrowerName: undefined,
        borrowerEmail: undefined,
        dueDate: undefined,
        reservationStartTime: undefined,
        reservationEndTime: undefined,
      };
    }

    return {
      ...item,
      status: "checked-out" as EquipmentStatus,
      borrowerName: reservation.studentName,
      borrowerEmail: reservation.studentEmail,
      dueDate: reservation.date,
      reservationStartTime: reservation.startTime,
      reservationEndTime: reservation.endTime,
    };
  });
}

function EquipmentRentalPanel() {
  const [baseItems, setBaseItems] = useState<EquipmentItem[]>(initialEquipment);
  const [items, setItems] = useState<EquipmentItem[]>(initialEquipment);
  const [selectedId, setSelectedId] = useState(initialEquipment[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | EquipmentStatus>("all");
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [myReservations, setMyReservations] = useState<ReservationRecord[]>([]);
  const [authError, setAuthError] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reservationStartTime, setReservationStartTime] = useState(DEFAULT_RESERVATION_START_TIME);
  const [reservationEndTime, setReservationEndTime] = useState(DEFAULT_RESERVATION_END_TIME);
  const [inventoryMessage, setInventoryMessage] = useState("Loading equipment inventory...");
  const [reservationMessage, setReservationMessage] = useState("");
  const [reservationError, setReservationError] = useState("");
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const minimumReservationDate = useMemo(() => getDateInputValue(), []);
  const isReservationDateAllowed = !dueDate || isWednesdayOrThursday(dueDate);
  const reservationDateError = dueDate && !isReservationDateAllowed
    ? "Reservations can only be made on Wednesdays and Thursdays."
    : "";
  const reservationEndTimeOptions = useMemo(
    () => getReservationEndTimeOptions(reservationStartTime),
    [reservationStartTime],
  );

  useEffect(() => {
    let isMounted = true;

    fetchBackendInventory()
      .then((backendItems) => {
        if (!isMounted) {
          return;
        }

        if (backendItems.length === 0) {
          setInventoryMessage("Backend inventory is empty. Showing local fallback data.");
          return;
        }

        setBaseItems(backendItems);
        setItems(backendItems);
        setSelectedId(backendItems[0].id);
        setInventoryMessage("Inventory loaded from backend.");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setInventoryMessage(
          error instanceof Error
            ? `Could not load backend inventory. Showing local fallback data. ${error.message}`
            : "Could not load backend inventory. Showing local fallback data.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthError("");
    });
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMyReservations([]);
      return;
    }

    fetchMyReservations(currentUser)
      .then(setMyReservations)
      .catch((error) => {
        setAuthError(error instanceof Error ? error.message : "Could not load your reservations.");
      });
  }, [currentUser]);

  useEffect(() => {
    let isMounted = true;

    if (!dueDate || !isReservationDateAllowed || !reservationStartTime || !reservationEndTime) {
      setItems(baseItems);
      return;
    }

    setIsLoadingAvailability(true);
    fetchReservedReservations(dueDate, reservationStartTime, reservationEndTime)
      .then((reservations) => {
        if (!isMounted) {
          return;
        }

        setItems(applyReservationsToItems(baseItems, reservations));
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setReservationError(error instanceof Error ? error.message : "Could not load availability.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAvailability(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [baseItems, dueDate, isReservationDateAllowed, reservationStartTime, reservationEndTime]);

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
  const selectedReservation = selectedItem
    ? myReservations.find((reservation) =>
        reservation.status === "reserved" &&
        reservation.unitId === selectedItem.id &&
        reservation.date === selectedItem.dueDate &&
        reservation.startTime === selectedItem.reservationStartTime &&
        reservation.endTime === selectedItem.reservationEndTime,
      )
    : undefined;
  const availableCount = items.filter((item) => item.status === "available").length;
  const checkedOutCount = items.length - availableCount;
  const pastReservationCount = items.filter((item) => item.status === "checked-out" && isPastReservation(item.dueDate)).length;

  const updateReservationStartTime = (nextStartTime: string) => {
    setReservationStartTime(nextStartTime);

    if (getReservationTimeMinutes(reservationEndTime) <= getReservationTimeMinutes(nextStartTime)) {
      setReservationEndTime(getReservationEndTimeOptions(nextStartTime)[0]?.label ?? DEFAULT_RESERVATION_END_TIME);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError("");

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in with Google.");
    }
  };

  const signOutOfGoogle = async () => {
    setAuthError("");
    await signOut(auth);
  };

  const checkOutItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReservationError("");
    setReservationMessage("");

    if (
      !selectedItem ||
      !currentUser ||
      !dueDate ||
      !isReservationDateAllowed ||
      !reservationStartTime ||
      !reservationEndTime
    ) {
      if (!currentUser) {
        setReservationError("Please sign in with Google before reserving equipment.");
      }
      return;
    }

    setIsSubmittingReservation(true);

    try {
      await createBackendReservation(currentUser, {
        unitId: selectedItem.id,
        itemName: selectedItem.name,
        date: dueDate,
        startTime: reservationStartTime,
        endTime: reservationEndTime,
      });
      const [reservations, nextMyReservations] = await Promise.all([
        fetchReservedReservations(dueDate, reservationStartTime, reservationEndTime),
        fetchMyReservations(currentUser),
      ]);
      setItems(applyReservationsToItems(baseItems, reservations));
      setMyReservations(nextMyReservations);
    } catch (error) {
      setReservationError(
        error instanceof Error
          ? error.message
          : "Could not create reservation. Please try again.",
      );
      setIsSubmittingReservation(false);
      return;
    }

    setReservationMessage("Reservation saved.");
    setIsSubmittingReservation(false);
  };

  const cancelReservation = async (reservationId: string) => {
    if (!currentUser) {
      setReservationError("Please sign in with Google first.");
      return;
    }

    setReservationError("");
    setReservationMessage("");

    try {
      await cancelBackendReservation(currentUser, reservationId);
      const [reservations, nextMyReservations] = await Promise.all([
        dueDate && isReservationDateAllowed
          ? fetchReservedReservations(dueDate, reservationStartTime, reservationEndTime)
          : Promise.resolve([]),
        fetchMyReservations(currentUser),
      ]);

      setItems(dueDate && isReservationDateAllowed ? applyReservationsToItems(baseItems, reservations) : baseItems);
      setMyReservations(nextMyReservations);
      setReservationMessage("Reservation cancelled.");
    } catch (error) {
      setReservationError(error instanceof Error ? error.message : "Could not cancel reservation.");
    }
  };

  const selectItem = (itemId: string) => {
    const nextItem = items.find((item) => item.id === itemId);
    setSelectedId(itemId);
    setReservationError("");
    setReservationMessage("");
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
                      {isAvailable
                        ? "Available"
                        : isOverdue
                          ? "Past"
                          : `Reserved${item.borrowerName ? ` (${item.borrowerName})` : ""}`}
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
            <div className="rounded-lg border border-[#d7d1c5] bg-white p-4">
              {currentUser ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#6a828a]">Signed in</p>
                    <p className="mt-1 font-bold text-foreground">{currentUser.displayName || currentUser.email}</p>
                    <p className="text-sm text-[#56727b]">{currentUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={signOutOfGoogle}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-medium text-[#476875] transition hover:border-accent hover:text-[#2c6171]"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <p className="text-sm font-medium text-[#476875]">
                    Sign in with your Cornell Google account to reserve equipment.
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1f4453] px-4 text-sm font-medium text-white transition hover:bg-[#2c6171]"
                  >
                    <User className="h-4 w-4" />
                    Sign in with Google
                  </button>
                </div>
              )}
              {authError && (
                <p className="mt-3 rounded-md border border-[#e6b6a7] bg-[#fff4f0] p-3 text-sm font-medium text-[#9a3f2f]">
                  {authError}
                </p>
              )}
            </div>

            {currentUser && (
              <div className="mt-4 rounded-lg border border-[#d7d1c5] bg-white p-4">
                <h4 className="text-sm font-bold uppercase tracking-[0.08em] text-[#6a828a]">
                  My reservations
                </h4>

                <div className="mt-3 grid gap-3">
                  {myReservations
                    .filter((r) => r.status === "reserved")
                    .map((reservation) => (
                      <div key={reservation.id} className="rounded-md border border-[#d7d1c5] bg-[#f7faf9] p-3">
                        <p className="font-semibold text-foreground">{reservation.itemName}</p>
                        <p className="mt-1 text-sm text-[#56727b]">
                          {formatDate(reservation.date)} / {reservation.startTime} - {reservation.endTime}
                        </p>
                        <button
                          type="button"
                          onClick={() => cancelReservation(reservation.id)}
                          className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d3cdc2] bg-white px-3 text-sm font-medium text-[#476875] hover:border-accent hover:text-[#2c6171]"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    ))}

                  {myReservations.filter((r) => r.status === "reserved").length === 0 && (
                    <p className="text-sm text-[#56727b]">No active equipment reservations.</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-lg border border-[#d7d1c5] bg-white p-4">
              <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.08em] text-[#6a828a]">
                Selected equipment
              </h4>

              <div className="flex items-start gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#f7faf9]">
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
                  <h3 className="mt-1 text-xl font-bold leading-tight text-foreground">
                    {selectedItem.name}
                  </h3>
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
                  <p className="rounded-md bg-[#f7faf9] p-3 leading-6 text-[#56727b]">
                    {selectedItem.description}
                  </p>
                )}
              </div>
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
                {selectedReservation && (
                  <button
                    type="button"
                    onClick={() => cancelReservation(selectedReservation.id)}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1f4453] px-4 text-sm font-medium text-white transition hover:bg-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Cancel reservation
                  </button>
                )}
              </div>
            ) : (
              <form className="mt-5 grid gap-4" onSubmit={checkOutItem}>
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
                  disabled={!currentUser || Boolean(reservationDateError) || isSubmittingReservation || isLoadingAvailability}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-bold text-white transition hover:bg-[#2c6171] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {isSubmittingReservation ? "Saving..." : isLoadingAvailability ? "Checking..." : "Reserve equipment"}
                </button>

                {reservationError && (
                  <p className="rounded-md border border-[#e6b6a7] bg-[#fff4f0] p-3 text-sm font-medium text-[#9a3f2f]">
                    {reservationError}
                  </p>
                )}

                {reservationMessage && (
                  <p className="rounded-md border border-[#b7d8c8] bg-[#eef8f3] p-3 text-sm font-medium text-[#2f6d52]">
                    {reservationMessage}
                  </p>
                )}
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
