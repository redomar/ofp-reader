/** Pictograms for radio channel types, drawn on a 24-unit grid in currentColor. */
export const CHANNEL_TYPES = [
  ["atis", "ATIS", "Information"],
  ["del", "DEL", "Delivery"],
  ["gnd", "GND", "Ground"],
  ["twr", "TWR", "Tower"],
  ["dep", "DEP", "Departure"],
  ["app", "APP", "Approach"],
  ["ctr", "CTR", "Centre / radar"],
  ["info", "INFO", "Flight information"],
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number][0];

/** Navaid types for ones you add yourself; NDB is tuned in kHz on the ADF, the rest in MHz on a NAV radio. */
export const NAVAID_TYPES = [
  ["vor", "VOR", "VHF omni range"],
  ["vordme", "VOR/DME", "with distance"],
  ["ndb", "NDB", "ADF · kHz"],
  ["ils", "ILS", "localiser + glide"],
  ["loc", "LOC", "localiser only"],
  ["dme", "DME", "distance only"],
] as const;
export type NavaidType = (typeof NAVAID_TYPES)[number][0];

export type IconKind = ChannelType | NavaidType | "stop";

const PATHS: Record<IconKind, React.ReactNode> = {
  atis: (
    <>
      <path d="M12 13v8" />
      <circle cx="12" cy="11" r="1.6" className="fill" />
      <path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.6 4.6a9 9 0 0 0 0 12.8M18.4 4.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  del: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M8.5 12.5l2.3 2.3 4.7-4.8" />
    </>
  ),
  gnd: <path d="M12 3.5l1 4.5 6 3.2v1.6l-6-1.6v3.6l1.8 1.3v1.3L12 16.6l-2.8.8v-1.3l1.8-1.3v-3.6l-6 1.6v-1.6L11 8zM4 21h3M10.5 21h3M17 21h3" />,
  twr: <path d="M7 5h10l-1.5 5h-7zM8.5 10h7M10 10l-.5 11M14 10l.5 11M8 21h8M12 5V2.5" />,
  dep: <path d="M3 19h18M5 16l14-9M19 7l-3.4.1M19 7l-1.5 3M9 13.4l-1-3.2" />,
  app: <path d="M3 5l9 7M12 12l-3.2-.3M12 12l-.8-3.1M3 20h18M14 20l2-4h2l-1 4M5.5 6.9l2.3-3" />,
  ctr: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
      <circle cx="15.5" cy="14.5" r="1" className="fill" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="1.1" className="fill" />
    </>
  ),
  ils: <path d="M12 21l-3.5-9h7zM12 4v3M12 21L4 7M12 21l8-14" />,
  loc: <path d="M12 21l-3.5-9h7zM12 21L5 9M12 21l7-12" />,
  vor: (
    <>
      <path d="M8.5 4.5h7L19 12l-3.5 7.5h-7L5 12z" />
      <circle cx="12" cy="12" r="1.6" className="fill" />
    </>
  ),
  vordme: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M9 7h6l3 5-3 5H9l-3-5z" />
      <circle cx="12" cy="12" r="1.4" className="fill" />
    </>
  ),
  ndb: (
    <>
      <circle cx="12" cy="12" r="1.8" className="fill" />
      <circle cx="12" cy="12" r="5" strokeDasharray="1.2 2.2" />
      <circle cx="12" cy="12" r="8.5" strokeDasharray="1.2 2.6" />
    </>
  ),
  dme: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
      <circle cx="12" cy="12" r="1.6" className="fill" />
    </>
  ),
  stop: (
    <>
      <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" />
      <path d="M7.5 12h9" strokeWidth="2.4" />
    </>
  ),
};

export function ChannelIcon({ kind, size = 20 }: { kind: IconKind; size?: number }) {
  return (
    <svg className="ch-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {PATHS[kind]}
    </svg>
  );
}
