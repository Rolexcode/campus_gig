"use client";

import NextImage from "next/image";
import {
  AnchorHTMLAttributes,
  createContext,
  Dispatch,
  FormEvent,
  MouseEvent,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Copy,
  Menu,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCheck,
  UsersRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { firebaseErrorMessage, useAuth } from "./AuthProvider";
import {
  GIG_CATEGORIES,
  type MarketplaceApplication,
  type MarketplaceConversation,
  type MarketplaceGig,
  type MarketplaceMessage,
  type MarketplacePayment,
  type SettlementPreference,
} from "@/app/lib/gigs";

type RouteProps = { route: string[] };
type GigStatus =
  | "open"
  | "in progress"
  | "submitted"
  | "completed"
  | "applied"
  | "accepted"
  | "rejected";
type VerificationStatus = "unverified" | "pending" | "verified";
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};
const PathnameContext = createContext("/");
type AppState = {
  applied: number[];
  acceptedApplicant: number | null;
  escrowSecured: boolean;
  escrowMethod: "local" | "solana" | null;
  paymentReleased: boolean;
  submitted: boolean;
  profileReady: boolean;
  profileCountry: string;
  profileUniversity: string;
  profileCourse: string;
  profileName: string;
  profileHeadline: string;
  profileBio: string;
  profileSkills: string;
  profilePortfolio: string;
  profileLinkedIn: string;
  profileGitHub: string;
  profileAvailability: string;
  profilePhotoName: string;
  profilePhotoDataUrl: string;
  verificationStatus: VerificationStatus;
  verificationMethod: "school-email" | "student-id" | null;
  verificationActions: Record<number, "approved" | "rejected">;
};

const initialState: AppState = {
  applied: [],
  acceptedApplicant: null,
  escrowSecured: false,
  escrowMethod: null,
  paymentReleased: false,
  submitted: false,
  profileReady: false,
  profileCountry: "Nigeria",
  profileUniversity: "University of Lagos",
  profileCourse: "",
  profileName: "",
  profileHeadline: "",
  profileBio: "",
  profileSkills: "",
  profilePortfolio: "",
  profileLinkedIn: "",
  profileGitHub: "",
  profileAvailability: "Available for short projects",
  profilePhotoName: "",
  profilePhotoDataUrl: "",
  verificationStatus: "unverified",
  verificationMethod: null,
  verificationActions: {},
};
const institutionsByCountry: Record<string, string[]> = {
  Nigeria: [
    "University of Lagos",
    "University of Ibadan",
    "University of Nigeria",
    "Covenant University",
  ],
  Ghana: [
    "University of Ghana",
    "Ashesi University",
    "Kwame Nkrumah University of Science and Technology",
  ],
  Kenya: [
    "University of Nairobi",
    "Strathmore University",
    "Kenyatta University",
  ],
  "South Africa": [
    "University of Cape Town",
    "University of Johannesburg",
    "University of Pretoria",
  ],
  Uganda: ["Makerere University", "Uganda Christian University"],
  Rwanda: ["University of Rwanda", "African Leadership University"],
  Canada: [
    "University of Toronto",
    "University of British Columbia",
    "McGill University",
  ],
  "United Kingdom": [
    "University of Edinburgh",
    "University of Manchester",
    "University College London",
  ],
  "United States": [
    "University of California, Berkeley",
    "Georgia Tech",
    "New York University",
  ],
  Singapore: [
    "National University of Singapore",
    "Nanyang Technological University",
  ],
};
const countries = Object.keys(institutionsByCountry);
const currencyByCountry: Record<string, string> = {
  Nigeria: "NGN",
  Ghana: "GHS",
  Kenya: "KES",
  "South Africa": "ZAR",
  Uganda: "UGX",
  Rwanda: "RWF",
  Canada: "CAD",
  "United Kingdom": "GBP",
  "United States": "USD",
  Singapore: "SGD",
};
const defaultEarliestGigDeadline = new Date(Date.now() + 86_400_000)
  .toISOString()
  .slice(0, 10);
const gigs = [
  {
    id: 1,
    title: "Social media designer for student conference",
    price: 35000,
    currency: "NGN",
    country: "Nigeria",
    summary:
      "Create a two-week content pack for our campus innovation conference.",
    description:
      "We need a reliable designer to create 12 branded social posts, three story templates, and a simple event countdown. Brand copy and references are ready. Final files should be delivered in editable Canva format and as exported PNGs.",
    poster: "Adaeze Nwosu",
    initials: "AN",
    university: "University of Lagos",
    category: "Design",
    posted: "18 min ago",
    status: "open" as GigStatus,
    applicants: 7,
    due: "26 Aug 2026",
  },
  {
    id: 2,
    title: "Research assistant for market survey",
    price: 1500,
    currency: "GHS",
    country: "Ghana",
    summary:
      "Help clean and summarize responses from a 300-person student survey.",
    description:
      "Clean a spreadsheet of student responses, group the open-text answers into themes, and prepare a one-page findings summary. Familiarity with Excel or Google Sheets is important.",
    poster: "Kwame Mensah",
    initials: "KM",
    university: "University of Ghana",
    category: "Research",
    posted: "42 min ago",
    status: "open" as GigStatus,
    applicants: 4,
    due: "24 Aug 2026",
  },
  {
    id: 3,
    title: "Event photography for faculty dinner",
    price: 5500,
    currency: "ZAR",
    country: "South Africa",
    summary:
      "Cover a three-hour faculty dinner and deliver 70 edited photographs.",
    description:
      "We need an experienced campus photographer for a formal faculty dinner. Please bring your own camera and deliver a curated gallery within four days.",
    poster: "Naledi Dlamini",
    initials: "ND",
    university: "University of Cape Town",
    category: "Photography",
    posted: "1 hr ago",
    status: "open" as GigStatus,
    applicants: 5,
    due: "29 Aug 2026",
  },
  {
    id: 4,
    title: "Edit a 90-second product pitch video",
    price: 25000,
    currency: "KES",
    country: "Kenya",
    summary:
      "Turn our raw product clips into a sharp hackathon submission video.",
    description:
      "Edit supplied screen recordings and founder voiceover into a polished 90-second product pitch. Add clean captions, light sound design, and our existing logo animation.",
    poster: "Amina Hassan",
    initials: "AH",
    university: "University of Nairobi",
    category: "Video",
    posted: "2 hrs ago",
    status: "open" as GigStatus,
    applicants: 9,
    due: "22 Aug 2026",
  },
  {
    id: 5,
    title: "Build a simple event registration page",
    price: 400000,
    currency: "RWF",
    country: "Rwanda",
    summary:
      "Responsive one-page registration site for a departmental tech event.",
    description:
      "Build a responsive event page from our Figma file with speaker cards, schedule, and a working local registration confirmation state. React or Next.js preferred.",
    poster: "Jean-Paul Niyonzima",
    initials: "JN",
    university: "University of Rwanda",
    category: "Development",
    posted: "3 hrs ago",
    status: "open" as GigStatus,
    applicants: 11,
    due: "28 Aug 2026",
  },
  {
    id: 6,
    title: "Write four newsletter stories",
    price: 180,
    currency: "CAD",
    country: "Canada",
    summary:
      "Interview student founders and turn the conversations into short profiles.",
    description:
      "Conduct four short remote interviews and write 350-word profiles for our entrepreneurship newsletter. Interview prompts and editorial format are provided.",
    poster: "Maya Chen",
    initials: "MC",
    university: "University of Toronto",
    category: "Writing",
    posted: "5 hrs ago",
    status: "open" as GigStatus,
    applicants: 3,
    due: "30 Aug 2026",
  },
];
const applicants = [
  {
    id: 1,
    name: "Amara Okeke",
    initials: "AO",
    university: "University of Lagos",
    course: "Creative Arts",
    completed: 12,
    rating: "4.9",
    note: "I design event campaigns for two campus societies and can deliver the first concepts tomorrow.",
  },
  {
    id: 2,
    name: "David Mwangi",
    initials: "DM",
    university: "Strathmore University",
    course: "Graphic Design",
    completed: 8,
    rating: "4.8",
    note: "Strong Canva workflow, fast turnaround, and all source files included.",
  },
  {
    id: 3,
    name: "Lerato Mokoena",
    initials: "LM",
    university: "University of Johannesburg",
    course: "Media Studies",
    completed: 6,
    rating: "4.7",
    note: "I can handle both the visual system and social captions for the campaign.",
  },
  {
    id: 4,
    name: "Kojo Asante",
    initials: "KA",
    university: "Ashesi University",
    course: "Computer Science",
    completed: 4,
    rating: "4.9",
    note: "Available immediately. I have shared similar event work in my profile.",
  },
];
const verifications = [
  {
    id: 1,
    name: "Seyi Adekunle",
    email: "seyi.a@gmail.com",
    university: "Lagos State University",
    submitted: "Today, 09:42",
    document: "Student ID · JPG",
  },
  {
    id: 2,
    name: "Ama Boateng",
    email: "ama.boateng@gmail.com",
    university: "University of Ghana",
    submitted: "Yesterday, 16:18",
    document: "Admission letter · PDF",
  },
  {
    id: 3,
    name: "Brian Otieno",
    email: "brian.otieno@gmail.com",
    university: "University of Nairobi",
    submitted: "Yesterday, 11:06",
    document: "Student ID · PNG",
  },
];

type AppStateContextValue = readonly [
  AppState,
  Dispatch<SetStateAction<AppState>>,
];
const AppStateContext = createContext<AppStateContextValue | null>(null);

function navigate(href: string) {
  const next = new URL(href, window.location.href);
  window.history.pushState(
    {},
    "",
    `${next.pathname}${next.search}${next.hash}`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

function Link({ href, onClick, target, children, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== "_self") ||
      props.download
    )
      return;

    const next = new URL(href, window.location.href);
    if (next.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a {...props} href={href} target={target} onClick={handleClick}>
      {children}
    </a>
  );
}

function useRoutePathname(serverRoute: string[]) {
  const [pathname, setPathname] = useState(`/${serverRoute.join("/")}`);

  useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    syncPathname();
    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);

  return pathname;
}

function useAppPathname() {
  return useContext(PathnameContext);
}

function useAppState() {
  const context = useContext(AppStateContext);
  if (!context)
    throw new Error("useAppState must be used inside AppStateProvider.");
  return context;
}

function AppStateProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const hydratedState = useMemo<AppState>(() => {
    if (!user || !profile) return initialState;
    return {
      ...initialState,
      profileReady: profile.onboardingComplete,
      profileCountry: profile.country || initialState.profileCountry,
      profileUniversity: profile.university || initialState.profileUniversity,
      profileCourse: profile.course || "",
      profileName: profile.fullName || user.displayName || "CampusGig member",
      profileHeadline: profile.headline || "",
      profileBio: profile.bio || "",
      profileSkills: profile.skills || "",
      profilePortfolio: profile.portfolio || "",
      profileLinkedIn: profile.linkedIn || "",
      profileGitHub: profile.gitHub || "",
      profileAvailability:
        profile.availability || initialState.profileAvailability,
      profilePhotoName: profile.photoName || "",
      profilePhotoDataUrl: profile.photoDataUrl || "",
      verificationStatus:
        profile.studentVerified || profile.verificationStatus === "approved"
          ? "verified"
          : profile.verificationStatus === "pending"
            ? "pending"
            : "unverified",
      verificationMethod: profile.verificationMethod || null,
    };
  }, [profile, user]);

  const identityKey = `${user?.uid ?? "guest"}:${JSON.stringify(profile ?? {})}`;
  return (
    <AppStateStore key={identityKey} initial={hydratedState}>
      {children}
    </AppStateStore>
  );
}

function AppStateStore({
  children,
  initial,
}: {
  children: ReactNode;
  initial: AppState;
}) {
  const [state, setState] = useState<AppState>(initial);
  const value = useMemo<AppStateContextValue>(
    () => [state, setState] as const,
    [state],
  );
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

function formatAmount(amount: number, currency?: string) {
  const resolvedCurrency =
    currency ?? gigs.find((gig) => gig.price === amount)?.currency ?? "USDC";
  if (resolvedCurrency === "USDC")
    return `${amount.toLocaleString("en-US")} USDC`;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function gigStatusForDisplay(status: MarketplaceGig["status"]): GigStatus {
  if (status === "in_progress") return "in progress";
  if (status === "awaiting_funding") return "accepted";
  if (status === "closed") return "completed";
  return status;
}

function formatGigDate(value: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatConversationTime(value: string) {
  if (!value) return "Sending…";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDeadline(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function useMarketplaceGigs(mine = false) {
  const { user } = useAuth();
  const [items, setItems] = useState<MarketplaceGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (mine && !user) return;
    setLoading(true);
    setError("");
    try {
      const headers: HeadersInit = {};
      if (mine && user)
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      const response = await fetch(mine ? "/api/gigs?mine=1" : "/api/gigs", {
        headers,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(String(payload.error ?? "Gigs could not be loaded."));
      setItems(Array.isArray(payload.gigs) ? payload.gigs : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gigs could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [mine, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return { items, loading, error, retry: load };
}

function StatusBadge({ status }: { status: GigStatus }) {
  const config: Record<
    GigStatus,
    { className: string; icon: typeof CheckCircle2; label: string }
  > = {
    open: { className: "status-open", icon: Sparkles, label: "Open" },
    "in progress": {
      className: "status-progress",
      icon: Clock3,
      label: "In progress",
    },
    submitted: {
      className: "status-submitted",
      icon: UploadCloud,
      label: "Submitted",
    },
    completed: {
      className: "status-completed",
      icon: CheckCircle2,
      label: "Completed",
    },
    applied: { className: "status-applied", icon: FileText, label: "Applied" },
    accepted: {
      className: "status-completed",
      icon: UserCheck,
      label: "Accepted",
    },
    rejected: {
      className: "status-rejected",
      icon: XCircle,
      label: "Rejected",
    },
  };
  const item = config[status];
  const Icon = item.icon;
  return (
    <span className={`status ${item.className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {item.label}
    </span>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg"
      aria-label="CampusGig home"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-lg font-bold tracking-[-0.03em]">CampusGig</span>
      )}
    </Link>
  );
}

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CG"
  );
}

function ProfileAvatar({
  name,
  src,
  large = false,
  className = "",
}: {
  name: string;
  src?: string;
  large?: boolean;
  className?: string;
}) {
  const sizeClass = large
    ? "size-20 rounded-2xl text-xl"
    : "size-10 rounded-full text-sm";
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-primary-soft font-bold text-primary ${sizeClass} ${className}`}
    >
      {src ? (
        <NextImage
          src={src}
          alt={`${name} profile picture`}
          fill
          sizes={large ? "80px" : "40px"}
          unoptimized
          className="object-cover"
        />
      ) : (
        initialsFor(name)
      )}
    </span>
  );
}

function compressedImage(
  file: File,
  maxDimension: number,
  quality: number,
  maxDataUrlLength: number,
) {
  return new Promise<string>((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error("Choose a JPG, PNG, or WebP image."));
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      reject(new Error("Choose an image smaller than 6 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("That image could not be read. Choose another file."));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () =>
        reject(
          new Error("That image could not be opened. Choose another file."),
        );
      image.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Your browser could not prepare that image."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length > maxDataUrlLength) {
          reject(
            new Error(
              "That image is too detailed to upload. Choose a smaller image.",
            ),
          );
          return;
        }
        resolve(dataUrl);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { user, profile, logOut } = useAuth();
  const pathname = useAppPathname();
  const links = user
    ? [
        ["/gigs", "Browse gigs"],
        ["/post", "Post a gig"],
        ["/profile", "Profile"],
      ]
    : [
        ["/gigs", "Browse gigs"],
        ["/post", "Post a gig"],
        ["/login", "Log in"],
      ];
  const navLink = (href: string, label: string) => (
    <Link
      className={`nav-link ${pathname === href ? "nav-link-active" : ""}`}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      key={href}
    >
      {label}
    </Link>
  );
  const logout = async () => {
    await logOut();
    navigate("/");
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="page-shell flex h-18 items-center justify-between gap-4">
        <Brand />
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary navigation"
        >
          {links.map(([href, label]) => navLink(href, label))}
          {user ? (
            <button
              className="btn btn-secondary ml-2"
              type="button"
              onClick={logout}
            >
              Log out
            </button>
          ) : (
            <Link className="btn btn-primary ml-2" href="/signup">
              Create account
            </Link>
          )}
        </nav>
        <button
          type="button"
          className="icon-button md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          className="page-shell grid gap-2 border-t border-border py-4 md:hidden"
        >
          {links.map(([href, label]) => navLink(href, label))}
          {user ? (
            <button
              className="btn btn-secondary mt-1"
              type="button"
              onClick={logout}
            >
              Log out {profile?.fullName ? `as ${profile.fullName}` : ""}
            </button>
          ) : (
            <Link className="btn btn-primary mt-1" href="/signup">
              Create account
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

function AppHeader() {
  const [open, setOpen] = useState(false);
  const [state] = useAppState();
  const { profile, user, logOut } = useAuth();
  const pathname = useAppPathname();
  const links = [
    ["/gigs", "Browse gigs"],
    ["/applications", "My applications"],
    ["/post", "Post a gig"],
    ["/my-gigs", "My posted gigs"],
  ];
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const verificationLabel =
    state.verificationStatus === "verified"
      ? "Verified student"
      : state.verificationStatus === "pending"
        ? "Verification pending"
        : "Verification required";
  const displayName =
    profile?.fullName || user?.displayName || user?.email || "CampusGig member";
  const logout = async () => {
    await logOut();
    navigate("/");
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="page-shell flex min-h-18 items-center justify-between gap-4 py-2">
        <Brand />
        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="App navigation"
        >
          {links.map(([href, label]) => (
            <Link
              className={`nav-link text-sm ${isActive(href) ? "nav-link-active" : ""}`}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className={`focus-ring hidden min-h-11 items-center gap-3 rounded-lg px-2 sm:flex ${pathname === "/profile" ? "bg-primary-soft" : ""}`}
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            <ProfileAvatar name={displayName} src={profile?.photoDataUrl} />
            <span className="text-left leading-tight">
              <span className="block max-w-36 truncate text-sm font-semibold">
                {displayName}
              </span>
              <span className="block text-xs text-muted">
                {verificationLabel}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button xl:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="app-mobile-menu"
            aria-label={open ? "Close app navigation" : "Open app navigation"}
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary hidden sm:inline-flex"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="app-mobile-menu"
          className="page-shell grid gap-1 border-t border-border py-4 xl:hidden"
        >
          {links.map(([href, label]) => (
            <Link
              className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              key={href}
            >
              {label}
            </Link>
          ))}
          <Link
            className={`nav-link sm:hidden ${pathname === "/profile" ? "nav-link-active" : ""}`}
            href="/profile"
            aria-current={pathname === "/profile" ? "page" : undefined}
          >
            Profile
          </Link>
          <button
            type="button"
            className="btn btn-secondary mt-2 sm:hidden"
            onClick={logout}
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="page-shell grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="max-w-md">
          <Brand />
          <p className="mt-3 text-sm leading-6 text-muted">
            Protected work with local and cross-border settlement for student
            communities worldwide.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link className="footer-link" href="/gigs">
            Browse gigs
          </Link>
          <Link className="footer-link" href="/post">
            Post a gig
          </Link>
          <span>© 2026 CampusGig</span>
        </div>
      </div>
    </footer>
  );
}
function AppLayout({
  children,
  publicPage = false,
}: {
  children: ReactNode;
  publicPage?: boolean;
}) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {publicPage || !user ? <PublicHeader /> : <AppHeader />}
      <main>{children}</main>
      <Footer />
    </div>
  );
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-[.1em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl leading-7 text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function LandingPage() {
  const spotlightGig = gigs[0];

  return (
    <AppLayout publicPage>
      <section className="landing-hero overflow-hidden border-b border-border">
        <div className="page-shell grid gap-10 py-10 sm:py-12 lg:min-h-[calc(100svh-4.5rem)] lg:grid-cols-[.92fr_1.08fr] lg:items-stretch lg:gap-12 lg:py-10">
          <div className="flex flex-col justify-center py-4 lg:py-6">
            <div className="editorial-kicker">
              <span className="h-px w-9 bg-primary" aria-hidden="true" />
              Protected campus work
            </div>
            <h1 className="mt-6 max-w-2xl text-balance text-5xl font-bold leading-[.96] tracking-[-0.06em] sm:text-6xl lg:text-6xl">
              <span className="block">Skills are already on campus.</span>
              <span className="mt-3 block text-primary">
                Now the payment is protected.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted">
              Hire verified students across campuses—or earn from what you
              already know. CampusGig secures the agreed amount before work
              starts, with familiar local payments and optional USDC settlement.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/gigs" className="btn btn-primary btn-large">
                Find a gig <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/post" className="btn btn-secondary btn-large">
                Hire student talent
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 border-y border-border">
              {[
                ["School verified", "email or student ID"],
                ["Flexible settlement", "local payment or USDC"],
                ["Client approved", "release follows completion"],
              ].map(([value, label]) => (
                <div
                  className="py-4 pr-3 [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-3"
                  key={label}
                >
                  <p className="text-sm font-bold sm:text-base">{value}</p>
                  <p className="mt-1 text-xs leading-4 text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="escrow-stage relative min-h-[560px] overflow-hidden rounded-2xl p-5 text-white sm:p-7 lg:min-h-full">
            <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
                  Live protection
                </p>
                <p className="mt-1 text-sm text-slate-300">Gig CG-1492</p>
              </div>
              <StatusBadge status="in progress" />
            </div>

            <div className="vault-visual relative z-10 flex min-h-[390px] items-center justify-center">
              <div className="vault-ring vault-ring-one" aria-hidden="true" />
              <div className="vault-ring vault-ring-two" aria-hidden="true" />
              <div className="vault-core">
                <LockKeyhole className="size-8" aria-hidden="true" />
              </div>
              <div className="absolute inset-x-4 top-8 text-center">
                <p className="text-sm text-slate-400">
                  Amount secured before work starts
                </p>
                <p className="mt-2 font-mono text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
                  {formatAmount(spotlightGig.price)}
                </p>
              </div>
              <div className="absolute inset-x-0 bottom-5 mx-auto max-w-sm rounded-xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-emerald-300 text-sm font-bold text-ink">
                    AO
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      Amara Okeke
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Verified student · University of Lagos
                    </p>
                  </div>
                  <BadgeCheck
                    className="ml-auto size-5 text-emerald-300"
                    aria-label="Verified student"
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/10 pt-5 text-xs font-bold uppercase tracking-[.12em]">
              <span className="text-emerald-300">01 / 03</span>
              <span className="h-px bg-white/20">
                <span className="block h-px w-1/3 bg-emerald-300" />
              </span>
              <span className="text-slate-400">Funds secured</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface">
        <div className="page-shell grid sm:grid-cols-3">
          {[
            [
              "01",
              "Verified identity",
              "Every participant is tied to a recognised higher-education institution.",
            ],
            [
              "02",
              "Payment protected",
              "The agreed amount is secured before accepted work begins.",
            ],
            [
              "03",
              "Human approval",
              "The client reviews the work before CampusGig releases payment.",
            ],
          ].map(([number, title, copy]) => (
            <article
              className="border-border py-7 sm:border-l sm:px-7 sm:first:border-l-0"
              key={number}
            >
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-xl font-bold text-primary">
                  {number}
                </span>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[.08em]">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell py-20 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
          <div>
            <p className="section-kicker">Two ways in</p>
            <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              Come for the work. Stay for the protection.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-muted lg:justify-self-end">
            CampusGig gives both sides a clear path from “we agreed in a DM” to
            “the work is done and the money moved.”
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <article className="overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-9">
            <div className="flex items-start justify-between gap-6">
              <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-emerald-300">
                <BriefcaseBusiness className="size-6" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs text-slate-400">
                FOR POSTERS
              </span>
            </div>
            <h3 className="mt-16 max-w-md text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Get real help without gambling the payment.
            </h3>
            <p className="mt-4 max-w-lg leading-7 text-slate-300">
              Post a clear brief, compare verified applicants, then secure the
              agreed amount only after you choose someone.
            </p>
            <Link
              href="/post"
              className="btn mt-8 bg-white text-ink hover:bg-slate-100"
            >
              Post a protected gig{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-6 sm:p-9">
            <div className="flex items-start justify-between gap-6">
              <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
                <GraduationCap className="size-6" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs text-muted">FOR STUDENTS</span>
            </div>
            <h3 className="mt-16 text-3xl font-bold tracking-[-0.04em]">
              Turn what you know into campus income.
            </h3>
            <p className="mt-4 leading-7 text-muted">
              Apply with your verified profile, work only after escrow is
              funded, and see every payment state clearly.
            </p>
            <Link href="/gigs" className="btn btn-secondary mt-8">
              Browse open gigs{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section className="border-y border-border bg-primary-soft">
        <div className="page-shell grid gap-8 py-14 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.12em] text-primary">
              Built for the campus economy
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.045em]">
              Less “trust me.” More proof at every step.
            </h2>
          </div>
          <Link href="/signup" className="btn btn-primary btn-large">
            Create your account{" "}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <AppLayout publicPage>
      <div className="page-shell grid min-h-[calc(100vh-10rem)] gap-10 py-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:py-16">
        <aside className="hidden rounded-2xl bg-ink p-8 text-white lg:block lg:sticky lg:top-28">
          <span className="eyebrow border-white/15 bg-white/10 text-emerald-200">
            <ShieldCheck className="size-4" />
            Protected from day one
          </span>
          <h2 className="mt-8 text-3xl font-bold leading-tight tracking-[-0.04em]">
            Work with confidence, not crossed fingers.
          </h2>
          <div className="mt-10 space-y-6">
            {[
              [
                BadgeCheck,
                "Verified community",
                "Every worker is tied to a recognised higher-education institution.",
              ],
              [
                LockKeyhole,
                "Funds secured first",
                "Clients fund escrow before work begins.",
              ],
              [
                CircleDollarSign,
                "Clear payment status",
                "Both sides always know where the money is.",
              ],
            ].map(([Icon, itemTitle, copy]) => {
              const ItemIcon = Icon as typeof BadgeCheck;
              return (
                <div className="flex gap-3" key={String(itemTitle)}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
                    <ItemIcon className="size-5 text-emerald-300" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{String(itemTitle)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {String(copy)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-muted">{description}</p>
          </div>
          <div className="card p-5 sm:p-8">{children}</div>
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </div>
    </AppLayout>
  );
}

function SignupPage() {
  const { signUp, configurationError } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await signUp(
        String(form.get("fullName")),
        String(form.get("email")),
        String(form.get("password")),
      );
      navigate("/verify-email");
    } catch (submitError) {
      setError(firebaseErrorMessage(submitError));
      setBusy(false);
    }
  };
  const visibleError = error || configurationError;
  return (
    <AuthShell
      title="Create your CampusGig account"
      description="Start with any email address. You’ll add your school and verify student status from your profile before applying for gigs."
      footer={
        <>
          Already have an account?{" "}
          <Link className="text-link" href="/login">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        {visibleError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {visibleError}
          </div>
        )}
        <div className="field">
          <label htmlFor="full-name">Full name</label>
          <input
            className="input"
            id="full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder="Tobi Okafor"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="tobi@example.com"
            required
          />
          <p className="field-hint">
            Personal and school email addresses are both accepted.
          </p>
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="text-link min-h-10"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="input"
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            required
          />
          <p className="field-hint">Use 8 or more characters.</p>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6 text-muted">
          <input
            className="mt-1 size-4 accent-primary"
            type="checkbox"
            required
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-link">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-link">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <button
          className="btn btn-primary w-full"
          type="submit"
          disabled={busy || Boolean(configurationError)}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <Clock3 className="size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <p className="text-center text-xs leading-5 text-muted">
          <LockKeyhole className="mr-1 inline size-3.5 text-primary" />
          We’ll email you a secure Firebase verification link before onboarding.
        </p>
      </form>
    </AuthShell>
  );
}

function LoginPage() {
  const { logIn, configurationError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await logIn(
        String(form.get("email")),
        String(form.get("password")),
      );
      if (session.isAdmin) {
        navigate(session.user.emailVerified ? "/admin" : "/admin/verify-email");
        return;
      }
      const requestedRoute = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      const safeRoute =
        requestedRoute?.startsWith("/") && !requestedRoute.startsWith("//")
          ? requestedRoute
          : "/gigs";
      navigate(session.user.emailVerified ? safeRoute : "/verify-email");
    } catch (submitError) {
      setError(firebaseErrorMessage(submitError));
      setBusy(false);
    }
  };
  const visibleError = error || configurationError;
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to manage your gigs, applications, and protected payments."
      footer={
        <>
          New to CampusGig?{" "}
          <Link className="text-link" href="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        {visibleError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {visibleError}
          </div>
        )}
        <div className="field">
          <label htmlFor="login-email">Email address</label>
          <input
            className="input"
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="tobi@example.com"
            required
          />
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password">Password</label>
            <button
              type="button"
              className="text-link min-h-10"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="input"
            id="login-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>
        <p className="text-xs leading-5 text-muted">
          Your session stays signed in on this browser until you log out.
        </p>
        <button
          className="btn btn-primary w-full"
          type="submit"
          disabled={busy || Boolean(configurationError)}
          aria-busy={busy}
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="flex items-start justify-center gap-2 text-center text-xs leading-5 text-muted">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          Your account activity and payment history stay protected.
        </p>
      </form>
    </AuthShell>
  );
}

function VerifyEmailPage() {
  const {
    user,
    profile,
    isAdmin,
    loading,
    logOut,
    refreshSession,
    sendAccountVerificationEmail,
  } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const automaticSendStarted = useRef(false);

  const sendLink = useCallback(async () => {
    setSending(true);
    setError("");
    setNotice("");
    try {
      await sendAccountVerificationEmail();
      setNotice(
        `Firebase sent a verification link to ${user?.email}. Check your inbox and spam folder.`,
      );
    } catch (sendError) {
      setError(firebaseErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  }, [sendAccountVerificationEmail, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (isAdmin) {
      navigate("/admin/verify-email");
      return;
    }
    if (user.emailVerified) {
      navigate(
        profile?.onboardingComplete ? "/gigs" : "/profile/edit?onboarding=1",
      );
      return;
    }
    if (!automaticSendStarted.current) {
      automaticSendStarted.current = true;
      void sendLink();
    }
  }, [isAdmin, loading, profile?.onboardingComplete, sendLink, user]);

  const checkVerification = async () => {
    if (!user) return;
    setChecking(true);
    setError("");
    try {
      await refreshSession();
      if (!user.emailVerified) {
        throw new Error(
          "That email is not verified yet. Open the Firebase link in your inbox, then try again.",
        );
      }
      navigate(
        profile?.onboardingComplete ? "/gigs" : "/profile/edit?onboarding=1",
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Verification could not be confirmed.",
      );
      setChecking(false);
    }
  };

  const useDifferentAccount = async () => {
    await logOut();
    navigate("/signup");
  };

  return (
    <AuthShell
      title="Check your email"
      description="Confirm that this email belongs to you before continuing to your CampusGig profile."
      footer={
        <button
          type="button"
          className="text-link"
          onClick={useDifferentAccount}
        >
          Use a different account
        </button>
      }
    >
      <div className="space-y-5">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
          </div>
        )}
        {notice && (
          <div
            className="rounded-lg border border-primary/20 bg-primary-soft p-4 text-sm leading-6 text-primary"
            role="status"
          >
            <CheckCircle2 className="mr-2 inline size-4" />
            {notice}
          </div>
        )}
        <div className="rounded-xl bg-muted-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Verification email
          </p>
          <p className="mt-1 break-all font-semibold">
            {user?.email ?? "Loading account…"}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="font-semibold">Open the link from Firebase</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Keep this page open, click the verification link in your inbox, then
            return here to confirm.
          </p>
        </div>
        <button
          className="btn btn-primary w-full"
          type="button"
          onClick={checkVerification}
          disabled={checking}
          aria-busy={checking}
        >
          {checking ? (
            <>
              <Clock3 className="size-4 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              I’ve verified my email <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <button
          className="btn btn-secondary w-full"
          type="button"
          onClick={sendLink}
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? "Sending link…" : "Send a new verification link"}
        </button>
      </div>
    </AuthShell>
  );
}

function AdminAuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-8">
        <section className="max-w-xl">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-400 text-slate-950">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xl font-bold">CampusGig</p>
              <p className="text-sm text-slate-400">Restricted admin console</p>
            </div>
          </div>
          <p className="mt-12 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">
            Operations access
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-[-0.045em] sm:text-5xl">
            Manage trust without entering the marketplace.
          </h2>
          <p className="mt-5 max-w-lg leading-7 text-slate-300">
            Administrator accounts are isolated from clients and students. They
            review registered users and student-verification requests only.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <UsersRound
                className="size-5 text-emerald-300"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold">User oversight</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Inspect real Firebase accounts without appearing in the member
                list.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <UserCheck
                className="size-5 text-emerald-300"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold">
                Verification decisions
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Approve or decline submitted student identification.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-xl rounded-2xl bg-white p-5 text-slate-950 shadow-2xl sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-emerald-700">
              Admin access
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 leading-7 text-slate-600">{description}</p>
          </div>
          <div className="mt-8">{children}</div>
          <div className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
            {footer}
          </div>
        </section>
      </main>
    </div>
  );
}

function AdminSignupPage() {
  const { user, isAdmin, loading, signUpAdmin, configurationError } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin)
      navigate(user.emailVerified ? "/admin" : "/admin/verify-email");
  }, [isAdmin, loading, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await signUpAdmin(
        String(form.get("fullName")),
        String(form.get("email")),
        String(form.get("password")),
      );
      navigate("/admin/verify-email");
    } catch (submitError) {
      setError(firebaseErrorMessage(submitError));
      setBusy(false);
    }
  };

  const visibleError = error || configurationError;
  return (
    <AdminAuthShell
      title="Create administrator account"
      description="Use the email already approved in ADMIN_EMAILS. This identity will not become a marketplace user."
      footer={
        <>
          Already registered?{" "}
          <Link
            className="font-semibold text-emerald-700 underline underline-offset-4"
            href="/admin/login"
          >
            Admin login
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        {visibleError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {visibleError}
          </div>
        )}
        <div className="field">
          <label htmlFor="admin-full-name">Full name</label>
          <input
            className="input"
            id="admin-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder="CampusGig administrator"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="admin-signup-email">Approved admin email</label>
          <input
            className="input"
            id="admin-signup-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="admin@example.com"
            required
          />
          <p className="field-hint">
            Only an address listed in ADMIN_EMAILS can complete registration.
          </p>
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label htmlFor="admin-signup-password">Password</label>
            <button
              type="button"
              className="min-h-10 font-semibold text-emerald-700 underline underline-offset-4"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="input"
            id="admin-signup-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            required
          />
          <p className="field-hint">Use 8 or more characters.</p>
        </div>
        <button
          className="btn w-full bg-slate-950 text-white hover:bg-slate-800"
          type="submit"
          disabled={busy || Boolean(configurationError)}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <Clock3 className="size-4 animate-spin" />
              Creating administrator…
            </>
          ) : (
            <>
              Create admin account <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </AdminAuthShell>
  );
}

function AdminLoginPage() {
  const { user, isAdmin, loading, logIn, logOut, configurationError } =
    useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin)
      navigate(user.emailVerified ? "/admin" : "/admin/verify-email");
  }, [isAdmin, loading, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const session = await logIn(
        String(form.get("email")),
        String(form.get("password")),
      );
      if (!session.isAdmin) {
        await logOut();
        throw new Error(
          "That account belongs to the CampusGig marketplace, not the admin console.",
        );
      }
      navigate(session.user.emailVerified ? "/admin" : "/admin/verify-email");
    } catch (submitError) {
      setError(firebaseErrorMessage(submitError));
      setBusy(false);
    }
  };

  const visibleError = error || configurationError;
  return (
    <AdminAuthShell
      title="Administrator login"
      description="Sign in with your dedicated CampusGig administrator account."
      footer={
        <>
          First-time administrator?{" "}
          <Link
            className="font-semibold text-emerald-700 underline underline-offset-4"
            href="/admin/signup"
          >
            Create admin account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        {visibleError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {visibleError}
          </div>
        )}
        <div className="field">
          <label htmlFor="admin-login-email">Admin email</label>
          <input
            className="input"
            id="admin-login-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="admin@example.com"
            required
          />
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label htmlFor="admin-login-password">Password</label>
            <button
              type="button"
              className="min-h-10 font-semibold text-emerald-700 underline underline-offset-4"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="input"
            id="admin-login-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>
        <button
          className="btn w-full bg-slate-950 text-white hover:bg-slate-800"
          type="submit"
          disabled={busy || Boolean(configurationError)}
          aria-busy={busy}
        >
          {busy ? "Checking access…" : "Open admin console"}
        </button>
      </form>
    </AdminAuthShell>
  );
}

function AdminVerifyEmailPage() {
  const {
    user,
    isAdmin,
    loading,
    logOut,
    refreshSession,
    sendAccountVerificationEmail,
  } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const automaticSendStarted = useRef(false);

  const sendLink = useCallback(async () => {
    setSending(true);
    setError("");
    setNotice("");
    try {
      await sendAccountVerificationEmail();
      setNotice(
        `Firebase sent an administrator verification link to ${user?.email}.`,
      );
    } catch (sendError) {
      setError(firebaseErrorMessage(sendError));
    } finally {
      setSending(false);
    }
  }, [sendAccountVerificationEmail, user]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      navigate("/admin/login");
      return;
    }
    if (user.emailVerified) {
      navigate("/admin");
      return;
    }
    if (!automaticSendStarted.current) {
      automaticSendStarted.current = true;
      void sendLink();
    }
  }, [isAdmin, loading, sendLink, user]);

  const checkVerification = async () => {
    if (!user) return;
    setChecking(true);
    setError("");
    try {
      await refreshSession();
      if (!user.emailVerified)
        throw new Error(
          "The administrator email is not verified yet. Open the Firebase link, then try again.",
        );
      navigate("/admin");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Verification could not be confirmed.",
      );
      setChecking(false);
    }
  };

  const useDifferentAccount = async () => {
    await logOut();
    navigate("/admin/login");
  };
  return (
    <AdminAuthShell
      title="Verify administrator email"
      description="Email ownership is required before the operations console opens."
      footer={
        <button
          type="button"
          className="font-semibold text-emerald-700 underline underline-offset-4"
          onClick={useDifferentAccount}
        >
          Use a different admin account
        </button>
      }
    >
      <div className="space-y-5">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
          </div>
        )}
        {notice && (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
            role="status"
          >
            <CheckCircle2 className="mr-2 inline size-4" />
            {notice}
          </div>
        )}
        <div className="rounded-xl bg-slate-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Administrator email
          </p>
          <p className="mt-1 break-all font-semibold">
            {user?.email ?? "Loading account…"}
          </p>
        </div>
        <button
          className="btn w-full bg-slate-950 text-white hover:bg-slate-800"
          type="button"
          onClick={checkVerification}
          disabled={checking}
          aria-busy={checking}
        >
          {checking ? (
            <>
              <Clock3 className="size-4 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              I’ve verified the admin email <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <button
          className="btn btn-secondary w-full"
          type="button"
          onClick={sendLink}
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? "Sending link…" : "Send a new verification link"}
        </button>
      </div>
    </AdminAuthShell>
  );
}

function GigCard({ gig }: { gig: MarketplaceGig }) {
  return (
    <article className="card p-5 transition-colors hover:border-primary/40 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="avatar">{initialsFor(gig.posterName)}</span>
          <div>
            <p className="text-sm font-semibold">{gig.posterName}</p>
            <p className="mt-0.5 text-xs text-muted">{gig.posterUniversity}</p>
          </div>
        </div>
        <StatusBadge status={gigStatusForDisplay(gig.status)} />
      </div>
      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="max-w-xl text-lg font-bold leading-6 tracking-[-0.02em]">
            {gig.title}
          </h2>
          <p className="font-mono text-lg font-bold text-primary">
            {formatAmount(gig.budget, gig.currency)}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {gig.summary}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span className="rounded-md bg-muted-surface px-2.5 py-1.5 font-semibold text-secondary">
            {gig.category}
          </span>
          <span className="rounded-md bg-muted-surface px-2.5 py-1.5 font-semibold text-secondary">
            {gig.country}
          </span>
          <span className="px-1 py-1.5">{formatGigDate(gig.createdAt)}</span>
          <span className="px-1 py-1.5">
            Due {formatDeadline(gig.deadline)}
          </span>
        </div>
        <Link href={`/gigs/${gig.id}`} className="btn btn-secondary">
          View gig <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function GigListSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading gigs" role="status">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="card h-64 animate-pulse bg-muted-surface" key={index} />
      ))}
    </div>
  );
}

function JobFeedPage() {
  const { user } = useAuth();
  const { items, loading, error, retry } = useMarketplaceGigs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("recent");
  const categories = ["All", ...GIG_CATEGORIES];
  const filtered = useMemo(() => {
    const next = items.filter(
      (gig) =>
        (category === "All" || gig.category === category) &&
        `${gig.title} ${gig.summary} ${gig.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (sort === "price-high")
      return [...next].sort((left, right) => right.budget - left.budget);
    if (sort === "deadline")
      return [...next].sort((left, right) =>
        left.deadline.localeCompare(right.deadline),
      );
    return next;
  }, [category, items, query, sort]);

  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Student workspace"
          title="Find your next campus gig"
          description="Browse paid tasks from verified students and organisations. Every listing here is stored live in CampusGig."
          action={
            user ? (
              <Link href="/applications" className="btn btn-secondary">
                My applications
              </Link>
            ) : (
              <Link href="/signup" className="btn btn-primary">
                Create account
              </Link>
            )
          }
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="card h-fit p-4 lg:sticky lg:top-24">
            <div className="field">
              <label htmlFor="gig-search">Search gigs</label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted"
                  aria-hidden="true"
                />
                <input
                  id="gig-search"
                  className="input pl-11"
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Design, writing, video…"
                />
              </div>
            </div>
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Category</legend>
              <div className="mt-2 grid gap-1">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setCategory(item)}
                    className={`focus-ring min-h-11 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${category === item ? "bg-primary-soft text-primary" : "text-secondary hover:bg-muted-surface"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-6 rounded-lg bg-ink p-4 text-white">
              <p className="text-sm font-semibold">Live marketplace</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                New gigs persist in Firestore and appear here after publishing.
              </p>
            </div>
          </aside>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {loading
                  ? "Loading open gigs…"
                  : `${filtered.length} open gig${filtered.length === 1 ? "" : "s"}`}
              </p>
              <select
                className="input min-h-11 w-auto text-sm"
                aria-label="Sort gigs"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Most recent</option>
                <option value="price-high">Highest budget</option>
                <option value="deadline">Soonest deadline</option>
              </select>
            </div>
            {loading ? (
              <GigListSkeleton />
            ) : error ? (
              <div className="card p-6" role="alert">
                <AlertCircle
                  className="size-7 text-destructive"
                  aria-hidden="true"
                />
                <h2 className="mt-4 text-lg font-bold">
                  Couldn’t load open gigs
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
                <button
                  type="button"
                  className="btn btn-secondary mt-5"
                  onClick={() => {
                    void retry();
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((gig) => (
                  <GigCard key={gig.id} gig={gig} />
                ))}
                {filtered.length === 0 && (
                  <div className="card p-10 text-center">
                    <BriefcaseBusiness
                      className="mx-auto size-9 text-muted"
                      aria-hidden="true"
                    />
                    <h2 className="mt-4 text-lg font-bold">
                      {items.length === 0
                        ? "No gigs have been posted yet"
                        : "No gigs match those filters"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                      {items.length === 0
                        ? "Be the first client to publish a clear, protected opportunity."
                        : "Try a broader keyword or reset the category filter."}
                    </p>
                    {items.length === 0 ? (
                      <Link
                        href={user ? "/post" : "/signup"}
                        className="btn btn-primary mt-5"
                      >
                        {user ? "Post the first gig" : "Create an account"}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary mt-5"
                        onClick={() => {
                          setQuery("");
                          setCategory("All");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; the live detail page is routed below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MarketplaceGigDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [state] = useAppState();
  const [gig, setGig] = useState<MarketplaceGig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/gigs/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "This gig could not be loaded."),
        );
      setGig(payload.gig as MarketplaceGig);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This gig could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading)
    return (
      <AppLayout>
        <section className="page-shell py-8 sm:py-12">
          <div
            className="card h-[36rem] animate-pulse bg-muted-surface"
            role="status"
            aria-label="Loading gig details"
          />
        </section>
      </AppLayout>
    );
  if (error || !gig)
    return (
      <AppLayout>
        <section className="page-shell py-16">
          <div className="card mx-auto max-w-xl p-8 text-center" role="alert">
            <AlertCircle
              className="mx-auto size-9 text-destructive"
              aria-hidden="true"
            />
            <h1 className="mt-4 text-xl font-bold">Couldn’t open this gig</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {error || "This listing is unavailable."}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void load();
                }}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Try again
              </button>
              <Link href="/gigs" className="btn btn-primary">
                Browse gigs
              </Link>
            </div>
          </div>
        </section>
      </AppLayout>
    );

  const isOwner = user?.uid === gig.ownerId;
  const canApply =
    Boolean(user) && state.verificationStatus === "verified" && !isOwner;
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href="/gigs"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to gigs
        </Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <article className="card p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={gigStatusForDisplay(gig.status)} />
              <span className="text-sm text-muted">
                Posted {formatGigDate(gig.createdAt)}
              </span>
              <span className="rounded-md bg-muted-surface px-2.5 py-1.5 text-xs font-semibold text-secondary">
                {gig.country}
              </span>
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-4xl">
              {gig.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-secondary">
              {gig.summary}
            </p>
            <div className="my-8 grid gap-3 rounded-xl bg-muted-surface p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Budget
                </p>
                <p className="mt-1 font-mono text-lg font-bold">
                  {formatAmount(gig.budget, gig.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Due date
                </p>
                <p className="mt-1 font-semibold">
                  {formatDeadline(gig.deadline)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Category
                </p>
                <p className="mt-1 font-semibold">{gig.category}</p>
              </div>
            </div>
            <div className="max-w-prose">
              <h2 className="text-lg font-bold">About this gig</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-muted">
                {gig.description}
              </p>
              <h2 className="mt-8 text-lg font-bold">What happens next</h2>
              <ul className="mt-3 grid gap-3 text-sm leading-6 text-muted">
                {[
                  "Students apply with their verified CampusGig profile",
                  "The poster reviews applicants and chooses one student",
                  "Work begins only after the agreed amount is secured",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check
                      className="mt-1 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
              <span className="avatar">{initialsFor(gig.posterName)}</span>
              <div>
                <p className="font-semibold">Posted by {gig.posterName}</p>
                <p className="mt-1 text-sm text-muted">
                  {gig.posterUniversity} · Email verified
                </p>
              </div>
              <BadgeCheck
                className="ml-auto size-5 text-primary"
                aria-label="Verified poster"
              />
            </div>
          </article>
          <aside className="card p-5 sm:p-6 lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-muted">Gig budget</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatAmount(gig.budget, gig.currency)}
            </p>
            <div className="mt-5 rounded-lg bg-primary-soft p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <LockKeyhole className="size-4" aria-hidden="true" />
                Protected workflow
              </p>
              <p className="mt-2 text-xs leading-5 text-secondary">
                Funding is added only after the poster chooses a student.
              </p>
            </div>
            {isOwner ? (
              <div
                className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5"
                role="status"
              >
                <BriefcaseBusiness
                  className="size-7 text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 font-bold">This is your listing</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Track this gig from your poster workspace.
                </p>
                <Link href="/my-gigs" className="btn btn-primary mt-4 w-full">
                  Open my posted gigs
                </Link>
              </div>
            ) : !user ? (
              <div
                className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5"
                role="status"
              >
                <LockKeyhole
                  className="size-7 text-primary"
                  aria-hidden="true"
                />
                <p className="mt-3 font-bold">Log in to apply</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Browsing is public. Sign in when you are ready to apply.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(`/gigs/${gig.id}`)}`}
                    className="btn btn-primary w-full"
                  >
                    Log in
                  </Link>
                  <Link href="/signup" className="btn btn-secondary w-full">
                    Create account
                  </Link>
                </div>
              </div>
            ) : !canApply ? (
              <div
                className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
                role="status"
              >
                <UserCheck
                  className="size-7 text-amber-700"
                  aria-hidden="true"
                />
                <p className="mt-3 font-bold">Verify your school to apply</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  School verification—not profile completion—unlocks
                  applications.
                </p>
                <Link
                  href="/profile/verification"
                  className="btn btn-primary mt-4 w-full"
                >
                  Verify school
                </Link>
              </div>
            ) : (
              <div
                className="mt-6 rounded-xl border border-border bg-muted-surface p-5"
                role="status"
              >
                <FileText className="size-7 text-primary" aria-hidden="true" />
                <p className="mt-3 font-bold">
                  Applications are the next milestone
                </p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  This listing is live. Application persistence will be
                  connected in the next build step.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary mt-4 w-full"
                  disabled
                >
                  Apply soon
                </button>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-muted">
              {gig.applicantCount} application
              {gig.applicantCount === 1 ? "" : "s"}
            </p>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

// Retained temporarily for the simulated application workflow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GigDetailPage({ id }: { id: number }) {
  const gig = gigs.find((item) => item.id === id) ?? gigs[0];
  const { user } = useAuth();
  const [state, setState] = useAppState();
  const applied = state.applied.includes(gig.id);
  const canApply = Boolean(user) && state.verificationStatus === "verified";
  const [note, setNote] = useState("");
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canApply) return;
    setState((current) => ({
      ...current,
      applied: Array.from(new Set([...current.applied, gig.id])),
    }));
  };
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href="/gigs"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to gigs
        </Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <article className="card p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={gig.status} />
              <span className="text-sm text-muted">Posted {gig.posted}</span>
              <span className="rounded-md bg-muted-surface px-2.5 py-1.5 text-xs font-semibold text-secondary">
                {gig.country}
              </span>
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-4xl">
              {gig.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-secondary">
              {gig.summary}
            </p>
            <div className="my-8 grid gap-3 rounded-xl bg-muted-surface p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Budget
                </p>
                <p className="mt-1 font-mono text-lg font-bold">
                  {formatAmount(gig.price, gig.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Due date
                </p>
                <p className="mt-1 font-semibold">{gig.due}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Category
                </p>
                <p className="mt-1 font-semibold">{gig.category}</p>
              </div>
            </div>
            <div className="prose max-w-prose">
              <h2 className="text-lg font-bold">About this gig</h2>
              <p className="mt-3 leading-7 text-muted">{gig.description}</p>
              <h2 className="mt-8 text-lg font-bold">
                What success looks like
              </h2>
              <ul className="mt-3 grid gap-3 text-sm leading-6 text-muted">
                {[
                  "Deliverables match the agreed scope and file formats",
                  "Progress updates are shared inside CampusGig",
                  "Final work is submitted before the due date",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
              <span className="avatar">{gig.initials}</span>
              <div>
                <p className="font-semibold">Posted by {gig.poster}</p>
                <p className="mt-1 text-sm text-muted">
                  {gig.university} · Verified
                </p>
              </div>
              <BadgeCheck
                className="ml-auto size-5 text-primary"
                aria-label="Verified poster"
              />
            </div>
          </article>
          <aside className="card p-5 sm:p-6 lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-muted">Gig budget</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatAmount(gig.price, gig.currency)}
            </p>
            <div className="mt-5 rounded-lg bg-primary-soft p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <LockKeyhole className="size-4" />
                Protected by escrow
              </p>
              <p className="mt-2 text-xs leading-5 text-secondary">
                The client can fund with a supported local method or use USDC
                for cross-border settlement.
              </p>
            </div>
            {applied ? (
              <div
                className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5 text-center"
                role="status"
              >
                <CheckCircle2 className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-bold">Application sent</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  You can follow its status from My applications.
                </p>
                <Link
                  href="/applications"
                  className="btn btn-secondary mt-4 w-full"
                >
                  View my applications
                </Link>
              </div>
            ) : !user ? (
              <div
                className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5"
                role="status"
              >
                <LockKeyhole className="size-7 text-primary" />
                <p className="mt-3 font-bold">Log in to apply</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Browsing is public. Create an account or log in when you are
                  ready to apply.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link href="/login" className="btn btn-primary w-full">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn btn-secondary w-full">
                    Create account
                  </Link>
                </div>
              </div>
            ) : !canApply ? (
              <div
                className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
                role="status"
              >
                <UserCheck className="size-7 text-amber-700" />
                <p className="mt-3 font-bold">Verify your school to apply</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  Keep browsing freely. Only school verification is required
                  before sending an application; the rest of your profile can be
                  completed anytime.
                </p>
                <div className="mt-4 grid gap-2">
                  <Link href="/profile/edit" className="btn btn-primary w-full">
                    View verification status
                  </Link>
                  <Link href="/gigs" className="btn btn-secondary w-full">
                    Keep browsing
                  </Link>
                </div>
              </div>
            ) : (
              <form className="mt-6" onSubmit={apply}>
                <div className="field">
                  <label htmlFor="application-note">
                    Short note to the poster
                  </label>
                  <textarea
                    className="input"
                    id="application-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Mention your relevant experience and availability."
                    minLength={20}
                    required
                  />
                  <p className="field-hint">
                    Keep it specific. Minimum 20 characters.
                  </p>
                </div>
                <button type="submit" className="btn btn-primary mt-5 w-full">
                  Apply for this gig <ArrowRight className="size-4" />
                </button>
              </form>
            )}
            <p className="mt-4 text-center text-xs text-muted">
              {gig.applicants} verified students have applied
            </p>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; the live applications page is routed below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ApplicationsPage() {
  const [state, setState] = useAppState();
  const [uploading, setUploading] = useState(false);
  const submitWork = () => {
    setUploading(true);
    window.setTimeout(() => {
      setState((current) => ({ ...current, submitted: true }));
      setUploading(false);
    }, 700);
  };
  const applicationGigs = gigs.filter((gig) => state.applied.includes(gig.id));
  if (applicationGigs.length === 0)
    return (
      <AppLayout>
        <section className="page-shell py-8 sm:py-12">
          <PageHeader
            eyebrow="Student workspace"
            title="My applications"
            description="Track every application from submission through payment."
          />
          <div className="card mt-8 p-8 text-center sm:p-12">
            <FileText className="mx-auto size-9 text-muted" />
            <h2 className="mt-4 text-xl font-bold">No applications yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Browse available gigs, complete school verification, and send your
              first application.
            </p>
            <Link
              href={
                state.verificationStatus === "verified"
                  ? "/gigs"
                  : "/profile/verification"
              }
              className="btn btn-primary mt-5"
            >
              {state.verificationStatus === "verified"
                ? "Browse gigs"
                : "Complete verification"}
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Student workspace"
          title="My applications"
          description="Track every application and see exactly when a gig moves from accepted to funded, submitted, and paid."
          action={
            <Link href="/gigs" className="btn btn-primary">
              Browse more gigs
            </Link>
          }
        />
        <div className="mt-8 space-y-4">
          {applicationGigs.map((gig, index) => {
            const baseStatus: GigStatus =
              index === 0
                ? state.paymentReleased
                  ? "completed"
                  : state.submitted
                    ? "submitted"
                    : state.escrowSecured
                      ? "in progress"
                      : "accepted"
                : index === 1
                  ? "rejected"
                  : "applied";
            return (
              <article className="card p-5 sm:p-6" key={gig.id}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={baseStatus} />
                      <span className="text-xs text-muted">
                        Applied 12 Aug 2026
                      </span>
                    </div>
                    <h2 className="mt-4 text-lg font-bold">{gig.title}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {gig.poster} · {gig.university}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-bold">
                    {formatAmount(gig.price)}
                  </p>
                </div>
                {index === 0 && (
                  <div className="mt-6 rounded-xl bg-muted-surface p-4">
                    <div
                      className="grid grid-cols-4 gap-2"
                      aria-label="Gig progress"
                    >
                      {[
                        ["Accepted", true],
                        ["Funded", state.escrowSecured],
                        ["Submitted", state.submitted],
                        ["Paid", state.paymentReleased],
                      ].map(([label, done]) => (
                        <div key={String(label)}>
                          <div
                            className={`h-1.5 rounded-full ${done ? "bg-primary" : "bg-border"}`}
                          />
                          <p
                            className={`mt-2 text-xs font-semibold ${done ? "text-primary" : "text-muted"}`}
                          >
                            {String(label)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {!state.escrowSecured && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-secondary">
                        <Clock3 className="size-4 text-warning" />
                        Accepted. Waiting for the poster to fund escrow.
                      </p>
                    )}
                    {state.escrowSecured && !state.submitted && (
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-secondary">
                          Funds secured. You can now complete and submit the
                          work.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={submitWork}
                          disabled={uploading}
                        >
                          {uploading ? "Submitting…" : "Submit work"}
                        </button>
                      </div>
                    )}
                    {state.submitted && !state.paymentReleased && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-secondary">
                        <UploadCloud className="size-4 text-warning" />
                        Work submitted. Waiting for client review.
                      </p>
                    )}
                    {state.paymentReleased && (
                      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary">
                        <CheckCircle2 className="size-4" />
                        Payment released to your CampusGig wallet.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </AppLayout>
  );
}

function ProfileWorkspacePage() {
  const [state] = useAppState();
  const { profile } = useAuth();
  const [walletCopyStatus, setWalletCopyStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const verified = state.verificationStatus === "verified";
  const pending = state.verificationStatus === "pending";
  const skills = state.profileSkills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  const profileLinks = [
    ["Portfolio", state.profilePortfolio],
    ["LinkedIn", state.profileLinkedIn],
    ["GitHub", state.profileGitHub],
  ].filter(([, href]) => Boolean(href));
  const walletAddress = profile?.walletAddress ?? "";
  const visibleWalletAddress = walletAddress
    ? `${walletAddress.slice(0, 7)}...${walletAddress.slice(-7)}`
    : "Preparing wallet…";

  const copyWalletAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setWalletCopyStatus("copied");
      window.setTimeout(() => setWalletCopyStatus("idle"), 1800);
    } catch {
      setWalletCopyStatus("error");
    }
  };

  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Account"
          title="Your profile"
          description="Keep this as complete as it is useful to you. School verification—not profile completion—controls gig applications."
          action={
            <Link href="/profile/edit" className="btn btn-secondary">
              Edit profile
            </Link>
          }
        />

        {!verified && (
          <div
            className={`mt-8 rounded-xl border p-5 ${pending ? "border-amber-200 bg-amber-50" : "border-primary/20 bg-primary-soft"}`}
            role="status"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {pending ? (
                  <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                ) : (
                  <UserCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                )}
                <div>
                  <p className="font-bold">
                    {pending
                      ? "School verification is pending"
                      : "Verify your school when you’re ready to apply"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-secondary">
                    Browsing is open. Verification is only required when you
                    want to send an application.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/gigs" className="btn btn-secondary">
                  Browse gigs
                </Link>
                <Link href="/profile/verification" className="btn btn-primary">
                  {pending ? "Check status" : "Verify school"}
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <article className="card p-5 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <ProfileAvatar
                  name={state.profileName}
                  src={state.profilePhotoDataUrl}
                  large
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold">{state.profileName}</h2>
                    {verified ? (
                      <span className="status status-completed">
                        <BadgeCheck className="size-3.5" />
                        Verified student
                      </span>
                    ) : (
                      <span className="status status-submitted">
                        <Clock3 className="size-3.5" />
                        {pending ? "Pending" : "Not verified"}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-secondary">
                    {state.profileHeadline ||
                      "Add a short professional headline"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {state.profileUniversity} · {state.profileCourse}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {state.profileAvailability}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 border-t border-border pt-7 sm:grid-cols-3">
                {[
                  ["Completed gigs", verified ? "9" : "0"],
                  ["Client rating", verified ? "4.9 / 5" : "—"],
                  ["On-time delivery", verified ? "100%" : "—"],
                ].map(([label, value]) => (
                  <div className="rounded-lg bg-muted-surface p-4" key={label}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="font-bold">About</h3>
                <p className="mt-3 max-w-prose leading-7 text-muted">
                  {state.profileBio || "Add a short bio whenever you’re ready."}
                </p>
              </div>

              {skills.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-bold">Skills</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        className="rounded-md bg-muted-surface px-3 py-2 text-sm font-semibold text-secondary"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profileLinks.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
                  {profileLinks.map(([label, href]) => (
                    <a
                      className="btn btn-secondary"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      key={label}
                    >
                      {label}
                      <ArrowRight className="size-4" />
                    </a>
                  ))}
                </div>
              )}
            </article>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <WalletCards
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />
                  <h3 className="font-bold">CampusGig wallet</h3>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                  Devnet
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                Your account address for USDC gigs. CampusGig handles signing
                and network fees.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted-surface p-2">
                <code
                  className="min-w-0 flex-1 truncate px-2 font-mono text-sm font-semibold"
                  title={walletAddress || undefined}
                >
                  {visibleWalletAddress}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary min-h-10 shrink-0 px-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={copyWalletAddress}
                  disabled={!walletAddress}
                  aria-label="Copy wallet address"
                >
                  {walletCopyStatus === "copied" ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {walletCopyStatus === "copied" ? "Copied" : "Copy"}
                </button>
              </div>
              {walletCopyStatus === "error" && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  Could not copy the address. Select it and copy manually.
                </p>
              )}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Banknote className="size-5 text-primary" />
                <h3 className="font-bold">Earnings</h3>
              </div>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Available balance
                  </dt>
                  <dd className="mt-1 font-mono text-lg font-bold">
                    {verified ? "540 USDC" : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Payout preference
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Local payout or USDC
                  </dd>
                </div>
              </dl>
            </div>
            <div className="card p-5">
              <h3 className="font-bold">Keep improving it</h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                Your bio, links, skills, and photo are optional. Add or change
                them whenever your work evolves.
              </p>
              <Link
                href="/profile/edit"
                className="btn btn-secondary mt-4 w-full"
              >
                Edit profile
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

function EditProfileWorkspacePage() {
  const [state, setState] = useAppState();
  const { saveProfile: persistProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [country, setCountry] = useState(state.profileCountry);
  const [university, setUniversity] = useState(state.profileUniversity);
  const [course, setCourse] = useState(state.profileCourse);
  const [name, setName] = useState(state.profileName);
  const [headline, setHeadline] = useState(state.profileHeadline);
  const [bio, setBio] = useState(state.profileBio);
  const [skills, setSkills] = useState(state.profileSkills);
  const [portfolio, setPortfolio] = useState(state.profilePortfolio);
  const [linkedIn, setLinkedIn] = useState(state.profileLinkedIn);
  const [gitHub, setGitHub] = useState(state.profileGitHub);
  const [availability, setAvailability] = useState(state.profileAvailability);
  const [photoName, setPhotoName] = useState(state.profilePhotoName);
  const [photoDataUrl, setPhotoDataUrl] = useState(state.profilePhotoDataUrl);
  const [photoError, setPhotoError] = useState("");

  const changeCountry = (nextCountry: string) => {
    setCountry(nextCountry);
    setUniversity(institutionsByCountry[nextCountry][0]);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await persistProfile({
        fullName: name,
        country,
        university,
        course,
        headline,
        bio,
        skills,
        portfolio,
        linkedIn,
        gitHub,
        availability,
        photoName,
        photoDataUrl,
      });
      setState((current) => ({
        ...current,
        profileReady: true,
        profileCountry: country,
        profileUniversity: university,
        profileCourse: course,
        profileName: name,
        profileHeadline: headline,
        profileBio: bio,
        profileSkills: skills,
        profilePortfolio: portfolio,
        profileLinkedIn: linkedIn,
        profileGitHub: gitHub,
        profileAvailability: availability,
        profilePhotoName: photoName,
        profilePhotoDataUrl: photoDataUrl,
      }));
      setSaved(true);
      setBusy(false);
      if (
        new URLSearchParams(window.location.search).get("onboarding") === "1"
      ) {
        navigate("/gigs");
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (saveError) {
      setError(firebaseErrorMessage(saveError));
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError("");
    try {
      const nextPhoto = await compressedImage(file, 360, 0.78, 260_000);
      setPhotoName(file.name);
      setPhotoDataUrl(nextPhoto);
    } catch (photoIssue) {
      setPhotoError(
        photoIssue instanceof Error
          ? photoIssue.message
          : "That image could not be prepared.",
      );
    }
  };

  return (
    <AppLayout>
      <section className="page-shell max-w-5xl py-8 sm:py-12">
        <Link
          href="/profile"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to profile
        </Link>
        <PageHeader
          eyebrow="Profile"
          title="Edit your profile"
          description="Add what helps people understand your work. Save now, skip anything, and return whenever you like."
          action={
            <Link href="/gigs" className="btn btn-secondary">
              Browse gigs
            </Link>
          }
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [
              CheckCircle2,
              "Browse immediately",
              "Profile completion never blocks browsing.",
            ],
            [
              UserCheck,
              "Verify before applying",
              "Only school verification unlocks applications.",
            ],
            [
              Sparkles,
              "Improve over time",
              "Photo, skills, and links are always optional.",
            ],
          ].map(([Icon, title, copy]) => {
            const ItemIcon = Icon as typeof CheckCircle2;
            return (
              <div
                className="rounded-xl border border-border bg-surface p-4"
                key={String(title)}
              >
                <ItemIcon className="size-5 text-primary" />
                <p className="mt-3 text-sm font-bold">{String(title)}</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {String(copy)}
                </p>
              </div>
            );
          })}
        </div>

        {saved && (
          <div
            className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-4 text-sm font-semibold text-primary"
            role="status"
          >
            <CheckCircle2 className="mr-2 inline size-4" />
            Profile saved. Keep editing, browse gigs, or come back later.
          </div>
        )}
        {error && (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
          </div>
        )}

        <form className="mt-6 space-y-6" onSubmit={saveProfile}>
          <section
            className="card p-5 sm:p-8"
            aria-labelledby="profile-photo-heading"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProfileAvatar name={name} src={photoDataUrl} large />
              <div className="min-w-0 flex-1">
                <h2 id="profile-photo-heading" className="text-lg font-bold">
                  Display picture{" "}
                  <span className="text-sm font-normal text-muted">
                    (optional)
                  </span>
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  A clear face photo helps clients recognise you. You can add or
                  replace it later.
                </p>
                <label
                  htmlFor="profile-photo"
                  className="btn btn-secondary mt-4 cursor-pointer"
                >
                  <UploadCloud className="size-4" />
                  {photoName ? "Change photo" : "Choose photo"}
                </label>
                <input
                  className="sr-only"
                  id="profile-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    void choosePhoto(event.target.files?.[0]);
                  }}
                />
                {photoName && (
                  <p className="mt-2 truncate text-xs text-muted">
                    Selected: {photoName}
                  </p>
                )}
                {photoError && (
                  <p
                    className="mt-2 text-xs font-semibold text-destructive"
                    role="alert"
                  >
                    {photoError}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section
            className="card p-5 sm:p-8"
            aria-labelledby="basic-details-heading"
          >
            <div>
              <h2 id="basic-details-heading" className="text-lg font-bold">
                Basic details
              </h2>
              <p className="mt-1 text-sm text-muted">
                Keep it short. You can refine this later.
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="profile-name">Display name</label>
                <input
                  className="input"
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-headline">
                  Professional headline{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  className="input"
                  id="profile-headline"
                  type="text"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="Frontend developer and video editor"
                />
              </div>
            </div>
            <div className="field mt-5">
              <label htmlFor="profile-bio">
                About you{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                className="input min-h-32"
                id="profile-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={400}
                placeholder="A few lines about the work you enjoy and what you’re good at."
              />
              <p className="field-hint">Up to 400 characters.</p>
            </div>
            <div className="field mt-5">
              <label htmlFor="profile-availability">
                Availability{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <select
                className="input"
                id="profile-availability"
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
              >
                <option>Available for short projects</option>
                <option>Available on weekends</option>
                <option>Open to remote work</option>
                <option>Not taking new work</option>
              </select>
            </div>
          </section>

          <section
            className="card p-5 sm:p-8"
            aria-labelledby="work-links-heading"
          >
            <div>
              <h2 id="work-links-heading" className="text-lg font-bold">
                Skills and work links
              </h2>
              <p className="mt-1 text-sm text-muted">
                Everything in this section is optional.
              </p>
            </div>
            <div className="field mt-6">
              <label htmlFor="profile-skills">Skills</label>
              <input
                className="input"
                id="profile-skills"
                type="text"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                placeholder="React, Canva, Research, Video editing"
              />
              <p className="field-hint">Separate skills with commas.</p>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="profile-portfolio">Portfolio</label>
                <input
                  className="input"
                  id="profile-portfolio"
                  type="url"
                  inputMode="url"
                  value={portfolio}
                  onChange={(event) => setPortfolio(event.target.value)}
                  placeholder="https://yourportfolio.com"
                />
              </div>
              <div className="field">
                <label htmlFor="profile-linkedin">LinkedIn</label>
                <input
                  className="input"
                  id="profile-linkedin"
                  type="url"
                  inputMode="url"
                  value={linkedIn}
                  onChange={(event) => setLinkedIn(event.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                />
              </div>
              <div className="field">
                <label htmlFor="profile-github">
                  GitHub, Behance, or Dribbble
                </label>
                <input
                  className="input"
                  id="profile-github"
                  type="url"
                  inputMode="url"
                  value={gitHub}
                  onChange={(event) => setGitHub(event.target.value)}
                  placeholder="https://github.com/yourname"
                />
              </div>
            </div>
          </section>

          <section
            className="card p-5 sm:p-8"
            aria-labelledby="school-details-heading"
          >
            <div>
              <h2 id="school-details-heading" className="text-lg font-bold">
                School details
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Useful on your profile and required only when you choose to
                verify for applications.
              </p>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className="field">
                <label htmlFor="profile-country">Country</label>
                <select
                  className="input"
                  id="profile-country"
                  value={country}
                  onChange={(event) => changeCountry(event.target.value)}
                >
                  {countries.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="profile-university">Institution</label>
                <select
                  className="input"
                  id="profile-university"
                  value={university}
                  onChange={(event) => setUniversity(event.target.value)}
                >
                  {institutionsByCountry[country].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="profile-course">
                  Course of study{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  className="input"
                  id="profile-course"
                  type="text"
                  autoComplete="organization-title"
                  value={course}
                  onChange={(event) => setCourse(event.target.value)}
                  placeholder="Computer Science"
                />
              </div>
            </div>
          </section>

          <div className="sticky bottom-4 z-20 flex flex-col-reverse gap-3 rounded-xl border border-border bg-surface/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted">
              Save whatever you’ve added. Empty optional fields are fine.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/gigs" className="btn btn-secondary">
                Browse gigs
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>
        </form>

        <section
          className="card mt-6 p-5 sm:p-8"
          aria-labelledby="school-verification-heading"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <UserCheck className="size-5" />
            </span>
            <div>
              <h2
                id="school-verification-heading"
                className="text-lg font-bold"
              >
                School verification
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Use a school email or submit a student ID. You can do this
                whenever you are ready to apply.
              </p>
            </div>
          </div>
          <div
            className={`mt-6 rounded-xl border p-5 ${state.verificationStatus === "pending" ? "border-amber-200 bg-amber-50" : state.verificationStatus === "verified" ? "border-primary/20 bg-primary-soft" : "border-border bg-muted-surface"}`}
            role="status"
          >
            <p className="font-bold">
              {state.verificationStatus === "verified"
                ? "Student status verified"
                : state.verificationStatus === "pending"
                  ? "Verification in progress"
                  : "Verification has not started"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {state.verificationStatus === "verified"
                ? "You can apply to open gigs."
                : state.verificationStatus === "pending"
                  ? "Continue your school email check or wait for an administrator to review your ID."
                  : "Your profile remains editable and browsing stays open."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/profile/verification" className="btn btn-primary">
                {state.verificationStatus === "verified"
                  ? "View verification"
                  : state.verificationStatus === "pending"
                    ? "Continue verification"
                    : "Start verification"}
              </Link>
              <Link href="/gigs" className="btn btn-secondary">
                Browse gigs
              </Link>
            </div>
          </div>
        </section>
      </section>
    </AppLayout>
  );
}

function StudentVerificationPage() {
  const [state, setState] = useAppState();
  const { user, profile, refreshProfile } = useAuth();
  const [method, setMethod] = useState<"school-email" | "student-id">(
    profile?.verificationMethod || "school-email",
  );
  const [schoolEmail, setSchoolEmail] = useState(profile?.schoolEmail || "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(
    profile?.verificationMethod === "school-email" &&
      profile?.verificationStatus === "pending",
  );
  const [idImageDataUrl, setIdImageDataUrl] = useState("");
  const [idFileName, setIdFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [replaceId, setReplaceId] = useState(false);

  const authenticatedRequest = async (
    url: string,
    body: Record<string, unknown>,
  ) => {
    if (!user) throw new Error("Log in to continue.");
    const token = await user.getIdToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        String(payload.error ?? "Verification could not be completed."),
      );
    return payload;
  };

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authenticatedRequest("/api/student-verification/request-code", {
        schoolEmail,
      });
      await refreshProfile();
      setState((current) => ({
        ...current,
        verificationStatus: "pending",
        verificationMethod: "school-email",
      }));
      setCodeSent(true);
      setNotice(`A six-digit code was sent to ${schoolEmail}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authenticatedRequest("/api/student-verification/verify-code", {
        code,
      });
      await refreshProfile();
      setState((current) => ({
        ...current,
        verificationStatus: "verified",
        verificationMethod: "school-email",
      }));
      setNotice("Your student status is verified. You can now apply for gigs.");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "That code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseId = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const image = await compressedImage(file, 1200, 0.74, 760_000);
      setIdImageDataUrl(image);
      setIdFileName(file.name);
    } catch (imageError) {
      setIdImageDataUrl("");
      setIdFileName("");
      setError(
        imageError instanceof Error
          ? imageError.message
          : "That ID image could not be prepared.",
      );
    }
  };

  const submitId = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!idImageDataUrl) {
      setError("Choose a clear image of your student ID.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authenticatedRequest("/api/student-verification/submit-id", {
        imageDataUrl: idImageDataUrl,
        fileName: idFileName,
      });
      await refreshProfile();
      setState((current) => ({
        ...current,
        verificationStatus: "pending",
        verificationMethod: "student-id",
      }));
      setNotice("Your student ID was submitted for admin review.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your student ID could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verified =
    profile?.studentVerified || state.verificationStatus === "verified";
  const idPending =
    !replaceId &&
    !verified &&
    (profile?.verificationStatus === "pending" ||
      state.verificationStatus === "pending") &&
    (profile?.verificationMethod === "student-id" ||
      state.verificationMethod === "student-id");
  const schoolReady = Boolean(profile?.country && profile?.university);

  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <Link
          href="/profile"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to profile
        </Link>
        <PageHeader
          eyebrow="Student verification"
          title="Verify your student status"
          description="Do this when you want to apply for gigs. Your normal profile can be updated separately at any time."
          action={
            <Link href="/gigs" className="btn btn-secondary">
              Do this later
            </Link>
          }
        />

        <ol
          className="mt-8 grid gap-3 sm:grid-cols-3"
          aria-label="Verification progress"
        >
          {[
            ["1", "Account email", Boolean(user?.emailVerified)],
            ["2", "School details", schoolReady],
            ["3", "Student status", verified],
          ].map(([number, label, done]) => (
            <li
              className={`rounded-xl border p-4 ${done ? "border-primary/20 bg-primary-soft" : "border-border bg-surface"}`}
              key={String(label)}
            >
              <span
                className={`grid size-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-primary text-white" : "bg-muted-surface text-muted"}`}
              >
                {done ? <Check className="size-4" /> : String(number)}
              </span>
              <p className="mt-3 text-sm font-semibold">{String(label)}</p>
            </li>
          ))}
        </ol>

        {error && (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
            <button
              type="button"
              className="ml-3 font-bold underline"
              onClick={() => setError("")}
            >
              Dismiss
            </button>
          </div>
        )}
        {notice && (
          <div
            className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-4 text-sm font-semibold text-primary"
            role="status"
          >
            <CheckCircle2 className="mr-2 inline size-4" />
            {notice}
          </div>
        )}

        {!schoolReady ? (
          <div className="card mt-6 p-6 sm:p-8">
            <GraduationCap className="size-8 text-primary" />
            <h2 className="mt-4 text-xl font-bold">Add your school first</h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
              Choose your country and institution on your profile. You can leave
              every other optional field empty.
            </p>
            <Link href="/profile/edit" className="btn btn-primary mt-5">
              Add school details
            </Link>
          </div>
        ) : verified ? (
          <div className="card mt-6 p-6 text-center sm:p-10" role="status">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
              <BadgeCheck className="size-8" />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Student status verified</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
              Your verified badge is active and applications are unlocked.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/gigs" className="btn btn-primary">
                Browse gigs
              </Link>
              <Link href="/profile" className="btn btn-secondary">
                View profile
              </Link>
            </div>
          </div>
        ) : idPending ? (
          <div className="card mt-6 p-6 sm:p-8" role="status">
            <Clock3 className="size-8 text-amber-700" />
            <h2 className="mt-4 text-xl font-bold">Student ID under review</h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
              An administrator can now review your submission. You can keep
              browsing while the decision is pending.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/gigs" className="btn btn-primary">
                Browse gigs
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setReplaceId(true);
                  setMethod("student-id");
                }}
              >
                Replace submission
              </button>
            </div>
          </div>
        ) : (
          <div className="card mt-6 p-5 sm:p-8">
            <fieldset className="field">
              <legend>Choose a verification method</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label
                  className={`choice-card ${method === "school-email" ? "choice-card-active" : ""}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="verification-method"
                    value="school-email"
                    checked={method === "school-email"}
                    onChange={() => setMethod("school-email")}
                  />
                  <span className="choice-icon">
                    <BadgeCheck className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      School email
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      Fastest. Receive a six-digit code at your institution
                      email.
                    </span>
                  </span>
                </label>
                <label
                  className={`choice-card ${method === "student-id" ? "choice-card-active" : ""}`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="verification-method"
                    value="student-id"
                    checked={method === "student-id"}
                    onChange={() => setMethod("student-id")}
                  />
                  <span className="choice-icon">
                    <FileCheck2 className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      Student ID
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      Submit an ID image for manual admin review.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {method === "school-email" ? (
              <div className="mt-7 space-y-6">
                <form onSubmit={requestCode} className="space-y-4">
                  <div className="field">
                    <label htmlFor="school-verification-email">
                      Institution email
                    </label>
                    <input
                      className="input"
                      id="school-verification-email"
                      type="email"
                      autoComplete="email"
                      spellCheck={false}
                      value={schoolEmail}
                      onChange={(event) => setSchoolEmail(event.target.value)}
                      placeholder="you@university.edu"
                      required
                    />
                    <p className="field-hint">
                      Use an address issued by {profile?.university}.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy
                      ? "Sending code…"
                      : codeSent
                        ? "Send a new code"
                        : "Send verification code"}
                  </button>
                </form>
                {codeSent && (
                  <form
                    onSubmit={verifyCode}
                    className="border-t border-border pt-6"
                  >
                    <div className="field">
                      <label htmlFor="school-verification-code">
                        Six-digit code
                      </label>
                      <input
                        className="input max-w-xs font-mono text-lg tracking-[.22em]"
                        id="school-verification-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={(event) =>
                          setCode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        placeholder="000000"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary mt-4"
                      disabled={busy || code.length !== 6}
                      aria-busy={busy}
                    >
                      {busy ? "Checking code…" : "Verify student email"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form className="mt-7 space-y-5" onSubmit={submitId}>
                <div className="field">
                  <label htmlFor="student-id-image">Student ID image</label>
                  <input
                    className="file-input"
                    id="student-id-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      void chooseId(event.target.files?.[0]);
                    }}
                    required={!idImageDataUrl}
                  />
                  <p className="field-hint">
                    JPG, PNG, or WebP. Cover unrelated numbers if your school ID
                    includes sensitive information.
                  </p>
                </div>
                {idImageDataUrl && (
                  <div className="overflow-hidden rounded-xl border border-border bg-muted-surface p-3">
                    <div className="relative aspect-[16/9] max-w-md overflow-hidden rounded-lg bg-surface">
                      <NextImage
                        src={idImageDataUrl}
                        alt="Student ID preview"
                        fill
                        sizes="(max-width: 640px) 100vw, 448px"
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                    <p className="mt-2 truncate text-xs text-muted">
                      Ready to submit: {idFileName}
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !idImageDataUrl}
                  aria-busy={busy}
                >
                  {busy ? "Submitting ID…" : "Submit for review"}
                </button>
              </form>
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; it is intentionally not routed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ProfilePage() {
  const [state] = useAppState();
  const verified = state.verificationStatus === "verified";
  const pending = state.verificationStatus === "pending";
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Account"
          title="Your profile"
          description="Complete your school details and verification to build trust and apply for gigs."
          action={
            <Link href="/profile/edit" className="btn btn-secondary">
              Update profile
            </Link>
          }
        />
        {!verified && (
          <div
            className={`mt-8 rounded-xl border p-5 ${pending ? "border-amber-200 bg-amber-50" : "border-primary/20 bg-primary-soft"}`}
            role="status"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {pending ? (
                  <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                ) : (
                  <UserCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                )}
                <div>
                  <p className="font-bold">
                    {pending
                      ? "School verification is pending"
                      : "Verify your school to apply"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-secondary">
                    {pending
                      ? "Applications remain locked while we confirm your school email or student ID."
                      : "Add your country and university, then verify with a school email or student ID."}
                  </p>
                </div>
              </div>
              <Link href="/profile/edit" className="btn btn-primary shrink-0">
                {pending ? "Check verification" : "Complete verification"}
              </Link>
            </div>
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="card p-5 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="grid size-20 place-items-center rounded-2xl bg-primary-soft text-xl font-bold text-primary">
                TO
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold">Tobi Okafor</h2>
                  {verified ? (
                    <span className="status status-completed">
                      <BadgeCheck className="size-3.5" />
                      Verified student
                    </span>
                  ) : (
                    <span className="status status-submitted">
                      <Clock3 className="size-3.5" />
                      {pending ? "Pending review" : "Not verified"}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-muted">
                  {state.profileReady
                    ? "University of Lagos · Computer Science"
                    : "School details not completed"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Member since August 2026
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-4 border-t border-border pt-7 sm:grid-cols-3">
              {[
                ["Completed gigs", verified ? "9" : "0"],
                ["Client rating", verified ? "4.9 / 5" : "—"],
                ["On-time delivery", verified ? "100%" : "—"],
              ].map(([label, value]) => (
                <div className="rounded-lg bg-muted-surface p-4" key={label}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <h3 className="font-bold">About</h3>
              <p className="mt-3 max-w-prose leading-7 text-muted">
                Frontend developer and video editor helping campus organisations
                ship clean digital work. Available for short projects alongside
                coursework.
              </p>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <Banknote className="size-5 text-primary" />
                <h3 className="font-bold">Earnings</h3>
              </div>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Available balance
                  </dt>
                  <dd className="mt-1 font-mono text-lg font-bold">
                    {verified ? "540 USDC" : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                    Payout preference
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    Choose after verification
                  </dd>
                </div>
              </dl>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <WalletCards className="size-5 text-primary" />
                <h3 className="font-bold">Payment options</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">
                Receive supported local payouts, or add a Solana wallet for
                optional USDC settlement.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; it is intentionally not routed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function UpdateProfilePage() {
  const [state, setState] = useAppState();
  const [saved, setSaved] = useState(false);
  const [country, setCountry] = useState(state.profileCountry);
  const [university, setUniversity] = useState(state.profileUniversity);
  const [method, setMethod] = useState<"school-email" | "student-id">(
    "school-email",
  );
  const [busy, setBusy] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState((current) => ({
      ...current,
      profileReady: true,
      profileCountry: country,
      profileUniversity: university,
    }));
    setSaved(true);
  };
  const submitVerification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        profileReady: true,
        verificationStatus: "pending",
        verificationMethod: method,
      }));
      setBusy(false);
    }, 650);
  };
  const confirmSchoolEmail = () => {
    setBusy(true);
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        profileReady: true,
        verificationStatus: "verified",
        verificationMethod: "school-email",
      }));
      setBusy(false);
    }, 500);
  };
  const changeCountry = (nextCountry: string) => {
    setCountry(nextCountry);
    setUniversity(institutionsByCountry[nextCountry][0]);
  };
  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <Link
          href="/profile"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to profile
        </Link>
        <PageHeader
          eyebrow="Account setup"
          title="Complete your profile"
          description="Your country determines the institutions we show. School verification unlocks gig applications."
        />
        <ol
          className="mt-8 grid gap-3 sm:grid-cols-3"
          aria-label="Account setup progress"
        >
          {[
            ["1", "Account created", true],
            ["2", "Profile details", state.profileReady],
            ["3", "School verified", state.verificationStatus === "verified"],
          ].map(([number, label, done]) => (
            <li
              className={`rounded-xl border p-4 ${done ? "border-primary/20 bg-primary-soft" : "border-border bg-surface"}`}
              key={String(label)}
            >
              <span
                className={`grid size-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-primary text-white" : "bg-muted-surface text-muted"}`}
              >
                {done ? <Check className="size-4" /> : String(number)}
              </span>
              <p className="mt-3 text-sm font-semibold">{String(label)}</p>
            </li>
          ))}
        </ol>
        <form className="card mt-6 space-y-6 p-5 sm:p-8" onSubmit={submit}>
          {saved && (
            <div
              className="rounded-lg bg-primary-soft p-4 text-sm font-semibold text-primary"
              role="status"
            >
              <CheckCircle2 className="mr-2 inline size-4" />
              Profile details saved.
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="edit-name">Full name</label>
              <input
                className="input"
                id="edit-name"
                type="text"
                autoComplete="name"
                defaultValue="Tobi Okafor"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="edit-country">Country</label>
              <select
                className="input"
                id="edit-country"
                value={country}
                onChange={(event) => changeCountry(event.target.value)}
                required
              >
                {countries.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="edit-university">Institution</label>
              <select
                className="input"
                id="edit-university"
                value={university}
                onChange={(event) => setUniversity(event.target.value)}
                required
              >
                {institutionsByCountry[country].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <p className="field-hint">Institutions shown for {country}.</p>
            </div>
            <div className="field">
              <label htmlFor="edit-course">Course of study</label>
              <input
                className="input"
                id="edit-course"
                type="text"
                autoComplete="organization-title"
                defaultValue="Computer Science"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="edit-bio">About you</label>
            <textarea
              className="input"
              id="edit-bio"
              defaultValue="Frontend developer and video editor helping campus organisations ship clean digital work."
              maxLength={240}
            />
            <p className="field-hint">Up to 240 characters.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-secondary">
              Save profile details
            </button>
          </div>
        </form>
        <div className="card mt-6 p-5 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <UserCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">School verification</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Required only for students who want to apply for gigs.
              </p>
            </div>
          </div>
          {state.verificationStatus === "verified" ? (
            <div
              className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5"
              role="status"
            >
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-bold">Student status verified</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Your school verification is complete. You can now apply for
                    gigs.
                  </p>
                  <Link href="/gigs" className="btn btn-primary mt-4">
                    Browse gigs
                  </Link>
                </div>
              </div>
            </div>
          ) : state.verificationStatus === "pending" ? (
            <div
              className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
              role="status"
            >
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold">Verification pending</p>
                  <p className="mt-1 text-sm leading-6 text-secondary">
                    {state.verificationMethod === "school-email"
                      ? "Open the verification link sent to your school inbox, then check your status here."
                      : "Your student ID was submitted for review. We’ll notify you when it is approved."}
                  </p>
                  {state.verificationMethod === "school-email" && (
                    <button
                      type="button"
                      className="btn btn-primary mt-4"
                      onClick={confirmSchoolEmail}
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {busy ? "Checking…" : "I verified my school email"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submitVerification}>
              <fieldset className="field">
                <legend>Choose a verification method</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      "school-email",
                      BadgeCheck,
                      "School email",
                      "Get a verification link at your institution email.",
                    ],
                    [
                      "student-id",
                      FileCheck2,
                      "Student ID",
                      "Upload a clear ID image for manual review.",
                    ],
                  ].map(([value, Icon, label, copy]) => {
                    const ItemIcon = Icon as typeof BadgeCheck;
                    return (
                      <label
                        key={String(value)}
                        className={`choice-card ${method === value ? "choice-card-active" : ""}`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="verification-method"
                          value={String(value)}
                          checked={method === value}
                          onChange={() =>
                            setMethod(value as "school-email" | "student-id")
                          }
                        />
                        <span className="choice-icon">
                          <ItemIcon className="size-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {String(label)}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-muted">
                            {String(copy)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {method === "school-email" ? (
                <div className="field">
                  <label htmlFor="school-email">School email</label>
                  <input
                    className="input"
                    id="school-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="name@university.edu"
                    required
                  />
                  <p className="field-hint">
                    We’ll send a one-time verification link.
                  </p>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="student-id">Student ID</label>
                  <input
                    className="file-input"
                    id="student-id"
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    required
                  />
                  <p className="field-hint">
                    JPG, PNG, or PDF. Your document is used only for
                    verification.
                  </p>
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <>
                    <Clock3 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : method === "school-email" ? (
                  "Send verification link"
                ) : (
                  "Submit student ID"
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </AppLayout>
  );
}

function PostGigLivePage() {
  const { user, profile } = useAuth();
  const [createdGig, setCreatedGig] = useState<MarketplaceGig | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [country, setCountry] = useState(
    profile?.country && currencyByCountry[profile.country]
      ? profile.country
      : "Nigeria",
  );
  const [settlementPreference, setSettlementPreference] =
    useState<SettlementPreference>("local");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currency =
    settlementPreference === "usdc" ? "USDC" : currencyByCountry[country];
  const earliestDeadline = defaultEarliestGigDeadline;

  const changeBudget = (value: string) => {
    const next = value.replace(/,/g, "");
    const valid =
      settlementPreference === "usdc"
        ? /^\d{0,9}(\.\d{0,2})?$/.test(next)
        : /^\d{0,12}$/.test(next);
    if (valid) setBudget(next);
  };

  const chooseSettlement = (next: SettlementPreference) => {
    setSettlementPreference(next);
    setBudget("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/gigs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          summary,
          description,
          budget: Number(budget),
          country,
          category,
          deadline,
          settlementPreference,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Your gig could not be published."),
        );
      setCreatedGig(payload.gig as MarketplaceGig);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your gig could not be published.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (createdGig)
    return (
      <AppLayout>
        <section className="page-shell max-w-3xl py-10 sm:py-16">
          <div className="card p-7 text-center sm:p-10" role="status">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-primary">
              Published
            </p>
            <h1 className="mt-2 text-3xl font-bold">Your gig is live</h1>
            <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">
              Students can now find “{createdGig.title}” and submit
              applications.
            </p>
            <dl className="mx-auto mt-6 grid max-w-lg gap-3 rounded-xl bg-muted-surface p-4 text-left sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Budget
                </dt>
                <dd className="mt-1 font-mono font-bold">
                  {formatAmount(createdGig.budget, createdGig.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                  Settlement
                </dt>
                <dd className="mt-1 font-semibold">
                  {createdGig.settlementPreference === "usdc"
                    ? "USDC on Solana"
                    : `${createdGig.currency} local payment`}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={`/gigs/${createdGig.id}`} className="btn btn-primary">
                View live listing
              </Link>
              <Link href="/my-gigs" className="btn btn-secondary">
                My posted gigs
              </Link>
            </div>
          </div>
        </section>
      </AppLayout>
    );

  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="Post a gig"
          description="Describe the work, choose how this gig will be settled, and publish it to the live marketplace."
          action={
            <Link href="/my-gigs" className="btn btn-secondary">
              My posted gigs
            </Link>
          }
        />
        <form className="card mt-8 space-y-7 p-5 sm:p-8" onSubmit={submit}>
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="mr-2 inline size-4" />
              {error}
            </div>
          )}
          <div className="rounded-xl bg-muted-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Posting as
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ProfileAvatar
                name={
                  profile?.fullName || user?.displayName || "CampusGig member"
                }
                src={profile?.photoDataUrl}
              />
              <div>
                <p className="text-sm font-semibold">
                  {profile?.fullName || user?.displayName || "CampusGig member"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {profile?.university || "Institution not added"} · Email
                  verified
                </p>
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="live-gig-title">Gig title</label>
            <input
              className="input"
              id="live-gig-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={8}
              maxLength={90}
              placeholder="Design social posts for a campus event"
              required
            />
            <p className="field-hint">Name the concrete result you need.</p>
          </div>
          <div className="field">
            <label htmlFor="live-gig-summary">Short summary</label>
            <textarea
              className="input min-h-24"
              id="live-gig-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              minLength={20}
              maxLength={220}
              placeholder="Create a two-week content pack for our campus innovation conference."
              required
            />
            <p className="field-hint">
              Shown on the browse page. {summary.length}/220 characters.
            </p>
          </div>
          <div className="field">
            <label htmlFor="live-gig-description">Full description</label>
            <textarea
              className="input min-h-44"
              id="live-gig-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={40}
              maxLength={1500}
              placeholder="Describe the deliverables, tools, references, and successful handoff."
              required
            />
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">
              How will this gig be paid?
            </legend>
            <p className="mt-1 text-sm text-muted">
              Choose the settlement currency now. You will fund it only after
              selecting a student.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label
                className={`choice-card ${settlementPreference === "local" ? "choice-card-active" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="settlement"
                  checked={settlementPreference === "local"}
                  onChange={() => chooseSettlement("local")}
                />
                <span className="choice-icon">
                  <WalletCards className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    Local currency
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Card, bank, or a supported local rail in the gig country.
                  </span>
                </span>
              </label>
              <label
                className={`choice-card ${settlementPreference === "usdc" ? "choice-card-active" : ""}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="settlement"
                  checked={settlementPreference === "usdc"}
                  onChange={() => chooseSettlement("usdc")}
                />
                <span className="choice-icon">
                  <CircleDollarSign className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    USDC on Solana
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    Best for cross-border gigs and transparent on-chain
                    settlement.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">
              Budget and delivery
            </legend>
            <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="field">
                <label htmlFor="live-gig-country">Gig country</label>
                <select
                  className="input"
                  id="live-gig-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  required
                >
                  {countries.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="live-gig-budget">Budget</label>
                <div className="relative">
                  <input
                    className="input pr-20 font-mono"
                    id="live-gig-budget"
                    type="text"
                    inputMode="decimal"
                    value={budget}
                    onChange={(event) => changeBudget(event.target.value)}
                    placeholder={
                      settlementPreference === "usdc" ? "50.00" : "35000"
                    }
                    required
                  />
                  <span className="pointer-events-none absolute right-3.5 top-3 font-mono text-sm font-bold text-muted">
                    {currency}
                  </span>
                </div>
                <p className="field-hint">
                  {budget
                    ? formatAmount(Number(budget), currency)
                    : `Amount in ${currency}`}
                  .
                </p>
              </div>
              <div className="field">
                <label htmlFor="live-gig-category">Category</label>
                <select
                  className="input"
                  id="live-gig-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  required
                >
                  <option value="">Choose one</option>
                  {GIG_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="live-gig-deadline">Deadline</label>
                <input
                  className="input"
                  id="live-gig-deadline"
                  type="date"
                  min={earliestDeadline}
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs leading-5 text-muted">
              <ShieldCheck className="mr-1 inline size-4 text-primary" />
              Publishing does not charge you. Funding begins after you select an
              applicant.
            </p>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <Clock3 className="size-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  Publish gig <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </AppLayout>
  );
}

// Retained as a design reference while the live posting flow is routed above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PostGigPage() {
  const { user, profile } = useAuth();
  const [createdGig, setCreatedGig] = useState<MarketplaceGig | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [country, setCountry] = useState(
    profile?.country && currencyByCountry[profile.country]
      ? profile.country
      : "Nigeria",
  );
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currency = currencyByCountry[country];
  const earliestDeadline = defaultEarliestGigDeadline;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/gigs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          summary,
          description,
          budget: Number(price),
          country,
          category,
          deadline,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Your gig could not be published."),
        );
      setCreatedGig(payload.gig as MarketplaceGig);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your gig could not be published.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCreatedGig(null);
    setTitle("");
    setSummary("");
    setDescription("");
    setPrice("");
    setCategory("");
    setDeadline("");
    setError("");
  };

  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="Post a gig"
          description="Publish a clear opportunity with a local-currency budget. It will appear in the live marketplace immediately."
          action={
            <Link href="/my-gigs" className="btn btn-secondary">
              My posted gigs
            </Link>
          }
        />
        {createdGig ? (
          <div className="card mt-8 p-6 text-center sm:p-10" role="status">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-primary">
              Published to Firestore
            </p>
            <h2 className="mt-2 text-2xl font-bold">Your gig is live</h2>
            <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">
              “{createdGig.title}” is now visible to everyone browsing
              CampusGig.
            </p>
            <div className="mx-auto mt-6 grid max-w-lg gap-3 rounded-xl bg-muted-surface p-4 text-left sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Budget
                </p>
                <p className="mt-1 font-mono font-bold">
                  {formatAmount(createdGig.budget, createdGig.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Deadline
                </p>
                <p className="mt-1 font-semibold">
                  {formatDeadline(createdGig.deadline)}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={`/gigs/${createdGig.id}`} className="btn btn-primary">
                View live listing
              </Link>
              <Link href="/my-gigs" className="btn btn-secondary">
                View my posted gigs
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={reset}
              >
                Post another gig
              </button>
            </div>
          </div>
        ) : (
          <form className="card mt-8 space-y-6 p-5 sm:p-8" onSubmit={submit}>
            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                role="alert"
              >
                <AlertCircle
                  className="mr-2 inline size-4"
                  aria-hidden="true"
                />
                {error}
              </div>
            )}
            <div className="rounded-xl bg-muted-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Posting as
              </p>
              <div className="mt-3 flex items-center gap-3">
                <ProfileAvatar
                  name={
                    profile?.fullName || user?.displayName || "CampusGig member"
                  }
                  src={profile?.photoDataUrl}
                />
                <div>
                  <p className="text-sm font-semibold">
                    {profile?.fullName ||
                      user?.displayName ||
                      "CampusGig member"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {profile?.university || "Institution not added"} · Email
                    verified
                  </p>
                </div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="gig-title">
                Gig title <span aria-hidden="true">*</span>
              </label>
              <input
                className="input"
                id="gig-title"
                name="title"
                type="text"
                autoComplete="off"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Design social posts for a campus event"
                minLength={8}
                maxLength={90}
                required
              />
              <p className="field-hint">Name the concrete result you need.</p>
            </div>
            <div className="field">
              <label htmlFor="gig-summary">
                Short summary <span aria-hidden="true">*</span>
              </label>
              <textarea
                className="input min-h-24"
                id="gig-summary"
                name="summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Create a two-week content pack for our campus innovation conference."
                minLength={20}
                maxLength={220}
                required
              />
              <p className="field-hint">
                Shown on the browse page. {summary.length}/220 characters.
              </p>
            </div>
            <div className="field">
              <label htmlFor="gig-description">
                Full description <span aria-hidden="true">*</span>
              </label>
              <textarea
                className="input min-h-44"
                id="gig-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the task, deliverables, tools, references, and what a successful handoff looks like."
                minLength={40}
                maxLength={1500}
                required
              />
              <p className="field-hint">
                40–1,500 characters. Include deliverables and relevant context.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold">
                Budget and delivery
              </legend>
              <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="field">
                  <label htmlFor="gig-country">Country</label>
                  <select
                    className="input"
                    id="gig-country"
                    name="country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                  >
                    {countries.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="gig-price">Budget</label>
                  <div className="relative">
                    <input
                      className="input pr-20 font-mono"
                      id="gig-price"
                      name="budget"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={price}
                      onChange={(event) =>
                        setPrice(
                          event.target.value.replace(/\D/g, "").slice(0, 12),
                        )
                      }
                      placeholder="35000"
                      required
                    />
                    <span className="pointer-events-none absolute right-3.5 top-3 font-mono text-sm font-bold text-muted">
                      {currency}
                    </span>
                  </div>
                  <p className="field-hint">
                    {price
                      ? formatAmount(Number(price), currency)
                      : `Amount in ${currency}`}
                    .
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="gig-category">Category</label>
                  <select
                    className="input"
                    id="gig-category"
                    name="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {GIG_CATEGORIES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="gig-deadline">Deadline</label>
                  <input
                    className="input"
                    id="gig-deadline"
                    name="deadline"
                    type="date"
                    min={earliestDeadline}
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    required
                  />
                  <p className="field-hint">Choose a realistic handoff date.</p>
                </div>
              </div>
            </fieldset>
            <div className="rounded-xl bg-muted-surface p-4">
              <div className="flex items-start gap-3">
                <LockKeyhole
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">Payment is not collected yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Publishing creates the gig. Escrow funding happens later,
                    after you review applicants and choose a student.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/gigs" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <>
                    <Clock3
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Publishing…
                  </>
                ) : (
                  <>
                    Publish gig{" "}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    </AppLayout>
  );
}

// Retained temporarily as a reference for the earlier simulated form.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyPostGigPage() {
  const [posted, setPosted] = useState(false);
  const [price, setPrice] = useState("35000");
  const [country, setCountry] = useState("Nigeria");
  const currency = currencyByCountry[country];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPosted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="Post a gig"
          description="Set a clear scope and a budget in the currency familiar to you."
          action={
            <Link href="/my-gigs" className="btn btn-secondary">
              My posted gigs
            </Link>
          }
        />
        {posted ? (
          <div className="card mt-8 p-6 text-center sm:p-10" role="status">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Your gig is live</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-muted">
              Verified students can now find and apply for “Social media
              designer for student conference”.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/my-gigs" className="btn btn-primary">
                View my posted gigs
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPosted(false)}
              >
                Post another gig
              </button>
            </div>
          </div>
        ) : (
          <form className="card mt-8 space-y-6 p-5 sm:p-8" onSubmit={submit}>
            <div className="field">
              <label htmlFor="gig-title">Gig title</label>
              <input
                className="input"
                id="gig-title"
                type="text"
                placeholder="e.g. Design social posts for a campus event"
                minLength={8}
                maxLength={80}
                required
              />
              <p className="field-hint">
                Be specific about the result you need.
              </p>
            </div>
            <div className="field">
              <label htmlFor="gig-description">Description</label>
              <textarea
                className="input min-h-44"
                id="gig-description"
                placeholder="Describe the task, deliverables, deadline, and any tools or experience needed."
                minLength={40}
                maxLength={1200}
                required
              />
              <p className="field-hint">
                40–1,200 characters. Clear gigs attract better applicants.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="field">
                <label htmlFor="gig-country">Country</label>
                <select
                  className="input"
                  id="gig-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  {countries.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gig-price">Budget</label>
                <div className="relative">
                  <input
                    className="input pr-20 font-mono"
                    id="gig-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={price}
                    onChange={(event) =>
                      setPrice(event.target.value.replace(/\D/g, ""))
                    }
                    required
                  />
                  <span className="pointer-events-none absolute right-3.5 top-3 font-mono text-sm font-bold text-muted">
                    {currency}
                  </span>
                </div>
                <p className="field-hint">
                  Shown to applicants as{" "}
                  {formatAmount(Number(price || 0), currency)}.
                </p>
              </div>
              <div className="field">
                <label htmlFor="gig-category">Category</label>
                <select className="input" id="gig-category" defaultValue="">
                  <option value="" disabled>
                    Select a category
                  </option>
                  {[
                    "Design",
                    "Development",
                    "Writing",
                    "Research",
                    "Photography",
                    "Video",
                    "Tutoring",
                    "Other",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-xl bg-muted-surface p-4">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Flexible escrow funding</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    After choosing a student, fund the agreed amount with a
                    supported local method or use USDC on Solana when
                    cross-border settlement is useful.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/gigs" className="btn btn-secondary">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary">
                Publish gig <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        )}
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; the live poster page is routed below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MyGigsPage() {
  const { items, loading, error, retry } = useMarketplaceGigs(true);
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="My posted gigs"
          description="These are the live gigs created by your account. Applicant management is the next marketplace milestone."
          action={
            <Link href="/post" className="btn btn-primary">
              Post a new gig
            </Link>
          }
        />
        {loading ? (
          <div className="mt-8">
            <GigListSkeleton />
          </div>
        ) : error ? (
          <div className="card mt-8 p-6" role="alert">
            <AlertCircle
              className="size-7 text-destructive"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-bold">Couldn’t load your gigs</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
            <button
              type="button"
              className="btn btn-secondary mt-5"
              onClick={() => {
                void retry();
              }}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="card mt-8 p-8 text-center sm:p-12">
            <BriefcaseBusiness
              className="mx-auto size-10 text-muted"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-xl font-bold">
              You haven’t posted a gig yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Describe the work, set a local-currency budget, and publish your
              first opportunity.
            </p>
            <Link href="/post" className="btn btn-primary mt-5">
              Post your first gig
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {items.map((item) => (
              <article className="card p-5 sm:p-6" key={item.id}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={gigStatusForDisplay(item.status)} />
                      <span className="text-xs text-muted">
                        Posted {formatGigDate(item.createdAt)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold">{item.title}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {item.applicantCount} application
                      {item.applicantCount === 1 ? "" : "s"} · Budget{" "}
                      {formatAmount(item.budget, item.currency)} · Due{" "}
                      {formatDeadline(item.deadline)}
                    </p>
                  </div>
                  <Link
                    href={`/gigs/${item.id}`}
                    className="btn btn-secondary shrink-0"
                  >
                    View listing{" "}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function MarketplaceApplicationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MarketplaceApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/applications", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Applications could not be loaded."),
        );
      setItems(Array.isArray(payload.applications) ? payload.applications : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Applications could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Student workspace"
          title="My applications"
          description="Track every application from submission through selection and funding."
          action={
            <Link href="/gigs" className="btn btn-primary">
              Browse gigs
            </Link>
          }
        />
        {loading ? (
          <div
            className="card mt-8 h-56 animate-pulse bg-muted-surface"
            role="status"
            aria-label="Loading applications"
          />
        ) : error ? (
          <div className="card mt-8 p-6" role="alert">
            <AlertCircle className="size-7 text-destructive" />
            <h2 className="mt-4 text-lg font-bold">
              Couldn’t load your applications
            </h2>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <button
              type="button"
              className="btn btn-secondary mt-5"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="card mt-8 p-10 text-center">
            <FileText className="mx-auto size-9 text-muted" />
            <h2 className="mt-4 text-xl font-bold">No applications yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              Open a gig, add a short note, and your application will appear
              here.
            </p>
            <Link href="/gigs" className="btn btn-primary mt-5">
              Browse open gigs
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {items.map((application) => {
              const gig = application.gig;
              const status: GigStatus =
                application.status === "pending"
                  ? "applied"
                  : application.status;
              return (
                <article className="card p-5 sm:p-6" key={application.id}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={status} />
                        <span className="text-xs text-muted">
                          Applied {formatGigDate(application.createdAt)}
                        </span>
                      </div>
                      <h2 className="mt-4 text-lg font-bold">
                        {gig?.title || "Gig unavailable"}
                      </h2>
                      <p className="mt-2 text-sm text-muted">
                        {gig
                          ? `${gig.posterName} · ${gig.posterUniversity}`
                          : "The listing is no longer available."}
                      </p>
                      <p className="mt-4 max-w-2xl rounded-lg bg-muted-surface p-4 text-sm leading-6 text-secondary">
                        “{application.note}”
                      </p>
                      {application.status === "accepted" && (
                        <div className="mt-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <CheckCircle2 className="size-4" />
                            Selected. Agree the final terms before funding.
                          </p>
                          {gig && (
                            <Link
                              href={`/gigs/${gig.id}/conversation`}
                              className="btn btn-secondary mt-4"
                            >
                              Open chat &amp; terms{" "}
                              <ArrowRight className="size-4" />
                            </Link>
                          )}
                        </div>
                      )}
                      {application.status === "rejected" && (
                        <p className="mt-4 text-sm text-muted">
                          Another student was selected for this gig. Your other
                          applications remain active.
                        </p>
                      )}
                    </div>
                    {gig && (
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-mono text-lg font-bold">
                          {formatAmount(gig.budget, gig.currency)}
                        </p>
                        <Link
                          href={`/gigs/${gig.id}`}
                          className="text-link mt-3 inline-flex min-h-11 items-center"
                        >
                          View gig
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function MarketplaceGigDetailLivePage({ id }: { id: string }) {
  const { user, profile } = useAuth();
  const [gig, setGig] = useState<MarketplaceGig | null>(null);
  const [application, setApplication] = useState<MarketplaceApplication | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applicationError, setApplicationError] = useState("");

  const loadGig = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/gigs/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "This gig could not be loaded."),
        );
      setGig(payload.gig as MarketplaceGig);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "This gig could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGig();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadGig]);
  useEffect(() => {
    if (!user || !gig || user.uid === gig.ownerId) return;
    let active = true;
    const loadApplication = async () => {
      setApplicationLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/gigs/${encodeURIComponent(id)}/applications`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );
        const payload = await response.json().catch(() => ({}));
        if (response.ok && active) setApplication(payload.application ?? null);
      } finally {
        if (active) setApplicationLoading(false);
      }
    };
    void loadApplication();
    return () => {
      active = false;
    };
  }, [gig, id, user]);

  const apply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setApplicationError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/applications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Your application could not be sent."),
        );
      setApplication(payload.application as MarketplaceApplication);
      setGig((current) =>
        current
          ? { ...current, applicantCount: current.applicantCount + 1 }
          : current,
      );
    } catch (applyError) {
      setApplicationError(
        applyError instanceof Error
          ? applyError.message
          : "Your application could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <AppLayout>
        <section className="page-shell py-8 sm:py-12">
          <div
            className="card h-[36rem] animate-pulse bg-muted-surface"
            role="status"
          />
        </section>
      </AppLayout>
    );
  if (error || !gig)
    return (
      <AppLayout>
        <section className="page-shell py-16">
          <div className="card mx-auto max-w-xl p-8 text-center" role="alert">
            <AlertCircle className="mx-auto size-9 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Couldn’t open this gig</h1>
            <p className="mt-2 text-sm text-muted">
              {error || "This listing is unavailable."}
            </p>
            <Link href="/gigs" className="btn btn-primary mt-5">
              Browse gigs
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  const isOwner = user?.uid === gig.ownerId;
  const isOpen = gig.status === "open";
  const settlementLabel =
    gig.settlementPreference === "usdc"
      ? "USDC on Solana"
      : `${gig.currency} local payment`;
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href="/gigs"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to gigs
        </Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <article className="card p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={gigStatusForDisplay(gig.status)} />
              <span className="text-sm text-muted">
                Posted {formatGigDate(gig.createdAt)}
              </span>
              <span className="rounded-md bg-muted-surface px-2.5 py-1.5 text-xs font-semibold">
                {gig.country}
              </span>
            </div>
            <h1 className="mt-6 text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-4xl">
              {gig.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-secondary">
              {gig.summary}
            </p>
            <div className="my-8 grid gap-3 rounded-xl bg-muted-surface p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Budget
                </p>
                <p className="mt-1 font-mono text-lg font-bold">
                  {formatAmount(gig.budget, gig.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Settlement
                </p>
                <p className="mt-1 font-semibold">{settlementLabel}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Due date
                </p>
                <p className="mt-1 font-semibold">
                  {formatDeadline(gig.deadline)}
                </p>
              </div>
            </div>
            <h2 className="text-lg font-bold">About this gig</h2>
            <p className="mt-3 max-w-prose whitespace-pre-line leading-7 text-muted">
              {gig.description}
            </p>
            <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
              <span className="avatar">{initialsFor(gig.posterName)}</span>
              <div>
                <p className="font-semibold">Posted by {gig.posterName}</p>
                <p className="mt-1 text-sm text-muted">
                  {gig.posterUniversity} · Email verified
                </p>
              </div>
              <BadgeCheck className="ml-auto size-5 text-primary" />
            </div>
          </article>
          <aside className="card p-5 sm:p-6 lg:sticky lg:top-24">
            <p className="text-sm font-semibold text-muted">Gig budget</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatAmount(gig.budget, gig.currency)}
            </p>
            <div className="mt-5 rounded-lg bg-primary-soft p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <LockKeyhole className="size-4" />
                {settlementLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-secondary">
                No payment is taken until a student is selected.
              </p>
            </div>
            {isOwner ? (
              <div className="mt-6">
                <p className="font-bold">This is your listing</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Review everyone who applied and choose one verified student.
                </p>
                <Link
                  href={`/my-gigs/${gig.id}/applicants`}
                  className="btn btn-primary mt-4 w-full"
                >
                  Review {gig.applicantCount} applicant
                  {gig.applicantCount === 1 ? "" : "s"}
                </Link>
              </div>
            ) : !user ? (
              <div className="mt-6">
                <p className="font-bold">Log in to apply</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Browsing is public. Sign in when you are ready to apply.
                </p>
                <Link
                  href={`/login?returnTo=${encodeURIComponent(`/gigs/${gig.id}`)}`}
                  className="btn btn-primary mt-4 w-full"
                >
                  Log in
                </Link>
              </div>
            ) : applicationLoading ? (
              <div className="mt-6 text-center" role="status">
                <Clock3 className="mx-auto size-6 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted">Checking application…</p>
              </div>
            ) : application ? (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5 text-center">
                <CheckCircle2 className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-bold">
                  Application{" "}
                  {application.status === "pending"
                    ? "sent"
                    : application.status}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Track updates from your application workspace.
                </p>
                <Link
                  href="/applications"
                  className="btn btn-secondary mt-4 w-full"
                >
                  My applications
                </Link>
              </div>
            ) : !profile?.studentVerified ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <UserCheck className="size-7 text-amber-700" />
                <p className="mt-3 font-bold">Verify your school to apply</p>
                <p className="mt-2 text-sm leading-6 text-secondary">
                  School verification unlocks applications.
                </p>
                <Link
                  href="/profile/verification"
                  className="btn btn-primary mt-4 w-full"
                >
                  Verify school
                </Link>
              </div>
            ) : !isOpen ? (
              <div className="mt-6 rounded-xl bg-muted-surface p-5">
                <p className="font-bold">Applications closed</p>
                <p className="mt-2 text-sm text-muted">
                  A student has already been selected for this gig.
                </p>
              </div>
            ) : (
              <form className="mt-6" onSubmit={apply}>
                {applicationError && (
                  <p
                    className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    role="alert"
                  >
                    {applicationError}
                  </p>
                )}
                <div className="field">
                  <label htmlFor="live-application-note">
                    Short note to the poster
                  </label>
                  <textarea
                    className="input min-h-32"
                    id="live-application-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Mention relevant experience, your approach, and availability."
                    minLength={20}
                    maxLength={600}
                    required
                  />
                  <p className="field-hint">
                    20–600 characters. Keep it specific.
                  </p>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary mt-5 w-full"
                  disabled={busy}
                >
                  {busy ? (
                    "Sending application…"
                  ) : (
                    <>
                      Apply for this gig <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="mt-4 text-center text-xs text-muted">
              {gig.applicantCount} application
              {gig.applicantCount === 1 ? "" : "s"}
            </p>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

function MarketplaceApplicantsPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [gig, setGig] = useState<MarketplaceGig | null>(null);
  const [applications, setApplications] = useState<MarketplaceApplication[]>(
    [],
  );
  const [openApplicantId, setOpenApplicantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const [gigResponse, applicationResponse] = await Promise.all([
        fetch(`/api/gigs/${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch(`/api/gigs/${encodeURIComponent(id)}/applications`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      const gigPayload = await gigResponse.json().catch(() => ({}));
      const applicationPayload = await applicationResponse
        .json()
        .catch(() => ({}));
      if (!gigResponse.ok)
        throw new Error(
          String(gigPayload.error ?? "This gig could not be loaded."),
        );
      if (!applicationResponse.ok)
        throw new Error(
          String(applicationPayload.error ?? "Applicants could not be loaded."),
        );
      setGig(gigPayload.gig as MarketplaceGig);
      setApplications(
        Array.isArray(applicationPayload.applications)
          ? applicationPayload.applications
          : [],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Applicants could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, user]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectApplicant = async (application: MarketplaceApplication) => {
    if (!user) return;
    setBusyId(application.applicantId);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/applications/${encodeURIComponent(application.applicantId)}/select`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "That student could not be selected."),
        );
      setApplications((current) =>
        current.map((item) => ({
          ...item,
          status:
            item.applicantId === application.applicantId
              ? "accepted"
              : "rejected",
        })),
      );
      setGig((current) =>
        current
          ? {
              ...current,
              status: "awaiting_funding",
              selectedApplicantId: application.applicantId,
              selectedApplicantName: application.applicantName,
            }
          : current,
      );
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "That student could not be selected.",
      );
    } finally {
      setBusyId("");
    }
  };

  if (loading)
    return (
      <AppLayout>
        <section className="page-shell py-8 sm:py-12">
          <div
            className="card h-80 animate-pulse bg-muted-surface"
            role="status"
          />
        </section>
      </AppLayout>
    );
  if (error && !gig)
    return (
      <AppLayout>
        <section className="page-shell py-12">
          <div className="card p-8 text-center" role="alert">
            <AlertCircle className="mx-auto size-8 text-destructive" />
            <p className="mt-4 font-semibold">{error}</p>
            <Link href="/my-gigs" className="btn btn-secondary mt-5">
              Back to my gigs
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  if (!gig) return null;
  const selected = gig.status === "awaiting_funding";
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href="/my-gigs"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to my gigs
        </Link>
        <PageHeader
          eyebrow={`${applications.length} application${applications.length === 1 ? "" : "s"}`}
          title="Choose a student for this gig"
          description={`Review verified profiles and application notes for “${gig.title}”.`}
        />
        {error && (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        {selected && (
          <div
            className="mt-6 rounded-xl bg-ink p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
              <div>
                <p className="font-semibold">
                  {gig.selectedApplicantName} selected
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Open the private conversation, agree the final terms, then
                  move to funding.
                </p>
              </div>
            </div>
            <Link
              href={`/gigs/${gig.id}/conversation`}
              className="btn mt-4 bg-white text-ink hover:bg-slate-100 sm:mt-0"
            >
              Open chat &amp; terms <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
        {applications.length === 0 ? (
          <div className="card mt-8 p-10 text-center">
            <UsersRound className="mx-auto size-9 text-muted" />
            <h2 className="mt-4 text-xl font-bold">No applications yet</h2>
            <p className="mt-2 text-sm text-muted">
              Share the listing link or check back after students apply.
            </p>
            <Link href={`/gigs/${gig.id}`} className="btn btn-secondary mt-5">
              View live listing
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {applications.map((application) => {
              const profile = application.profile;
              const expanded = openApplicantId === application.applicantId;
              const accepted = application.status === "accepted";
              const rejected = application.status === "rejected";
              return (
                <article
                  className={`card p-5 sm:p-6 ${accepted ? "border-primary bg-primary-soft/30" : ""}`}
                  key={application.id}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <ProfileAvatar
                        name={application.applicantName}
                        src={profile?.photoDataUrl}
                        large
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-bold">
                            {application.applicantName}
                          </h2>
                          {profile?.studentVerified && (
                            <BadgeCheck
                              className="size-4 text-primary"
                              aria-label="Verified student"
                            />
                          )}
                          {accepted && <StatusBadge status="accepted" />}
                          {rejected && <StatusBadge status="rejected" />}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {profile?.course || "Course not added"} ·{" "}
                          {application.applicantUniversity}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-secondary">
                          {profile?.headline ||
                            profile?.availability ||
                            "Verified CampusGig student"}
                        </p>
                        <p className="mt-4 max-w-3xl rounded-lg bg-muted-surface p-4 text-sm leading-6 text-secondary">
                          “{application.note}”
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          setOpenApplicantId(
                            expanded ? "" : application.applicantId,
                          )
                        }
                      >
                        {expanded ? "Hide profile" : "View profile"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={selected || Boolean(busyId)}
                        onClick={() => void selectApplicant(application)}
                      >
                        {busyId === application.applicantId
                          ? "Selecting…"
                          : accepted
                            ? "Selected"
                            : selected
                              ? "Position filled"
                              : "Select student"}
                      </button>
                    </div>
                  </div>
                  {expanded && profile && (
                    <div className="mt-6 grid gap-4 border-t border-border pt-6 lg:grid-cols-[1fr_280px]">
                      <div>
                        <h3 className="font-bold">About {profile.fullName}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                          {profile.bio || "No bio added yet."}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-muted-surface p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">
                              Skills
                            </p>
                            <p className="mt-2 text-sm font-semibold">
                              {profile.skills || "Not added"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted-surface p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted">
                              Availability
                            </p>
                            <p className="mt-2 text-sm font-semibold">
                              {profile.availability || "Not added"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <aside className="rounded-xl border border-border p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">
                          Profile links
                        </p>
                        <div className="mt-3 grid gap-2">
                          {[
                            ["Portfolio", profile.portfolio],
                            ["LinkedIn", profile.linkedIn],
                            ["GitHub", profile.gitHub],
                          ]
                            .filter(([, href]) => href)
                            .map(([label, href]) => (
                              <a
                                className="text-link min-h-11 py-2"
                                href={href}
                                key={label}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {label} <ArrowRight className="size-4" />
                              </a>
                            ))}
                          {!profile.portfolio &&
                            !profile.linkedIn &&
                            !profile.gitHub && (
                              <p className="text-sm text-muted">
                                No links added.
                              </p>
                            )}
                        </div>
                      </aside>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function MarketplaceConversationPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [conversation, setConversation] =
    useState<MarketplaceConversation | null>(null);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [role, setRole] = useState<"client" | "student">("student");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [termsBusy, setTermsBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [payment, setPayment] = useState<MarketplacePayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [funding, setFunding] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [clientWalletAddress, setClientWalletAddress] = useState("");
  const [clientUsdcBalance, setClientUsdcBalance] = useState("");
  const [scope, setScope] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [amount, setAmount] = useState("");
  const [revisions, setRevisions] = useState("1");
  const hydratedVersion = useRef(-1);
  const requestActive = useRef(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const loadConversation = useCallback(
    async (quiet = false) => {
      if (!user || requestActive.current) return;
      requestActive.current = true;
      if (!quiet) setLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/gigs/${encodeURIComponent(id)}/conversation`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            String(payload.error ?? "The conversation could not be loaded."),
          );
        const nextConversation =
          payload.conversation as MarketplaceConversation;
        setConversation(nextConversation);
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        setRole(payload.role === "client" ? "client" : "student");
        if (hydratedVersion.current !== nextConversation.agreementVersion) {
          setScope(nextConversation.agreement.scope);
          setDeliverables(nextConversation.agreement.deliverables);
          setDeadline(nextConversation.agreement.deadline);
          setAmount(String(nextConversation.agreement.amount || ""));
          setRevisions(String(nextConversation.agreement.revisions));
          hydratedVersion.current = nextConversation.agreementVersion;
        }
        setError("");
      } catch (loadError) {
        if (!quiet)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The conversation could not be loaded.",
          );
      } finally {
        requestActive.current = false;
        if (!quiet) setLoading(false);
      }
    },
    [id, user],
  );

  const loadPayment = useCallback(
    async (quiet = false) => {
      if (!user) return;
      if (!quiet) setPaymentLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/gigs/${encodeURIComponent(id)}/payment`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            String(payload.error ?? "The payment status could not be loaded."),
          );
        }
        setPayment((payload.payment as MarketplacePayment | null) ?? null);
        setClientWalletAddress(String(payload.clientWalletAddress ?? ""));
        setClientUsdcBalance(String(payload.clientUsdcBalance ?? ""));
        setPaymentError("");
      } catch (loadError) {
        if (!quiet) {
          setPaymentError(
            loadError instanceof Error
              ? loadError.message
              : "The payment status could not be loaded.",
          );
        }
      } finally {
        if (!quiet) setPaymentLoading(false);
      }
    },
    [id, user],
  );

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      void loadConversation(false);
    }, 0);
    const polling = window.setInterval(() => {
      void loadConversation(true);
    }, 2_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(polling);
    };
  }, [loadConversation]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      void loadPayment(false);
    }, 0);
    const polling = window.setInterval(() => {
      void loadPayment(true);
    }, 5_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(polling);
    };
  }, [loadPayment]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages.length]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageText.trim();
    if (!user || !text || sending) return;
    setSending(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/conversation/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Your message could not be sent."),
        );
      setMessageText("");
      await loadConversation(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Your message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const proposeTerms = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || termsBusy) return;
    setTermsBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/conversation/terms`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scope,
            deliverables,
            deadline,
            amount: Number(amount),
            revisions: Number(revisions),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "The terms could not be proposed."),
        );
      setConversation(payload.conversation as MarketplaceConversation);
      await loadConversation(true);
    } catch (termsError) {
      setError(
        termsError instanceof Error
          ? termsError.message
          : "The terms could not be proposed.",
      );
    } finally {
      setTermsBusy(false);
    }
  };

  const acceptTerms = async () => {
    if (!user || accepting) return;
    setAccepting(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/conversation/accept`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "The terms could not be accepted."),
        );
      setConversation(payload.conversation as MarketplaceConversation);
      await loadConversation(true);
      await loadPayment(true);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "The terms could not be accepted.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const fundPayment = async () => {
    if (!user || funding) return;
    setFunding(true);
    setPaymentError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/gigs/${encodeURIComponent(id)}/payment`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "The gig could not be funded."));
      }
      setPayment((payload.payment as MarketplacePayment | null) ?? null);
      setClientWalletAddress(String(payload.clientWalletAddress ?? ""));
      setClientUsdcBalance(String(payload.clientUsdcBalance ?? ""));
      await Promise.all([loadConversation(true), loadPayment(true)]);
    } catch (fundError) {
      setPaymentError(
        fundError instanceof Error
          ? fundError.message
          : "The gig could not be funded.",
      );
      await loadPayment(true);
    } finally {
      setFunding(false);
    }
  };

  if (loading)
    return (
      <AppLayout>
        <section className="page-shell py-8 sm:py-12">
          <div
            className="card h-[34rem] animate-pulse bg-muted-surface"
            role="status"
            aria-label="Loading conversation"
          />
        </section>
      </AppLayout>
    );
  if (!conversation)
    return (
      <AppLayout>
        <section className="page-shell max-w-3xl py-8 sm:py-12">
          <div className="card p-6" role="alert">
            <AlertCircle className="size-7 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Conversation unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {error ||
                "Only the selected client and student can open this conversation."}
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-5"
              onClick={() => void loadConversation(false)}
            >
              Try again
            </button>
          </div>
        </section>
      </AppLayout>
    );

  const agreement = conversation.agreement;
  const accepted = conversation.agreementStatus === "accepted";
  const proposed = conversation.agreementStatus === "proposed";
  const otherName =
    role === "client" ? conversation.studentName : conversation.ownerName;
  const backHref =
    role === "client" ? `/my-gigs/${id}/applicants` : "/applications";

  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href={backHref}
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <PageHeader
          eyebrow="Private gig workspace"
          title="Chat and agree terms"
          description={`Text-only conversation between ${conversation.ownerName} and ${conversation.studentName}. Funding stays locked until the student accepts the proposed terms.`}
        />
        {error && (
          <div
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section
            className="card flex min-h-[36rem] flex-col overflow-hidden"
            aria-label={`Conversation with ${otherName}`}
          >
            <header className="border-b border-border p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                  <MessageSquare className="size-5" />
                </span>
                <div>
                  <h2 className="font-bold">{otherName}</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Selected {role === "client" ? "student" : "client"} ·
                    refreshes automatically
                  </p>
                </div>
              </div>
            </header>
            <div
              className="max-h-[30rem] min-h-72 flex-1 overflow-y-auto bg-muted-surface/40 p-4 sm:p-5"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="grid min-h-64 place-items-center text-center">
                  <div>
                    <MessageSquare className="mx-auto size-8 text-muted" />
                    <p className="mt-3 font-semibold">No messages yet</p>
                    <p className="mt-1 text-sm text-muted">
                      Start with the scope, timing, or any question before
                      agreeing terms.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => {
                    const mine = message.senderId === user?.uid;
                    return (
                      <div
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        key={message.id}
                      >
                        <article
                          className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${mine ? "bg-primary text-white" : "border border-border bg-surface text-foreground"}`}
                        >
                          <p
                            className={`text-xs font-bold ${mine ? "text-emerald-50" : "text-muted"}`}
                          >
                            {mine ? "You" : message.senderName}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words leading-6">
                            {message.text}
                          </p>
                          <p
                            className={`mt-2 text-[11px] ${mine ? "text-emerald-50" : "text-muted"}`}
                          >
                            {formatConversationTime(message.createdAt)}
                          </p>
                        </article>
                      </div>
                    );
                  })}
                  <div ref={messagesEnd} />
                </div>
              )}
            </div>
            <form
              className="border-t border-border p-4 sm:p-5"
              onSubmit={sendMessage}
            >
              <label
                className="text-sm font-semibold"
                htmlFor="conversation-message"
              >
                Message
              </label>
              <textarea
                className="input mt-2 min-h-24 resize-y"
                id="conversation-message"
                value={messageText}
                onChange={(event) =>
                  setMessageText(event.target.value.slice(0, 1_000))
                }
                placeholder="Write a message…"
                maxLength={1_000}
                required
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">{messageText.length}/1,000</p>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending || !messageText.trim()}
                >
                  {sending ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          </section>
          <aside className="card h-fit p-5 sm:p-6 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em] text-primary">
                  Final agreement
                </p>
                <h2 className="mt-2 text-xl font-bold">Terms before funding</h2>
              </div>
              <span
                className={`status ${accepted ? "status-completed" : proposed ? "status-submitted" : "status-open"}`}
              >
                {accepted
                  ? "Accepted"
                  : proposed
                    ? "Awaiting student"
                    : "Draft"}
              </span>
            </div>
            {role === "client" ? (
              <form className="mt-6 space-y-4" onSubmit={proposeTerms}>
                <div className="field">
                  <label htmlFor="terms-scope">Scope</label>
                  <textarea
                    className="input min-h-28"
                    id="terms-scope"
                    value={scope}
                    onChange={(event) => setScope(event.target.value)}
                    minLength={20}
                    maxLength={1_500}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="terms-deliverables">Deliverables</label>
                  <textarea
                    className="input min-h-24"
                    id="terms-deliverables"
                    value={deliverables}
                    onChange={(event) => setDeliverables(event.target.value)}
                    minLength={10}
                    maxLength={1_000}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="field">
                    <label htmlFor="terms-deadline">Deadline</label>
                    <input
                      className="input"
                      id="terms-deadline"
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="terms-revisions">Revisions</label>
                    <input
                      className="input"
                      id="terms-revisions"
                      type="text"
                      inputMode="numeric"
                      value={revisions}
                      onChange={(event) =>
                        setRevisions(
                          event.target.value.replace(/\D/g, "").slice(0, 2),
                        )
                      }
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="terms-amount">
                    Agreed amount ({agreement.currency})
                  </label>
                  <input
                    className="input font-mono"
                    id="terms-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value.replace(/[^0-9.]/g, "").slice(0, 15),
                      )
                    }
                    required
                  />
                </div>
                {accepted && (
                  <div className="rounded-lg bg-primary-soft p-4 text-sm leading-6 text-secondary">
                    <CheckCircle2 className="mr-2 inline size-4 text-primary" />
                    The student accepted version {conversation.acceptedVersion}.
                    Updating terms will require acceptance again.
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={termsBusy}
                >
                  {termsBusy
                    ? "Saving terms…"
                    : accepted || proposed
                      ? "Update proposed terms"
                      : "Propose final terms"}
                </button>
              </form>
            ) : (
              <div className="mt-6">
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="font-bold">Scope</dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-6 text-muted">
                      {agreement.scope}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold">Deliverables</dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-6 text-muted">
                      {agreement.deliverables}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="font-bold">Deadline</dt>
                      <dd className="mt-1 text-muted">
                        {formatDeadline(agreement.deadline)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold">Revisions</dt>
                      <dd className="mt-1 text-muted">{agreement.revisions}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="font-bold">Amount</dt>
                    <dd className="mt-1 font-mono text-lg font-bold">
                      {formatAmount(agreement.amount, agreement.currency)}
                    </dd>
                  </div>
                </dl>
                {proposed ? (
                  <div className="mt-6">
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={() => void acceptTerms()}
                      disabled={accepting}
                    >
                      {accepting ? "Accepting…" : "Accept final terms"}
                    </button>
                    <p className="mt-3 text-center text-xs leading-5 text-muted">
                      Need a change? Ask the client in chat before accepting.
                    </p>
                  </div>
                ) : accepted ? (
                  <div className="mt-6 rounded-lg bg-primary-soft p-4 text-sm leading-6 text-secondary">
                    <CheckCircle2 className="mr-2 inline size-4 text-primary" />
                    You accepted these terms. Funding is the next step.
                  </div>
                ) : (
                  <div className="mt-6 rounded-lg bg-muted-surface p-4 text-sm leading-6 text-muted">
                    <Clock3 className="mr-2 inline size-4" />
                    Waiting for the client to propose the final terms.
                  </div>
                )}
              </div>
            )}
            {!accepted ? (
              <div className="mt-6 rounded-lg bg-muted-surface p-4 text-sm leading-6 text-muted">
                <LockKeyhole className="mr-2 inline size-4" />
                Funding is locked until the student accepts.
              </div>
            ) : agreement.currency !== "USDC" ? (
              <div className="mt-6 rounded-lg bg-muted-surface p-4 text-sm leading-6 text-muted">
                <Banknote className="mr-2 inline size-4" />
                Local payment funding is not part of this Devnet demo.
              </div>
            ) : paymentLoading ? (
              <div className="mt-6 rounded-lg bg-muted-surface p-4 text-sm text-muted" role="status">
                <Clock3 className="mr-2 inline size-4 animate-spin" />
                Loading Devnet payment status…
              </div>
            ) : payment && ["funded", "submitted", "approved", "releasing", "released", "completed"].includes(payment.status) ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <p className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="size-5 text-emerald-700" />
                  Payment secured — you can begin work.
                </p>
                <p className="mt-2 text-sm leading-6">
                  {formatAmount(agreement.amount, "USDC")} is confirmed on Solana Devnet.
                </p>
                {payment.fundingSignature && (
                  <a
                    className="text-link mt-3 inline-flex min-h-11 items-center gap-2"
                    href={`https://explorer.solana.com/tx/${encodeURIComponent(payment.fundingSignature)}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Solana Explorer <ArrowRight className="size-4" />
                  </a>
                )}
              </div>
            ) : payment?.status === "funding_pending" ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950" role="status">
                <p className="font-bold">
                  <Clock3 className="mr-2 inline size-4 animate-spin" />
                  Funding transaction pending
                </p>
                <p className="mt-2 text-sm leading-6">
                  CampusGig is waiting for Solana confirmation. Refreshing will not create another transfer.
                </p>
              </div>
            ) : role === "client" ? (
              <div className="mt-6 rounded-xl border border-border p-5">
                <p className="font-bold">Fund with Devnet USDC</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  The accepted amount moves from your embedded wallet into this gig’s custodial escrow wallet.
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Required</dt>
                    <dd className="font-mono font-bold">{formatAmount(agreement.amount, "USDC")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Wallet balance</dt>
                    <dd className="font-mono font-bold">
                      {clientUsdcBalance ? `${clientUsdcBalance} USDC` : "Not detected"}
                    </dd>
                  </div>
                </dl>
                {clientWalletAddress && (
                  <p className="mt-4 break-all rounded-lg bg-muted-surface p-3 font-mono text-xs text-muted">
                    {clientWalletAddress}
                  </p>
                )}
                {paymentError && (
                  <p className="mt-4 text-sm leading-6 text-red-700" role="alert">
                    <AlertCircle className="mr-2 inline size-4" />
                    {paymentError}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-primary mt-4 w-full"
                  onClick={() => void fundPayment()}
                  disabled={funding}
                >
                  {funding ? "Confirming on Solana…" : `Fund ${formatAmount(agreement.amount, "USDC")}`}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-lg bg-primary-soft p-4 text-sm leading-6 text-secondary">
                <Clock3 className="mr-2 inline size-4 text-primary" />
                Terms accepted. Waiting for the client to secure payment.
                {paymentError && <p className="mt-2 text-red-700">{paymentError}</p>}
              </div>
            )}
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

function MyGigsLivePage() {
  const { items, loading, error, retry } = useMarketplaceGigs(true);
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="My posted gigs"
          description="Review applicants, choose one student, and move the selected gig to funding."
          action={
            <Link href="/post" className="btn btn-primary">
              Post a new gig
            </Link>
          }
        />
        {loading ? (
          <div
            className="card mt-8 h-56 animate-pulse bg-muted-surface"
            role="status"
          />
        ) : error ? (
          <div className="card mt-8 p-6" role="alert">
            <AlertCircle className="size-7 text-destructive" />
            <p className="mt-4 font-semibold">{error}</p>
            <button
              type="button"
              className="btn btn-secondary mt-5"
              onClick={() => void retry()}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="card mt-8 p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-9 text-muted" />
            <h2 className="mt-4 text-xl font-bold">
              You haven’t posted a gig yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Publish your first opportunity to start receiving applications.
            </p>
            <Link href="/post" className="btn btn-primary mt-5">
              Post your first gig
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {items.map((gig) => (
              <article className="card p-5 sm:p-6" key={gig.id}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={gigStatusForDisplay(gig.status)} />
                      <span className="text-xs text-muted">
                        {gig.settlementPreference === "usdc"
                          ? "USDC on Solana"
                          : `${gig.currency} local payment`}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-bold">{gig.title}</h2>
                    <p className="mt-2 text-sm text-muted">
                      {gig.applicantCount} application
                      {gig.applicantCount === 1 ? "" : "s"} ·{" "}
                      {formatAmount(gig.budget, gig.currency)} · Due{" "}
                      {formatDeadline(gig.deadline)}
                    </p>
                    {(gig.status === "awaiting_funding" || gig.status === "in_progress") && (
                      <p className="mt-2 text-sm font-semibold text-primary">
                        {gig.selectedApplicantName} selected ·{" "}
                        {gig.status === "in_progress"
                          ? "Payment secured"
                          : gig.agreementStatus === "accepted"
                            ? "Terms accepted"
                          : "Agree terms before funding"}
                      </p>
                    )}
                  </div>
                  <Link
                    href={
                      gig.status === "awaiting_funding" || gig.status === "in_progress"
                        ? `/gigs/${gig.id}/conversation`
                        : `/my-gigs/${gig.id}/applicants`
                    }
                    className="btn btn-secondary shrink-0"
                  >
                    {gig.status === "awaiting_funding" || gig.status === "in_progress"
                      ? "Open chat"
                      : "Review applicants"}{" "}
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

// Retained temporarily for downstream simulated escrow screens.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyMyGigsPage() {
  const [state] = useAppState();
  const items = [
    {
      id: 1,
      title: gigs[0].title,
      price: gigs[0].price,
      currency: gigs[0].currency,
      applicants: 7,
      status: state.paymentReleased
        ? "completed"
        : state.submitted
          ? "submitted"
          : state.escrowSecured
            ? "in progress"
            : ("open" as GigStatus),
      action: state.paymentReleased
        ? ["View receipt", "/review"]
        : state.submitted
          ? ["Review submission", "/review"]
          : state.escrowSecured
            ? ["View progress", "/review"]
            : ["View applicants", "/my-gigs/1/applicants"],
    },
    {
      id: 2,
      title: "Proofread final-year project chapters",
      price: 42000,
      currency: "NGN",
      applicants: 4,
      status: "in progress" as GigStatus,
      action: ["View progress", "/review"],
    },
    {
      id: 3,
      title: "Create motion graphics for orientation",
      price: 90000,
      currency: "NGN",
      applicants: 9,
      status: "submitted" as GigStatus,
      action: ["Review submission", "/review"],
    },
    {
      id: 4,
      title: "Photograph entrepreneurship showcase",
      price: 120000,
      currency: "NGN",
      applicants: 6,
      status: "completed" as GigStatus,
      action: ["View receipt", "/review"],
    },
  ];
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="My posted gigs"
          description="Review applicants, track escrow, and approve completed work from one place."
          action={
            <Link href="/post" className="btn btn-primary">
              Post a new gig
            </Link>
          }
        />
        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <article className="card p-5 sm:p-6" key={item.id}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-muted">
                      Posted 12 Aug 2026
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold">{item.title}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {item.applicants} applicants · Budget{" "}
                    {formatAmount(item.price, item.currency)}
                  </p>
                </div>
                <Link
                  href={item.action[1] as string}
                  className="btn btn-secondary shrink-0"
                >
                  {item.action[0]} <ChevronRight className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}

// Retained as an archived visual reference; the live applicant page is routed above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ApplicantsPage() {
  const [state, setState] = useAppState();
  return (
    <AppLayout>
      <section className="page-shell py-8 sm:py-12">
        <Link
          href="/my-gigs"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to my gigs
        </Link>
        <PageHeader
          eyebrow="7 applications"
          title="Choose a student for this gig"
          description="Review experience and application notes for Social media designer for student conference."
        />
        <div className="mt-8 grid gap-4">
          {applicants.map((applicant) => {
            const accepted = state.acceptedApplicant === applicant.id;
            const anotherAccepted =
              state.acceptedApplicant !== null && !accepted;
            return (
              <article
                className={`card p-5 sm:p-6 ${accepted ? "border-primary bg-primary-soft/30" : ""}`}
                key={applicant.id}
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="flex items-start gap-4">
                    <span className="avatar size-12">{applicant.initials}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">{applicant.name}</h2>
                        <BadgeCheck
                          className="size-4 text-primary"
                          aria-label="Verified student"
                        />
                        {accepted && <StatusBadge status="accepted" />}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {applicant.course} · {applicant.university}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-secondary">
                        <span>★ {applicant.rating} rating</span>
                        <span>{applicant.completed} completed gigs</span>
                      </div>
                      <p className="mt-4 max-w-3xl rounded-lg bg-muted-surface p-4 text-sm leading-6 text-secondary">
                        “{applicant.note}”
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={
                      accepted ? "btn btn-secondary" : "btn btn-primary"
                    }
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        acceptedApplicant: applicant.id,
                      }))
                    }
                    disabled={anotherAccepted}
                  >
                    {accepted
                      ? "Accepted"
                      : anotherAccepted
                        ? "Position filled"
                        : "Accept student"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {state.acceptedApplicant && (
          <div
            className="sticky bottom-4 mt-6 rounded-xl bg-ink p-4 text-white shadow-lg sm:flex sm:items-center sm:justify-between sm:gap-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
              <div>
                <p className="font-semibold">Applicant accepted</p>
                <p className="mt-1 text-sm text-slate-300">
                  Secure {formatAmount(gigs[0].price)} in escrow before work
                  begins.
                </p>
              </div>
            </div>
            <Link
              href="/escrow"
              className="btn mt-4 bg-white text-ink hover:bg-slate-100 sm:mt-0"
            >
              Fund escrow <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function FundEscrowPage() {
  const [state, setState] = useAppState();
  const [paymentState, setPaymentState] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const pay = (method: "local" | "solana") => {
    setPaymentState("loading");
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        escrowSecured: true,
        escrowMethod: method,
      }));
      setPaymentState("idle");
    }, 1100);
  };
  if (state.escrowSecured)
    return (
      <AppLayout>
        <section className="page-shell max-w-3xl py-10 sm:py-16">
          <div className="card overflow-hidden">
            <div className="bg-primary px-6 py-8 text-center text-white sm:px-10">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-white/15">
                <ShieldCheck className="size-8" />
              </span>
              <h1 className="mt-5 text-3xl font-bold">
                Funds secured in escrow
              </h1>
              <p className="mx-auto mt-3 max-w-lg leading-7 text-emerald-50">
                CampusGig has secured{" "}
                {formatAmount(gigs[0].price, gigs[0].currency)}. Amara can now
                begin the work.
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-muted-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Transaction reference
                  </p>
                  <p className="mt-2 font-mono text-sm font-bold">
                    CG-ESC-0826-1492
                  </p>
                </div>
                <div className="rounded-lg bg-muted-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Settlement
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-bold text-primary">
                    <CheckCircle2 className="size-4" />
                    {state.escrowMethod === "solana"
                      ? "USDC · Solana devnet"
                      : "Local payment · Protected escrow"}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/my-gigs" className="btn btn-primary">
                  Return to my gigs
                </Link>
                <Link href="/review" className="btn btn-secondary">
                  Continue to review step
                </Link>
              </div>
            </div>
          </div>
        </section>
      </AppLayout>
    );
  return (
    <AppLayout>
      <section className="page-shell max-w-4xl py-8 sm:py-12">
        <Link
          href="/my-gigs/1/applicants"
          className="text-link inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to applicants
        </Link>
        <PageHeader
          eyebrow="Secure payment"
          title="Fund escrow"
          description="Choose the payment method that works for you. The worker starts only after the agreed amount is protected."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card p-5 sm:p-8">
            <h2 className="text-lg font-bold">Choose a payment method</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              You are funding escrow, not paying the worker directly. Release
              happens after you approve the submission.
            </p>
            {paymentState === "loading" && (
              <div
                className="mt-6 rounded-xl border border-primary/20 bg-primary-soft p-5"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex items-center gap-3">
                  <Clock3 className="size-5 animate-spin text-primary" />
                  <div>
                    <p className="font-semibold">Securing your payment…</p>
                    <p className="mt-1 text-sm text-muted">
                      Keep this page open while CampusGig confirms the
                      transaction.
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                </div>
              </div>
            )}
            {paymentState === "error" && (
              <div
                className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">
                      Payment could not be confirmed
                    </p>
                    <p className="mt-1 text-sm leading-6 text-secondary">
                      No funds were taken. Retry or choose another available
                      payment method.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary mt-4"
                      onClick={() => setPaymentState("idle")}
                    >
                      Choose another method
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                className="focus-ring flex min-h-20 w-full items-center justify-between rounded-xl bg-primary px-5 text-left text-white transition hover:bg-primary-hover"
                onClick={() => pay("local")}
                disabled={paymentState === "loading"}
              >
                <span>
                  <span className="block font-bold">
                    Pay {formatAmount(gigs[0].price, gigs[0].currency)} locally
                  </span>
                  <span className="mt-1 block text-xs text-emerald-50">
                    Card, bank, or supported regional payment method
                  </span>
                </span>
                <WalletCards className="size-5" />
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted">
                  or use crypto
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                className="focus-ring flex min-h-16 w-full items-center justify-between rounded-xl border border-border bg-surface px-5 text-left transition hover:border-primary/40 hover:bg-primary-soft"
                onClick={() => pay("solana")}
                disabled={paymentState === "loading"}
              >
                <span>
                  <span className="block font-bold">
                    Pay with USDC on Solana
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    Optional for cross-border settlement
                  </span>
                </span>
                <ArrowRight className="size-5 text-primary" />
              </button>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />A
              live quote and any provider fee will be shown before confirmation.
              CampusGig never asks for a wallet seed phrase.
            </p>
          </div>
          <aside className="card h-fit p-5">
            <h2 className="font-bold">Escrow summary</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Gig amount</dt>
                <dd className="font-mono font-bold">
                  {formatAmount(gigs[0].price, gigs[0].currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Gig country</dt>
                <dd className="font-semibold">{gigs[0].country}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Payment options</dt>
                <dd className="text-right font-semibold">Local or USDC</dd>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="font-bold">Amount to secure</dt>
                  <dd className="font-mono text-xl font-bold">
                    {formatAmount(gigs[0].price, gigs[0].currency)}
                  </dd>
                </div>
              </div>
            </dl>
            <div className="mt-6 rounded-lg bg-muted-surface p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Worker
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="avatar">AO</span>
                <div>
                  <p className="text-sm font-semibold">Amara Okeke</p>
                  <p className="mt-0.5 text-xs text-muted">Verified student</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

function ReviewReleasePage() {
  const [state, setState] = useAppState();
  const [busy, setBusy] = useState(false);
  const release = () => {
    setBusy(true);
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        paymentReleased: true,
        submitted: true,
        escrowSecured: true,
      }));
      setBusy(false);
    }, 900);
  };
  return (
    <AppLayout>
      <section className="page-shell max-w-5xl py-8 sm:py-12">
        <PageHeader
          eyebrow="Poster workspace"
          title="Review submitted work"
          description="Check the deliverables carefully. Release payment only after confirming every deliverable."
          action={
            <StatusBadge
              status={state.paymentReleased ? "completed" : "submitted"}
            />
          }
        />
        {state.paymentReleased ? (
          <div className="card mt-8 overflow-hidden">
            <div className="bg-primary p-8 text-center text-white">
              <CheckCircle2 className="mx-auto size-12" />
              <h2 className="mt-4 text-3xl font-bold">Payment released</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-emerald-50">
                {formatAmount(gigs[0].price)} has been released to Amara&apos;s
                CampusGig balance. This gig is now complete.
              </p>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-muted">
                Transaction reference{" "}
                <span className="font-mono font-bold text-foreground">
                  CG-REL-0826-1492
                </span>
              </p>
              <Link href="/my-gigs" className="btn btn-primary mt-5">
                Return to my posted gigs
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <article className="card p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="avatar">AO</span>
                <div>
                  <p className="font-semibold">Amara Okeke</p>
                  <p className="mt-1 text-xs text-muted">
                    Submitted today at 14:32
                  </p>
                </div>
              </div>
              <div className="mt-7">
                <h2 className="text-lg font-bold">Submission note</h2>
                <p className="mt-3 leading-7 text-muted">
                  Hi Adaeze, I completed all 12 posts, the three story
                  templates, and the countdown set. I included editable Canva
                  links plus a zipped folder of final PNG exports. I also added
                  a short usage guide.
                </p>
              </div>
              <div className="mt-6 grid gap-3">
                <Link
                  href="/review?download=1"
                  className="focus-ring flex min-h-16 items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary-soft"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-muted-surface">
                    <FileText className="size-5 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      CampusGig-social-pack.zip
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      24.8 MB · ZIP archive
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    Download
                  </span>
                </Link>
                <Link
                  href="/review?open=1"
                  className="focus-ring flex min-h-16 items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary-soft"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-muted-surface">
                    <FileCheck2 className="size-5 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      Editable Canva workspace
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      External project link
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    Open
                  </span>
                </Link>
              </div>
              <div className="mt-8 rounded-xl bg-muted-surface p-4">
                <p className="text-sm font-semibold">Need a revision?</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Message the worker before releasing payment. The funds remain
                  protected while you review.
                </p>
                <button type="button" className="btn btn-secondary mt-4">
                  Request revision
                </button>
              </div>
            </article>
            <aside className="card h-fit p-5 lg:sticky lg:top-24">
              <p className="text-sm text-muted">Amount in escrow</p>
              <p className="mt-1 font-mono text-3xl font-bold">
                {formatAmount(gigs[0].price)}
              </p>
              <div className="mt-5 rounded-lg bg-primary-soft p-4 text-sm leading-6 text-secondary">
                <ShieldCheck className="mr-2 inline size-4 text-primary" />
                Funds are secured and have not been released.
              </div>
              <button
                type="button"
                className="btn btn-primary mt-5 w-full"
                onClick={release}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Releasing payment…" : "Approve & release payment"}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-muted">
                By approving, you confirm the agreed work is complete.
              </p>
            </aside>
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function AdminLayout({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const nav = [
    ["/admin", "Overview", LayoutDashboard],
    ["/admin/verifications", "Verification queue", UserCheck],
    ["/admin/users", "All users", UsersRound],
    ["/admin/gigs", "Gigs & transactions", BarChart3],
  ] as const;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex h-18 items-center border-b border-white/10 px-4 lg:h-auto lg:px-6 lg:py-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-500 text-slate-950">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold">CampusGig</p>
              <p className="text-xs text-slate-400">Admin console</p>
            </div>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:grid lg:px-4 lg:py-6"
          aria-label="Admin navigation"
        >
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? "page" : undefined}
              className={`focus-ring flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${active === href ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <Link
            href="/"
            className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to CampusGig
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-semibold">Operations workspace</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Friday, 14 August 2026
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="avatar bg-slate-200 text-slate-700">NA</span>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold">Nkiru Adeyemi</p>
                <p className="text-xs text-slate-500">Super admin</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function RealAdminLayout({ children }: { children: ReactNode }) {
  const { user, logOut } = useAuth();
  const pathname = useAppPathname();
  const displayName = user?.displayName || user?.email || "CampusGig admin";
  const logout = async () => {
    await logOut();
    navigate("/admin/login");
  };
  const nav = [
    ["/admin", "Registered users", UsersRound],
    ["/admin/verifications", "Verification queue", UserCheck],
  ] as const;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="flex h-18 items-center border-b border-white/10 px-4 lg:h-auto lg:px-6 lg:py-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-500 text-slate-950">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="font-bold">CampusGig</p>
              <p className="text-xs text-slate-400">Admin console</p>
            </div>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:grid lg:px-4 lg:py-6"
          aria-label="Admin navigation"
        >
          {nav.map(([href, label, Icon]) => {
            const active =
              pathname === href ||
              (href === "/admin" && pathname === "/admin/users");
            return (
              <Link
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
                className={`focus-ring flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-semibold ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-400">
            <LockKeyhole className="size-4" aria-hidden="true" />
            Restricted workspace
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-semibold">Operations workspace</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Live Firebase accounts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="avatar bg-slate-200 text-slate-700">
                {initialsFor(displayName)}
              </span>
              <div className="hidden sm:block">
                <p className="max-w-48 truncate text-sm font-semibold">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">
                  Authenticated administrator
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={logout}
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

// Admin demo screens are intentionally not routed in the product build.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AdminDashboardPage() {
  const metrics = [
    [UsersRound, "Total users", "2,486", "+124 this month"],
    [BriefcaseBusiness, "Open gigs", "186", "31 posted today"],
    [LockKeyhole, "In escrow", "26,840 USDC", "72 transactions"],
    [CheckCircle2, "Completed", "1,942", "98.1% released"],
  ];
  return (
    <AdminLayout active="/admin">
      <AdminPageHeader
        title="Dashboard overview"
        description="Current marketplace, verification, and payment activity across CampusGig."
        action={
          <Link
            href="/admin/verifications"
            className="btn bg-slate-950 text-white hover:bg-slate-800"
          >
            Review verifications
          </Link>
        }
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([Icon, label, value, detail]) => {
          const ItemIcon = Icon as typeof UsersRound;
          return (
            <article
              className="rounded-xl border border-slate-200 bg-white p-5"
              key={String(label)}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
                  <ItemIcon className="size-5" />
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  Live
                </span>
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-500">
                {String(label)}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-tight">
                {String(value)}
              </p>
              <p className="mt-2 text-xs text-slate-500">{String(detail)}</p>
            </article>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="font-bold">Recent escrow activity</h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest protected transactions
              </p>
            </div>
            <Link href="/admin/gigs" className="text-link text-sm">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Gig</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["CG-1492", "Social media design", 220, "in progress"],
                  ["CG-1489", "Product pitch video", 190, "submitted"],
                  ["CG-1484", "Faculty dinner photos", 320, "completed"],
                  ["CG-1478", "Research survey cleanup", 145, "in progress"],
                ].map(([ref, title, amount, status]) => (
                  <tr key={String(ref)}>
                    <td className="font-mono font-semibold">{String(ref)}</td>
                    <td>{String(title)}</td>
                    <td className="font-mono font-semibold">
                      {formatAmount(Number(amount))}
                    </td>
                    <td>
                      <StatusBadge status={status as GigStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-bold">Needs attention</h2>
            <p className="mt-1 text-xs text-slate-500">
              Items waiting on an admin
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {[
              ["8", "ID verifications", "/admin/verifications"],
              ["3", "Flagged gig reports", "/admin/gigs"],
              ["2", "Escrow disputes", "/admin/gigs"],
            ].map(([count, label, href]) => (
              <Link
                href={href}
                key={label}
                className="focus-ring flex min-h-16 items-center justify-between px-5 transition hover:bg-slate-50"
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                  {count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VerificationQueuePage() {
  const [state, setState] = useAppState();
  const [filter, setFilter] = useState("pending");
  return (
    <AdminLayout active="/admin/verifications">
      <AdminPageHeader
        title="Verification queue"
        description="Review student identity documents. Actions update the queue immediately and remain available in the review history."
        action={
          <select
            className="input min-h-11 w-auto bg-white text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter verification queue"
          >
            <option value="pending">Pending only</option>
            <option value="all">All reviews</option>
          </select>
        }
      />
      <div className="mt-7 space-y-4">
        {verifications.map((person) => {
          const action = state.verificationActions[person.id];
          if (filter === "pending" && action) return null;
          return (
            <article
              className="rounded-xl border border-slate-200 bg-white p-5"
              key={person.id}
            >
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex items-start gap-4">
                  <span className="avatar bg-slate-200 text-slate-700">
                    {person.name
                      .split(" ")
                      .map((name) => name[0])
                      .join("")}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{person.name}</h2>
                      {action === "approved" && (
                        <span className="status status-completed">
                          <CheckCircle2 className="size-3.5" />
                          Approved
                        </span>
                      )}
                      {action === "rejected" && (
                        <span className="status status-rejected">
                          <XCircle className="size-3.5" />
                          Rejected
                        </span>
                      )}
                      {!action && (
                        <span className="status status-submitted">
                          <Clock3 className="size-3.5" />
                          Pending review
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {person.email} · {person.university}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700">
                        {person.document}
                      </span>
                      <span className="py-1.5">
                        Submitted {person.submitted}
                      </span>
                    </div>
                  </div>
                </div>
                {!action && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-label={`Open document for ${person.name}`}
                    >
                      <FileText className="size-4" />
                      View ID
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          verificationActions: {
                            ...current.verificationActions,
                            [person.id]: "rejected",
                          },
                        }))
                      }
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          verificationActions: {
                            ...current.verificationActions,
                            [person.id]: "approved",
                          },
                        }))
                      }
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {filter === "pending" &&
          verifications.every(
            (person) => state.verificationActions[person.id],
          ) && (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <CheckCircle2 className="mx-auto size-9 text-emerald-700" />
              <h2 className="mt-4 text-lg font-bold">Queue cleared</h2>
              <p className="mt-2 text-sm text-slate-600">
                Every pending identity check has been reviewed.
              </p>
              <button
                type="button"
                className="btn btn-secondary mt-5"
                onClick={() => setFilter("all")}
              >
                View reviewed items
              </button>
            </div>
          )}
      </div>
    </AdminLayout>
  );
}

type AdminUserRow = {
  uid: string;
  fullName: string;
  email: string;
  university: string;
  onboardingComplete: boolean;
  studentVerified: boolean;
  verificationStatus: string;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type AdminUserDetail = AdminUserRow & {
  disabled: boolean;
  country: string;
  course: string;
  headline: string;
  bio: string;
  skills: string;
  portfolio: string;
  linkedIn: string;
  gitHub: string;
  availability: string;
  photoDataUrl: string;
  verificationMethod: string;
  schoolEmail: string;
  verificationSubmittedAt: string | null;
  studentVerifiedAt: string | null;
  verificationRequest: null | {
    status: string;
    fileName: string;
    imageDataUrl: string;
    submittedAt: string | null;
  };
};

function adminDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminUserModal({
  uid,
  adminUser,
  onClose,
  onDecision,
}: {
  uid: string;
  adminUser: NonNullable<ReturnType<typeof useAuth>["user"]>;
  onClose: () => void;
  onDecision: (uid: string, status: string) => void;
}) {
  const dialogReference = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decisionBusy, setDecisionBusy] = useState<
    "approved" | "rejected" | ""
  >("");

  useEffect(() => {
    const dialog = dialogReference.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const token = await adminUser.getIdToken();
        const response = await fetch(
          `/api/admin/users/${encodeURIComponent(uid)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            String(payload.error ?? "User details could not be loaded."),
          );
        if (active) setDetail(payload.user as AdminUserDetail);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "User details could not be loaded.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [adminUser, uid]);

  const review = async (decision: "approved" | "rejected") => {
    setDecisionBusy(decision);
    setError("");
    try {
      const token = await adminUser.getIdToken();
      const response = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid, decision }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(
            payload.error ?? "The verification decision could not be saved.",
          ),
        );
      setDetail((current) =>
        current
          ? {
              ...current,
              verificationStatus: decision,
              studentVerified: decision === "approved",
              verificationRequest: current.verificationRequest
                ? { ...current.verificationRequest, status: decision }
                : null,
            }
          : current,
      );
      onDecision(uid, decision);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "The verification decision could not be saved.",
      );
    } finally {
      setDecisionBusy("");
    }
  };

  const applicationSubmitted =
    detail && detail.verificationStatus !== "unsubmitted";
  const details = detail
    ? [
        ["Country", detail.country || "Not added"],
        ["University", detail.university || "Not added"],
        ["Course", detail.course || "Not added"],
        ["Availability", detail.availability || "Not added"],
        ["Skills", detail.skills || "Not added"],
        ["Joined", adminDate(detail.createdAt)],
        ["Last sign-in", adminDate(detail.lastSignInAt)],
        ["Account state", detail.disabled ? "Disabled" : "Active"],
      ]
    : [];

  return (
    <dialog
      ref={dialogReference}
      onClose={onClose}
      className="m-auto max-h-[92vh] w-[min(920px,calc(100%-2rem))] overflow-hidden rounded-2xl bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/65"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.1em] text-emerald-700">
            User record
          </p>
          <h2 className="mt-1 text-xl font-bold">Full account details</h2>
        </div>
        <button
          type="button"
          className="icon-button min-h-11 min-w-11 border-slate-200 bg-white text-slate-700"
          onClick={() => dialogReference.current?.close()}
          aria-label="Close user details"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5 sm:p-6">
        {loading ? (
          <div className="grid min-h-72 place-items-center" role="status">
            <div className="text-center">
              <Clock3 className="mx-auto size-7 animate-spin text-emerald-700" />
              <p className="mt-3 font-semibold">Loading full user record…</p>
            </div>
          </div>
        ) : error && !detail ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
            role="alert"
          >
            <AlertCircle className="mr-2 inline size-4" />
            {error}
            <button
              type="button"
              className="btn btn-secondary ml-3 bg-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          detail && (
            <div className="space-y-6">
              <section className="flex flex-col gap-4 rounded-xl bg-slate-50 p-5 sm:flex-row sm:items-center">
                <ProfileAvatar
                  name={detail.fullName}
                  src={detail.photoDataUrl}
                  large
                  className="bg-emerald-100 text-emerald-800"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-2xl font-bold">{detail.fullName}</h3>
                    {detail.studentVerified && (
                      <span className="status status-completed">
                        <BadgeCheck className="size-3.5" />
                        Verified student
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-all text-sm text-slate-600">
                    {detail.email}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {detail.headline || "No headline added"}
                  </p>
                </div>
              </section>
              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  role="alert"
                >
                  <AlertCircle className="mr-2 inline size-4" />
                  {error}
                </div>
              )}
              <section>
                <h3 className="font-bold">Profile information</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {details.map(([label, value]) => (
                    <div
                      className="rounded-lg border border-slate-200 p-4"
                      key={label}
                    >
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-2 text-sm font-semibold text-slate-800">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {detail.bio && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Bio
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {detail.bio}
                    </p>
                  </div>
                )}
              </section>
              <section className="rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Student verification</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {applicationSubmitted
                        ? `Submitted with ${detail.verificationMethod === "student-id" ? "student ID" : "school email"}.`
                        : "This user has not submitted student verification."}
                    </p>
                  </div>
                  <span
                    className={`status ${detail.studentVerified ? "status-completed" : applicationSubmitted ? "status-submitted" : "status-open"}`}
                  >
                    {detail.studentVerified ? (
                      <BadgeCheck className="size-3.5" />
                    ) : (
                      <Clock3 className="size-3.5" />
                    )}
                    {detail.verificationStatus}
                  </span>
                </div>
                {detail.schoolEmail && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      School email
                    </p>
                    <p className="mt-1 break-all text-sm font-semibold">
                      {detail.schoolEmail}
                    </p>
                  </div>
                )}
                {detail.verificationRequest?.imageDataUrl && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Submitted student ID ·{" "}
                      {detail.verificationRequest.fileName}
                    </p>
                    <div className="relative aspect-[16/9] max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <NextImage
                        src={detail.verificationRequest.imageDataUrl}
                        alt={`Student ID submitted by ${detail.fullName}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 576px"
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
                {applicationSubmitted && (
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={
                        Boolean(decisionBusy) ||
                        detail.verificationStatus === "rejected"
                      }
                      aria-busy={decisionBusy === "rejected"}
                      onClick={() => {
                        void review("rejected");
                      }}
                    >
                      {decisionBusy === "rejected"
                        ? "Declining…"
                        : detail.verificationStatus === "rejected"
                          ? "Declined"
                          : "Decline verification"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        Boolean(decisionBusy) ||
                        detail.verificationStatus === "approved"
                      }
                      aria-busy={decisionBusy === "approved"}
                      onClick={() => {
                        void review("approved");
                      }}
                    >
                      {decisionBusy === "approved"
                        ? "Approving…"
                        : detail.verificationStatus === "approved"
                          ? "Approved"
                          : "Approve verification"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )
        )}
      </div>
    </dialog>
  );
}

type AdminVerificationRow = {
  uid: string;
  fullName: string;
  email: string;
  country: string;
  university: string;
  status: string;
  fileName: string;
  submittedAt: string | null;
};

function RealVerificationQueuePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AdminVerificationRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [selectedUid, setSelectedUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/verifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          String(payload.error ?? "Verification requests could not be loaded."),
        );
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verification requests could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadRequests();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadRequests]);

  const visibleRequests =
    filter === "pending"
      ? requests.filter((item) => item.status === "pending")
      : requests;
  const updateDecision = (uid: string, status: string) => {
    setRequests((current) =>
      current.map((item) => (item.uid === uid ? { ...item, status } : item)),
    );
  };

  return (
    <RealAdminLayout>
      <AdminPageHeader
        title="Verification queue"
        description="Student-ID submissions appear here. Open a user to inspect their full record and approve or decline."
        action={
          <select
            className="input min-h-11 w-auto bg-white text-sm"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as "pending" | "all")
            }
            aria-label="Filter verification queue"
          >
            <option value="pending">Pending only</option>
            <option value="all">All decisions</option>
          </select>
        }
      />
      {error && (
        <div
          className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle className="mr-2 inline size-4" />
          {error}
          <button
            type="button"
            className="btn btn-secondary ml-3 bg-white"
            onClick={loadRequests}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <div
          className="mt-7 rounded-xl border border-slate-200 bg-white p-10 text-center"
          role="status"
        >
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-700" />
          <p className="mt-4 font-semibold">Loading verification queue…</p>
        </div>
      ) : !error && visibleRequests.length === 0 ? (
        <div className="mt-7 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto size-9 text-emerald-700" />
          <h2 className="mt-4 text-lg font-bold">
            No {filter === "pending" ? "pending " : ""}ID reviews
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            New student-ID submissions will appear in this table.
          </p>
        </div>
      ) : (
        !error && (
          <div className="table-wrap mt-7 border-slate-200">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institution</th>
                  <th>Country</th>
                  <th>Document</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((item) => (
                  <tr key={item.uid}>
                    <td>
                      <p className="font-semibold">{item.fullName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.email}
                      </p>
                    </td>
                    <td>{item.university || "Not added"}</td>
                    <td>{item.country || "Not added"}</td>
                    <td className="text-sm">{item.fileName}</td>
                    <td className="text-xs text-slate-600">
                      {adminDate(item.submittedAt)}
                    </td>
                    <td>
                      <span
                        className={`status ${item.status === "approved" ? "status-completed" : item.status === "rejected" ? "status-rejected" : "status-submitted"}`}
                      >
                        {item.status === "approved" ? (
                          <BadgeCheck className="size-3.5" />
                        ) : item.status === "rejected" ? (
                          <XCircle className="size-3.5" />
                        ) : (
                          <Clock3 className="size-3.5" />
                        )}
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary bg-white"
                        onClick={() => setSelectedUid(item.uid)}
                      >
                        Open user
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {selectedUid && user && (
        <AdminUserModal
          uid={selectedUid}
          adminUser={user}
          onClose={() => setSelectedUid("")}
          onDecision={updateDecision}
        />
      )}
    </RealAdminLayout>
  );
}

function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUid, setSelectedUid] = useState("");

  const loadUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(String(payload.error ?? "Users could not be loaded."));
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Users could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadUsers]);

  const filteredUsers = users.filter((item) =>
    `${item.fullName} ${item.email} ${item.university}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const updateDecision = (uid: string, status: string) => {
    setUsers((current) =>
      current.map((item) =>
        item.uid === uid
          ? {
              ...item,
              verificationStatus: status,
              studentVerified: status === "approved",
            }
          : item,
      ),
    );
  };

  return (
    <RealAdminLayout>
      <AdminPageHeader
        title="Registered users"
        description="Click any user to open their full account and review a submitted student verification."
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" />
            <input
              className="input min-h-11 w-full bg-white pl-9 text-sm sm:w-64"
              type="search"
              placeholder="Search users"
              aria-label="Search users"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        }
      />
      {error && (
        <div
          className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800"
          role="alert"
        >
          <AlertCircle className="mr-2 inline size-4" />
          {error}
          <button
            className="btn btn-secondary ml-3 bg-white"
            type="button"
            onClick={loadUsers}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <div
          className="mt-7 rounded-xl border border-slate-200 bg-white p-10 text-center"
          role="status"
        >
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-700" />
          <p className="mt-4 font-semibold">Loading registered users…</p>
        </div>
      ) : (
        !error && (
          <>
            <div className="table-wrap mt-7 border-slate-200">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Institution</th>
                    <th>Email ownership</th>
                    <th>School status</th>
                    <th>Onboarding</th>
                    <th>Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.uid}>
                      <td>
                        <button
                          type="button"
                          className="focus-ring min-h-11 rounded-lg text-left"
                          onClick={() => setSelectedUid(item.uid)}
                        >
                          <span className="block font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4">
                            {item.fullName}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {item.email}
                          </span>
                        </button>
                      </td>
                      <td>{item.university}</td>
                      <td>
                        {item.emailVerified ? (
                          <span className="status status-completed">
                            <BadgeCheck className="size-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="status status-submitted">
                            <Clock3 className="size-3.5" />
                            Pending email
                          </span>
                        )}
                      </td>
                      <td>
                        {item.studentVerified ? (
                          <span className="status status-completed">
                            <BadgeCheck className="size-3.5" />
                            Verified student
                          </span>
                        ) : (
                          <span className="status status-submitted">
                            <Clock3 className="size-3.5" />
                            {item.verificationStatus}
                          </span>
                        )}
                      </td>
                      <td>
                        {item.onboardingComplete ? "Complete" : "Not complete"}
                      </td>
                      <td className="text-xs text-slate-600">
                        {adminDate(item.lastSignInAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <p>
                Showing {filteredUsers.length} of {users.length} registered
                users
              </p>
              <button
                type="button"
                className="btn btn-secondary bg-white"
                onClick={loadUsers}
              >
                Refresh
              </button>
            </div>
            {filteredUsers.length === 0 && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center">
                <UsersRound className="mx-auto size-8 text-slate-400" />
                <p className="mt-4 font-semibold">
                  {query
                    ? "No registered users match this search."
                    : "No marketplace users yet."}
                </p>
                {!query && (
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    New client and student accounts will appear here after they
                    sign up.
                  </p>
                )}
              </div>
            )}
          </>
        )
      )}
      {selectedUid && user && (
        <AdminUserModal
          uid={selectedUid}
          adminUser={user}
          onClose={() => setSelectedUid("")}
          onDecision={updateDecision}
        />
      )}
    </RealAdminLayout>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AdminGigsPage() {
  const transactions = [
    [
      "CG-1492",
      "Social media designer",
      "Adaeze Nwosu",
      "Amara Okeke",
      220,
      "in progress",
    ],
    [
      "CG-1489",
      "Product pitch video",
      "Amina Hassan",
      "Tobi Okafor",
      190,
      "submitted",
    ],
    [
      "CG-1484",
      "Faculty dinner photos",
      "Naledi Dlamini",
      "David Mwangi",
      320,
      "completed",
    ],
    [
      "CG-1478",
      "Market survey cleanup",
      "Kwame Mensah",
      "Lerato Mokoena",
      145,
      "in progress",
    ],
    [
      "CG-1464",
      "Registration page",
      "Jean-Paul Niyonzima",
      "Tobi Okafor",
      380,
      "completed",
    ],
  ];
  return (
    <AdminLayout active="/admin/gigs">
      <AdminPageHeader
        title="Gigs & transactions"
        description="Monitor marketplace listings and every payment held or released through escrow."
        action={
          <button type="button" className="btn btn-secondary bg-white">
            Export CSV
          </button>
        }
      />
      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Recent transactions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Escrow movement across active and completed gigs
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-600">
            5 records
          </span>
        </div>
        <div className="table-wrap border-slate-200">
          <table className="data-table min-w-[960px]">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Gig</th>
                <th>Poster</th>
                <th>Worker</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(
                ([ref, title, poster, worker, amount, status]) => (
                  <tr key={String(ref)}>
                    <td className="font-mono font-semibold">{String(ref)}</td>
                    <td className="font-semibold">{String(title)}</td>
                    <td>{String(poster)}</td>
                    <td>{String(worker)}</td>
                    <td className="font-mono font-semibold">
                      {formatAmount(Number(amount))}
                    </td>
                    <td>
                      <StatusBadge status={status as GigStatus} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-bold">Open marketplace listings</h2>
          <p className="mt-1 text-xs text-slate-500">
            Live gigs currently accepting applications
          </p>
        </div>
        <div className="table-wrap border-slate-200">
          <table className="data-table min-w-[860px]">
            <thead>
              <tr>
                <th>Gig</th>
                <th>Poster</th>
                <th>Budget</th>
                <th>Applicants</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {gigs.slice(0, 5).map((gig) => (
                <tr key={gig.id}>
                  <td>
                    <p className="max-w-sm font-semibold">{gig.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {gig.category} · {gig.posted}
                    </p>
                  </td>
                  <td>{gig.poster}</td>
                  <td className="font-mono font-semibold">
                    {formatAmount(gig.price)}
                  </td>
                  <td>{gig.applicants}</td>
                  <td>
                    <StatusBadge status="open" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

function PlaceholderPage({ route }: { route: string[] }) {
  return (
    <AppLayout>
      <section
        className="page-shell py-20"
        data-unavailable-route={route.join("/")}
      >
        <div className="card mx-auto max-w-xl p-8 text-center">
          <Sparkles className="mx-auto size-8 text-primary" />
          <h1 className="mt-5 text-2xl font-bold">CampusGig workspace</h1>
          <p className="mt-3 text-muted">
            This area is not available yet. Return home to continue through
            CampusGig.
          </p>
          <Link href="/" className="btn btn-secondary mt-6">
            Back home
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const pathname = useAppPathname();

  useEffect(() => {
    if (!loading && !user)
      navigate(`/login?returnTo=${encodeURIComponent(pathname)}`);
    else if (!loading && user && isAdmin)
      navigate(user.emailVerified ? "/admin" : "/admin/verify-email");
    else if (!loading && user && !user.emailVerified) navigate("/verify-email");
  }, [isAdmin, loading, pathname, user]);

  if (loading)
    return (
      <AppLayout publicPage>
        <section className="page-shell py-20">
          <div className="card mx-auto max-w-lg p-8 text-center" role="status">
            <Clock3 className="mx-auto size-7 animate-spin text-primary" />
            <p className="mt-4 font-semibold">Checking your session…</p>
          </div>
        </section>
      </AppLayout>
    );
  if (!user)
    return (
      <AppLayout publicPage>
        <section className="page-shell py-20">
          <div className="card mx-auto max-w-lg p-8 text-center">
            <LockKeyhole className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 text-xl font-bold">Log in to continue</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              This workspace belongs to your CampusGig account.
            </p>
            <Link href="/login" className="btn btn-primary mt-5">
              Go to login
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  if (isAdmin)
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-950 text-white"
        role="status"
      >
        <div className="text-center">
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-300" />
          <p className="mt-4 font-semibold">Opening the admin console…</p>
        </div>
      </div>
    );
  if (!user.emailVerified)
    return (
      <AppLayout publicPage>
        <section className="page-shell py-20">
          <div className="card mx-auto max-w-lg p-8 text-center">
            <BadgeCheck className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 text-xl font-bold">
              Verify your email to continue
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Open the verification link sent to your inbox before accessing
              account-only pages.
            </p>
            <Link href="/verify-email" className="btn btn-primary mt-5">
              Verify email
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  return children;
}

function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, logOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/admin/login");
    else if (!loading && user && isAdmin && !user.emailVerified)
      navigate("/admin/verify-email");
  }, [isAdmin, loading, user]);

  if (loading)
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-950 text-white"
        role="status"
      >
        <div className="text-center">
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-300" />
          <p className="mt-4 font-semibold">Checking administrator access…</p>
        </div>
      </div>
    );
  if (!user)
    return (
      <AdminAuthShell
        title="Administrator login required"
        description="Sign in with an approved administrator account to open this restricted workspace."
        footer={
          <Link
            className="font-semibold text-emerald-700 underline underline-offset-4"
            href="/admin/login"
          >
            Go to admin login
          </Link>
        }
      >
        <div className="rounded-xl bg-slate-100 p-5 text-sm leading-6 text-slate-700">
          <LockKeyhole
            className="mb-3 size-6 text-emerald-700"
            aria-hidden="true"
          />
          No administrator session was found in this browser.
        </div>
      </AdminAuthShell>
    );
  if (!isAdmin)
    return (
      <AdminAuthShell
        title="Administrator access denied"
        description="The signed-in marketplace account is not listed in ADMIN_EMAILS."
        footer={
          <button
            type="button"
            className="font-semibold text-emerald-700 underline underline-offset-4"
            onClick={async () => {
              await logOut();
              navigate("/admin/login");
            }}
          >
            Use an admin account
          </button>
        }
      >
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"
          role="alert"
        >
          <AlertCircle
            className="mb-3 size-6 text-amber-700"
            aria-hidden="true"
          />
          Client and student accounts cannot enter the operations console.
        </div>
      </AdminAuthShell>
    );
  if (!user.emailVerified)
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-950 text-white"
        role="status"
      >
        <div className="text-center">
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-300" />
          <p className="mt-4 font-semibold">Opening email verification…</p>
        </div>
      </div>
    );
  return children;
}

function CampusGigRouter({ route }: RouteProps) {
  const path = route.join("/");
  const { user, isAdmin, loading } = useAuth();
  const isAdminRoute = path === "admin" || path.startsWith("admin/");

  useEffect(() => {
    if (!loading && user?.emailVerified && isAdmin && !isAdminRoute)
      navigate("/admin");
  }, [isAdmin, isAdminRoute, loading, user]);

  if (!loading && user?.emailVerified && isAdmin && !isAdminRoute) {
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-950 text-white"
        role="status"
      >
        <div className="text-center">
          <Clock3 className="mx-auto size-7 animate-spin text-emerald-300" />
          <p className="mt-4 font-semibold">Returning to the admin console…</p>
        </div>
      </div>
    );
  }

  let page: ReactNode;
  if (!path) page = <LandingPage />;
  else if (path === "signup") page = <SignupPage />;
  else if (path === "login") page = <LoginPage />;
  else if (path === "verify-email") page = <VerifyEmailPage />;
  else if (path === "admin/signup") page = <AdminSignupPage />;
  else if (path === "admin/login") page = <AdminLoginPage />;
  else if (path === "admin/verify-email") page = <AdminVerifyEmailPage />;
  else if (path === "gigs") page = <JobFeedPage />;
  else if (route[0] === "gigs" && route[1] && route[2] === "conversation")
    page = <MarketplaceConversationPage id={route[1]} />;
  else if (route[0] === "gigs" && route[1])
    page = <MarketplaceGigDetailLivePage id={route[1]} />;
  else if (path === "applications") page = <MarketplaceApplicationsPage />;
  else if (path === "profile") page = <ProfileWorkspacePage />;
  else if (path === "profile/edit") page = <EditProfileWorkspacePage />;
  else if (path === "profile/verification") page = <StudentVerificationPage />;
  else if (path === "post") page = <PostGigLivePage />;
  else if (path === "my-gigs") page = <MyGigsLivePage />;
  else if (route[0] === "my-gigs" && route[1] && route[2] === "applicants")
    page = <MarketplaceApplicantsPage id={route[1]} />;
  else if (path === "escrow") page = <FundEscrowPage />;
  else if (path === "review") page = <ReviewReleasePage />;
  else if (path === "admin" || path === "admin/users")
    page = <AdminUsersPage />;
  else if (path === "admin/verifications") page = <RealVerificationQueuePage />;
  else page = <PlaceholderPage route={route} />;

  const protectedPath =
    [
      "applications",
      "profile",
      "profile/edit",
      "profile/verification",
      "post",
      "my-gigs",
      "escrow",
      "review",
    ].includes(path) ||
    path.startsWith("my-gigs/") ||
    (route[0] === "gigs" && route[2] === "conversation");
  const protectedAdminPath = [
    "admin",
    "admin/users",
    "admin/verifications",
  ].includes(path);
  if (protectedAdminPath)
    return <AdminProtectedRoute>{page}</AdminProtectedRoute>;
  return protectedPath ? <ProtectedRoute>{page}</ProtectedRoute> : page;
}

export function CampusGigApp({ route: serverRoute }: RouteProps) {
  const pathname = useRoutePathname(serverRoute);
  const route = pathname.split("/").filter(Boolean);
  return (
    <PathnameContext.Provider value={pathname}>
      <AppStateProvider>
        <CampusGigRouter route={route} />
      </AppStateProvider>
    </PathnameContext.Provider>
  );
}
