/** Structured model of a SimBrief (LIDO-style) OFP. Every field mirrors a value printed on the PDF. */

export type Str = string | null;
export type Num = number | null;

export interface Header {
  title: Str;
  flightNo: Str;
  date: Str;
  dep: Str;
  arr: Str;
  acType: Str;
  reg: Str;
  releaseTime: Str;
  releaseDate: Str;
  ofpNo: Str;
  routeName: Str;
  wxProg: string[];
  wxObs: string[];
  atcCallsign: Str;
  depIata: Str;
  arrIata: Str;
  crzSys: Str;
  costIndex: Str;
  flightDate: Str;
  outTime: Str;
  offTime: Str;
  onTime: Str;
  inTime: Str;
  sta: Str;
  ctot: Str;
  aircraft: Str;
  gndDist: Num;
  airDist: Num;
  gcDist: Num;
  avgWind: Str;
  avgWc: Str;
  avgIsa: Str;
  avgFf: Num;
  unit: "KGS" | "LBS";
  fuelBias: Str;
  maxTow: Num;
  maxLaw: Num;
  maxZfw: Num;
  estTow: Num;
  estLaw: Num;
  estZfw: Num;
  altn: Str;
  tkofAltn: Str;
  flSteps: { fix: string; fl: string }[];
  dispRmks: Str;
}

export interface FuelRow {
  label: string;
  arpt: Str;
  fuel: Num;
  time: Str;
}

export interface Fuel {
  rows: FuelRow[];
  picExtra: Str;
  totalFuel: Str;
  reasonPicExtra: Str;
  fmc: { label: string; value: Num }[];
  tankering: Str;
  confirmation: Str;
  dispatcher: Str;
  picName: Str;
  tel: Str;
  picSignature: Str;
}

export interface AltRoute {
  apt: string;
  rwy: Str;
  trk: Str;
  dst: Num;
  via: string;
  fl: Str;
  wc: Str;
  time: Str;
  fuel: Num;
}

export interface OpImpact {
  kind: string;
  change: string;
  tripSign: string;
  trip: Num;
  tripUnit: Str;
  timeSign: string;
  time: Str;
}

export interface TimeRow {
  label: string;
  est: Str;
  sked: Str;
  actual: Str;
}

export interface WeightRow {
  label: string;
  est: Str;
  max: Str;
  actual: Str;
  note: Str;
}

export interface LogPoint {
  kind: "wpt" | "fir";
  awy: Str;
  fl: Str;
  imt: Str;
  mn: Str;
  wind: Str;
  oat: Str;
  efob: Str;
  pbrn: Str;
  position: Str;
  lat: Str;
  eet: Str;
  eto: Str;
  mora: Str;
  itt: Str;
  tas: Str;
  comp: Str;
  tdv: Str;
  ident: Str;
  long: Str;
  ttlt: Str;
  ato: Str;
  dis: Str;
  rdis: Str;
  gs: Str;
  shr: Str;
  trp: Str;
  afob: Str;
  abrn: Str;
  freq: Str;
  firName: Str;
  latDeg: Num;
  lonDeg: Num;
}

export interface WindStation {
  name: string;
  levels: { fl: string; dir: number; spd: number; temp: number }[];
}

export interface AtcFpl {
  addresses: Str;
  originator: Str;
  text: string[];
  items: { item: string; label: string; value: string }[];
  item18: { key: string; value: string }[];
}

export interface KeyedRow {
  [key: string]: string;
}

export interface Table {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface LandingGrid {
  title: string;
  subtitle: Str;
  runways: { rwy: string; length: Str; cells: { oat: string; planned: boolean; value: string }[]; hw: Str; tw: Str }[];
}

export interface Tlr {
  header: string[];
  takeoff: { planned: KeyedRow | null; rmks: string[]; tables: Table[] };
  landing: { planned: KeyedRow | null; rmks: string[]; tables: Table[]; grid: LandingGrid | null; distance: Table | null };
  footer: Str;
}

export interface WxAirport {
  role: string;
  icao: string;
  iata: Str;
  name: string;
  metar: Str;
  taf: string[];
  other: string[];
}

export interface Wx {
  header: string[];
  advisories: { title: string; lines: string[] }[];
  airports: WxAirport[];
  footer: Str;
}

export interface Notam {
  id: string;
  valid: Str;
  lines: string[];
}

export interface NotamGroup {
  section: string;
  location: Str;
  locationName: Str;
  category: Str;
  notams: Notam[];
  notes: string[];
}

export interface NotamBulletin {
  header: string[];
  groups: NotamGroup[];
  footer: Str;
}

export interface OFP {
  source: string;
  pageCount: number;
  pages: { page: number; lines: string[] }[];
  chartPages: number[];
  header: Header;
  fuel: Fuel;
  alternates: AltRoute[];
  finresAltn: Num;
  mel: string[];
  routeId: Str;
  route: Str;
  atcClearance: string[];
  opImpacts: OpImpact[];
  atis: string[];
  rvsm: Str;
  times: TimeRow[];
  weights: WeightRow[];
  terrain: string[];
  criticalMora: Str;
  log: LogPoint[];
  winds: WindStation[];
  fpl: AtcFpl;
  additionalInfo: string[];
  tlr: Tlr;
  wx: Wx;
  notams: NotamBulletin;
  companyNotams: NotamBulletin;
  endNote: Str;
}
